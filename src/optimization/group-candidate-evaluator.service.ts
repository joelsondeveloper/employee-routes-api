import { RouteUnavailableError } from "../routing/routing.errors.js";
import { validateRoutingPoints, validateRoutingMatrix } from "../routing/routing-validation.service.js";
import type {
  RoutingPoint,
  RoutingProvider,
} from "../routing/routing.types.js";

import type {
  GroupingPoint,
  CandidateCompatibilityScore,
} from "./group-compatibility.types.js";

import {
  evaluateRouteCandidates,
} from "../routing/route-evaluator.service.js";

import {
  calculateRoadCompatibility,
  findBestRoadCandidate,
} from "./road-compatibility.service.js";

import {
  calculateGroupCompatibility,
} from "./group-compatibility.service.js";
import type { OptimizationBehaviorConfig } from "./optimization-behavior.config.js";
import { NORMAL_OPTIMIZATION_CONFIG } from "./optimization-behavior.config.js";

export async function evaluateCandidateForGroup(
  origin: GroupingPoint,
  candidate: GroupingPoint,
  group: GroupingPoint[],
  routingProvider: RoutingProvider,
  optimizationConfig: OptimizationBehaviorConfig = NORMAL_OPTIMIZATION_CONFIG,
): Promise<CandidateCompatibilityScore> {
  validateRoutingPoints([origin, ...group, candidate]);
  try {
  const passengers = [...group, candidate];

  const points: RoutingPoint[] = [
    {
      id: origin.id,
      latitude: origin.latitude,
      longitude: origin.longitude,
    },
    ...passengers.map((passenger) => ({
      id: passenger.id,
      latitude: passenger.latitude,
      longitude: passenger.longitude,
    })),
  ];

  const matrix = await routingProvider.getMatrix(points);

  validateRoutingMatrix(matrix, points);
  const originIndex = 0;

  const passengerIndexes = passengers.map(
    (_, index) => index + 1,
  );

  const routeCandidates = evaluateRouteCandidates(
    matrix,
    originIndex,
    passengerIndexes,
  );

  const bestRoadCandidate =
    findBestRoadCandidate(routeCandidates);

  const roadCompatibility =
    calculateRoadCompatibility(
      bestRoadCandidate.evaluation
        .averageExtraDurationSeconds,

      bestRoadCandidate.evaluation
        .maxExtraDurationSeconds,
      optimizationConfig,
    );

  return { ...calculateGroupCompatibility(
    origin,
    candidate,
    group,
    roadCompatibility.roadScore,
    optimizationConfig,
  ), routeAvailable: true };
  } catch (error) {
    if (!(error instanceof RouteUnavailableError)) throw error;
    return {directionScore: 0, proximityScore: 0, distanceScore: 0, roadScore: 0, finalScore: 0,
      routeAvailable: false, unavailableRelations: error.relations};
  }
}
