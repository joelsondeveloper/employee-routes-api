import {
  RouteUnavailableError,
  InvalidRoutingMatrixError,
  RoutingInputError,
  RoutingMatrixTooLargeError,
  RoutingProviderError,
} from "../routing.errors.js";
import { validateRoutingPoints, validateRoutingMatrix } from "../routing-validation.service.js";
import { logExternalProviderFailure } from "../../external-provider.logging.js";
import type {
  RoutingMatrix,
  RoutingPoint,
  RoutingProvider,
} from "../routing.types.js";

interface LocationIQResponse {
  code?: string;
  durations: (number | null)[][];
  distances: (number | null)[][];
}

export interface LocationIQRoutingOptions {
  /** Minimum gap between requests. The free plan allows 2 req/s; 1000 ms leaves room for other callers. */
  minIntervalMs?: number;
  /** Per-attempt timeout; an aborted request counts as a retryable network failure. */
  timeoutMs?: number;
  /** Total attempts for 429, 5xx and network/timeout failures. 4xx domain answers are never retried. */
  maxAttempts?: number;
  /** First backoff; doubles per attempt with up to +100% jitter. Retry-After wins when larger. */
  baseBackoffMs?: number;
  random?: () => number;
}

function retryAfterMs(header: string | null): number {
  if (header === null) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

export class LocationIQRoutingProvider implements RoutingProvider {
  private queue: Promise<unknown> = Promise.resolve();
  private nextRequestAt = 0;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly baseBackoffMs: number;
  private readonly random: () => number;

  constructor(options: LocationIQRoutingOptions = {}) {
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseBackoffMs = options.baseBackoffMs ?? 1000;
    this.random = options.random ?? Math.random;
  }

  /** Serialized and paced; retries throttling, server and network failures with exponential backoff. */
  private request(url: string): Promise<Response> {
    const task = this.queue.then(async () => {
      for (let attempt = 1; ; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, this.nextRequestAt - Date.now())));
        let response: Response | undefined;
        let failure: unknown;
        try {
          response = await fetch(url, {signal: AbortSignal.timeout(this.timeoutMs)});
        } catch (error) {
          failure = error;
        }
        this.nextRequestAt = Date.now() + this.minIntervalMs;
        const retryable = failure !== undefined || response!.status === 429 || response!.status >= 500;
        if (!retryable || attempt >= this.maxAttempts) {
          if (failure !== undefined) throw failure;
          return response!;
        }
        const backoff = this.baseBackoffMs * 2 ** (attempt - 1) * (1 + this.random());
        const wait = Math.max(this.minIntervalMs, backoff, response ? retryAfterMs(response.headers.get("retry-after")) : 0);
        this.nextRequestAt = Date.now() + wait;
        await response?.body?.cancel();
      }
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  async getMatrix(points: RoutingPoint[]): Promise<RoutingMatrix> {
    if (points.length < 2) {
      throw new RoutingInputError("At least two routing points are required.");
    }

    validateRoutingPoints(points);

    const apiKey = process.env.LOCATIONIQ_API_KEY;

    if (!apiKey) {
      throw new RoutingProviderError("Routing provider is not configured.", "CONFIGURATION");
    }

    const coordinates = points
      .map((point) => `${point.longitude},${point.latitude}`)
      .join(";");

    const params = new URLSearchParams({
      key: apiKey,
      annotations: "distance,duration",
    });

    const url = `https://us1.locationiq.com/v1/matrix/driving/${coordinates}?${params}`;

    let response: Response;
    try {
      response = await this.request(url);
    } catch (error) {
      logExternalProviderFailure("ROUTING_PROVIDER_FAILED", "LocationIQ", error);
      throw new RoutingProviderError(
        error instanceof Error ? error.message : "Routing provider request failed.",
        "UPSTREAM",
      );
    }

    // Authentication, throttling and server failures must never become incompatibility.
    if (!response.ok && response.status !== 400 && response.status !== 404) {
      logExternalProviderFailure("ROUTING_PROVIDER_FAILED", "LocationIQ", new Error(`HTTP ${response.status}`), response.status);
      throw new RoutingProviderError(
        `Routing request failed with status ${response.status}.`,
        response.status === 401 || response.status === 403 ? "CONFIGURATION" : "UPSTREAM",
        response.status,
      );
    }
    let data: LocationIQResponse;
    try {
      data = (await response.json()) as LocationIQResponse;
    } catch (error) {
      logExternalProviderFailure("ROUTING_PROVIDER_FAILED", "LocationIQ", error, response.status);
      throw new RoutingProviderError("Invalid routing provider response.", "UPSTREAM", response.status);
    }
    if (data?.code === "TooBig") {
      throw new RoutingMatrixTooLargeError(points.map((point) => point.id));
    }
    if (data && (data.code === "NoTable" || data.code === "NoSegment")) {
      throw new RouteUnavailableError([]);
    }
    if (!response.ok) {
      throw new RoutingProviderError(
        `Routing request failed with status ${response.status}.`,
        "UPSTREAM",
        response.status,
      );
    }
    if (!data || (data.code !== undefined && data.code !== "Ok") ||
        !Array.isArray(data.durations) || !Array.isArray(data.distances) ||
        data.durations.length !== points.length || data.distances.length !== points.length) {
      throw new InvalidRoutingMatrixError("Invalid LocationIQ Matrix response.");
    }
    const metrics = Array.from({length: points.length}, (_, rowIndex) => {
      const durations = data.durations[rowIndex], distances = data.distances[rowIndex];
      if (!Array.isArray(durations) || !Array.isArray(distances) ||
          durations.length !== points.length || distances.length !== points.length) {
        throw new InvalidRoutingMatrixError("Invalid LocationIQ Matrix dimensions.");
      }
      return Array.from({length: points.length}, (_, columnIndex) => {
        const duration = durations[columnIndex], distance = distances[columnIndex];
        if (duration === null && distance === null) return null;
        if (typeof duration !== "number" || typeof distance !== "number") {
          throw new InvalidRoutingMatrixError("Invalid LocationIQ Matrix metric.");
        }
        return {durationSeconds: duration, distanceMeters: distance};
      });
    });
    const matrix: RoutingMatrix = {points, metrics};
    validateRoutingMatrix(matrix, points);
    return matrix;
  }
}
