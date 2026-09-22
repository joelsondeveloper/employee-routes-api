import type { RoutingPoint, RoutingMatrix, RouteMetrics } from "./routing.types.js";
import { RoutingInputError, InvalidRoutingMatrixError, RouteUnavailableError } from "./routing.errors.js";

export function validateRoutingPoints(points: RoutingPoint[]): void {
  const ids = new Set<string>();
  for (const [index, point] of points.entries()) {
    if (!point || typeof point.id !== "string" || !point.id.trim()) {
      throw new RoutingInputError(`Routing point ${index} requires a non-empty ID.`);
    }
    if (ids.has(point.id)) throw new RoutingInputError(`Duplicate routing ID: ${point.id}.`);
    ids.add(point.id);
    if (!Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 ||
        !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180) {
      throw new RoutingInputError(`Invalid coordinates for routing point ${point.id}.`);
    }
  }
}

export function validateRoutingMatrix(matrix: RoutingMatrix, expectedPoints?: RoutingPoint[]): void {
  if (!matrix || !Array.isArray(matrix.points) || !Array.isArray(matrix.metrics)) {
    throw new InvalidRoutingMatrixError("Invalid routing Matrix structure.");
  }
  validateRoutingPoints(matrix.points);
  const size = matrix.points.length;
  if (expectedPoints && (size !== expectedPoints.length || matrix.points.some((p, i) =>
    p.id !== expectedPoints[i]!.id || p.latitude !== expectedPoints[i]!.latitude || p.longitude !== expectedPoints[i]!.longitude))) {
    throw new InvalidRoutingMatrixError("Routing Matrix points do not match the request.");
  }
  if (matrix.metrics.length !== size) throw new InvalidRoutingMatrixError("Invalid routing Matrix dimensions.");
  for (let i = 0; i < size; i++) {
    const row = matrix.metrics[i];
    if (!Array.isArray(row) || row.length !== size) throw new InvalidRoutingMatrixError("Invalid routing Matrix dimensions.");
    for (let j = 0; j < size; j++) {
      const metric = row[j];
      if (metric === null) continue;
      if (!metric || !Number.isFinite(metric.durationSeconds) || metric.durationSeconds < 0 ||
          !Number.isFinite(metric.distanceMeters) || metric.distanceMeters < 0) {
        throw new InvalidRoutingMatrixError(`Invalid routing metric at ${i}, ${j}.`);
      }
    }
  }
}

export function getRouteMetric(matrix: RoutingMatrix, from: number, to: number): RouteMetrics {
  const source = matrix.points[from], target = matrix.points[to];
  if (!source || !target) throw new InvalidRoutingMatrixError("Invalid routing point index.");
  const metric = matrix.metrics[from]?.[to];
  if (metric === null) throw new RouteUnavailableError([{fromId: source.id, toId: target.id}]);
  if (!metric) throw new InvalidRoutingMatrixError(`Route metric not found from ${from} to ${to}.`);
  return metric;
}
