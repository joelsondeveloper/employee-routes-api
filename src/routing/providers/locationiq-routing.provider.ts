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

export class LocationIQRoutingProvider implements RoutingProvider {
  private queue: Promise<unknown> = Promise.resolve();
  private nextRequestAt = 0;

  private request(url: string): Promise<Response> {
    const task = this.queue.then(async () => {
      for (let attempt = 0; ; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, this.nextRequestAt - Date.now())));
        const response = await fetch(url);
        this.nextRequestAt = Date.now() + 2000;
        if (response.status !== 429 || attempt >= 2) return response;
        const retryAfter = response.headers.get("retry-after");
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter ?? "") - Date.now();
        this.nextRequestAt = Date.now() + Math.max(2000 * 2 ** attempt, Number.isFinite(delay) ? delay : 0);
        await response.body?.cancel();
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
