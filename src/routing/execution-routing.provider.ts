import { calculateDistance } from "../geography/geography.utils.js";
import type { RouteMetrics, RoutingMatrix, RoutingPoint, RoutingProvider } from "./routing.types.js";
import { RouteUnavailableError, RoutingMatrixTooLargeError } from "./routing.errors.js";
import { validateRoutingMatrix, validateRoutingPoints } from "./routing-validation.service.js";

/** A directed Matrix snapshot, owned by one optimization execution. */
export class ExecutionRoutingProvider implements RoutingProvider {
  private readonly cells = new Map<string, RouteMetrics | null>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly provider: RoutingProvider, private readonly maxPoints = 6) {
    if (!Number.isInteger(maxPoints) || maxPoints < 2) throw new Error("Invalid Matrix batch size.");
  }

  private key(from: RoutingPoint, to: RoutingPoint): string {
    return JSON.stringify([from.id, from.latitude, from.longitude, to.id, to.latitude, to.longitude]);
  }

  private async load(points: RoutingPoint[]): Promise<void> {
    const matrix = await this.provider.getMatrix(points);
    // Validate the complete response before adding any cells to the snapshot.
    validateRoutingMatrix(matrix, points);
    matrix.points.forEach((from, i) => matrix.points.forEach((to, j) => {
      const key = this.key(from, to);
      if (!this.cells.has(key)) {
        const metric = matrix.metrics[i]![j]!;
        this.cells.set(key, metric === null ? null : {...metric});
      }
    }));
  }

  async prepare(points: RoutingPoint[]): Promise<void> {
    validateRoutingPoints(points);
    if (points.length < 2) return;
    const origin = points[0]!;
    const employees = points.slice(1).sort(
      (a, b) => calculateDistance(origin, a) - calculateDistance(origin, b),
    );
    const batches: RoutingPoint[][] = [];
    for (let i = 0; i < employees.length; i += this.maxPoints - 1) {
      batches.push([origin, ...employees.slice(i, i + this.maxPoints - 1)]);
    }
    for (const batch of batches) {
      await this.prepareBatch(batch);
    }
  }

  private async prepareBatch(batch: RoutingPoint[]): Promise<void> {
    try {
      await this.getMatrix(batch);
    } catch (error) {
      // A global NoTable/NoSegment does not identify which pairs are unavailable.
      // Leave them unknown; the ordinary small requests will isolate the problem.
      if (error instanceof RouteUnavailableError) return;
      // LocationIQ can reject a batch containing otherwise valid points when the
      // requested relations span disconnected areas. Keep maxPoints=6, record the
      // rejected batch, and split only this failed prefetch; pair requests remain
      // the authoritative fallback and still preserve technical failures.
      if (error instanceof RoutingMatrixTooLargeError && batch.length > 2) {
        console.warn(`MATRIX_BATCH_TOO_BIG ${batch.map((point) => point.id).join(",")}`);
        const employees = batch.slice(1);
        const midpoint = Math.ceil(employees.length / 2);
        await this.prepareBatch([batch[0]!, ...employees.slice(0, midpoint)]);
        await this.prepareBatch([batch[0]!, ...employees.slice(midpoint)]);
        return;
      }
      throw error;
    }
  }

  getMatrix(points: RoutingPoint[]): Promise<RoutingMatrix> {
    validateRoutingPoints(points);
    if (points.length > this.maxPoints) throw new Error("Matrix request exceeds batch size.");
    // Serialization also coalesces concurrent overlapping misses after the first load.
    const result = this.queue.then(async () => {
      if (points.some(from => points.some(to => !this.cells.has(this.key(from, to))))) await this.load(points);
      return {points: [...points], metrics: points.map(from => points.map(to => {
        const metric = this.cells.get(this.key(from, to));
        if (metric === undefined) throw new Error("Routing snapshot is missing a requested relation.");
        return metric === null ? null : {...metric};
      }))};
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
