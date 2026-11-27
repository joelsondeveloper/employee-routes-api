import { calculateDistance } from "../geography/geography.utils.js";
import type { RouteMetrics, RoutingMatrix, RoutingPoint, RoutingProvider } from "./routing.types.js";
import { OptimizationBudgetExceededError, RouteUnavailableError, RoutingMatrixTooLargeError } from "./routing.errors.js";
import { validateRoutingMatrix, validateRoutingPoints } from "./routing-validation.service.js";

export interface ExecutionRoutingOptions {
  /** Largest Matrix request. LocationIQ accepts 25 coordinates (measured, see docs/adr/0001). */
  maxPoints?: number;
  /** Time budget for the whole execution; checked before every provider call. */
  budgetMs?: number;
  now?: () => number;
}

/**
 * A directed Matrix snapshot, owned by one optimization execution.
 *
 * prepare() fills the complete N×N matrix up front by tiling: points are split
 * into blocks of ⌊maxPoints/2⌋ and every pair of blocks is fetched in one square
 * request, which covers both directions between them. That costs C(B,2)
 * requests for B blocks (1 when everything fits), so grouping and route scoring
 * afterwards run entirely from this snapshot.
 */
export class ExecutionRoutingProvider implements RoutingProvider {
  private readonly cells = new Map<string, RouteMetrics | null>();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly maxPoints: number;
  private readonly budgetMs: number | undefined;
  private readonly now: () => number;
  private readonly startedAt: number;
  /** Requests sent to the underlying provider during this execution. */
  externalCalls = 0;

  constructor(private readonly provider: RoutingProvider, options: ExecutionRoutingOptions = {}) {
    this.maxPoints = options.maxPoints ?? 25;
    if (!Number.isInteger(this.maxPoints) || this.maxPoints < 2) throw new Error("Invalid Matrix batch size.");
    this.budgetMs = options.budgetMs;
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
  }

  get elapsedMs(): number {
    return this.now() - this.startedAt;
  }

  private key(from: RoutingPoint, to: RoutingPoint): string {
    return JSON.stringify([from.id, from.latitude, from.longitude, to.id, to.latitude, to.longitude]);
  }

  private async load(points: RoutingPoint[]): Promise<void> {
    if (this.budgetMs !== undefined && this.elapsedMs >= this.budgetMs) {
      throw new OptimizationBudgetExceededError(this.budgetMs, this.externalCalls);
    }
    this.externalCalls++;
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
    // Distance order keeps nearby points in the same block (fewer cross-block
    // surprises if a batch has to be split), and the origin in the first block.
    const ordered = [origin, ...points.slice(1).sort(
      (a, b) => calculateDistance(origin, a) - calculateDistance(origin, b),
    )];
    if (ordered.length <= this.maxPoints) {
      await this.prepareBatch(ordered);
      return;
    }
    const blockSize = Math.floor(this.maxPoints / 2);
    const blocks: RoutingPoint[][] = [];
    for (let i = 0; i < ordered.length; i += blockSize) blocks.push(ordered.slice(i, i + blockSize));
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        await this.prepareBatch([...blocks[i]!, ...blocks[j]!]);
      }
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
      // requested relations span disconnected areas. Record the rejected batch and
      // split only this failed prefetch; any cell still missing afterwards is
      // fetched on demand by getMatrix, which also preserves technical failures.
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
