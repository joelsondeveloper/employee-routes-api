import type { CalculatedRoute, RoutingMatrix } from "./routing.types.js";

export function calculateRoute(
  matrix: RoutingMatrix,
  pointIndexes: number[],
): CalculatedRoute {
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  for (let i = 0; i < pointIndexes.length - 1; i++) {
    const fromIndex = pointIndexes[i];
    const toIndex = pointIndexes[i + 1];

    const metrics = matrix.metrics[fromIndex]?.[toIndex];

    if (!metrics) {
      throw new Error(
        `Route metric not found from ${fromIndex} to ${toIndex}.`,
      );
    }

    totalDurationSeconds += metrics.durationSeconds;
    totalDistanceMeters += metrics.distanceMeters;
  }

  const pointIds = pointIndexes.map((index) => {
    const point = matrix.points[index];

    if (!point) {
      throw new Error(`Routing point not found at index ${index}.`);
    }

    return point.id;
  });

  return {
    pointIds,
    totalDistanceMeters,
    totalDurationSeconds,
  };
}
