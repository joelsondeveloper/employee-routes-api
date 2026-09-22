import { RouteUnavailableError } from "./routing.errors.js";
import { getRouteMetric, validateRoutingMatrix } from "./routing-validation.service.js";
import type {
  CalculatedRoute,
  PassengerRouteMetric,
  RouteCandidate,
  RouteEvaluation,
  RoutingMatrix,
} from "./routing.types.js";

import {
  generatePermutations,
} from "./permutation.utils.js";

import {
  calculateRoute,
} from "./route-calculator.service.js";


export function evaluateRoute(
  matrix: RoutingMatrix,
  route: CalculatedRoute,
  originIndex: number,
): RouteEvaluation {
  validateRoutingMatrix(matrix);
  let sharedDurationSeconds = 0;

  const passengerMetrics: PassengerRouteMetric[] = [];

  for (let i = 1; i < route.pointIds.length; i++) {
    const previousPointId = route.pointIds[i - 1];
    const currentPointId = route.pointIds[i];

    const previousPointIndex = matrix.points.findIndex(
      (point) => point.id === previousPointId,
    );

    const currentPointIndex = matrix.points.findIndex(
      (point) => point.id === currentPointId,
    );

    if (
      previousPointIndex === -1 ||
      currentPointIndex === -1
    ) {
      throw new Error(
        `Point not found: ${previousPointId} or ${currentPointId}.`,
      );
    }

    const segment = getRouteMetric(matrix, previousPointIndex, currentPointIndex);
    sharedDurationSeconds += segment.durationSeconds;

    const directMetric = getRouteMetric(matrix, originIndex, currentPointIndex);

    const directDurationSeconds =
      directMetric.durationSeconds;

    const extraDurationSeconds =
      sharedDurationSeconds - directDurationSeconds;

    passengerMetrics.push({
      pointId: currentPointId as string,
      directDurationSeconds,
      sharedDurationSeconds,
      extraDurationSeconds,
    });
  }

  const extraDurations = passengerMetrics.map(
    (metric) => metric.extraDurationSeconds,
  );

  const maxExtraDurationSeconds =
    extraDurations.length === 0
      ? 0
      : Math.max(...extraDurations);

  const totalExtraDurationSeconds =
    extraDurations.reduce(
      (total, duration) => total + duration,
      0,
    );

  const averageExtraDurationSeconds =
    extraDurations.length === 0
      ? 0
      : totalExtraDurationSeconds / extraDurations.length;

  return {
    route,
    passengerMetrics,
    maxExtraDurationSeconds,
    averageExtraDurationSeconds,
  };
}


export function evaluateRouteCandidates(
  matrix: RoutingMatrix,
  originIndex: number,
  passengerIndexes: number[],
): RouteCandidate[] {
  validateRoutingMatrix(matrix);
  const candidates: RouteCandidate[] = [];
  let unavailable: RouteUnavailableError | undefined;
  for (const permutation of generatePermutations(passengerIndexes)) {
    try {
      const route = calculateRoute(matrix, [originIndex, ...permutation]);
      candidates.push({route, evaluation: evaluateRoute(matrix, route, originIndex)});
    } catch (error) {
      if (!(error instanceof RouteUnavailableError)) throw error;
      unavailable = error;
    }
  }
  if (candidates.length === 0 && unavailable) throw unavailable;
  return candidates;
}
