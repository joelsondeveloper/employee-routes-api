import type {
  RouteCandidate,
} from "../routing/routing.types.js";

import type {
  RoadCompatibilityScore,
} from "./road-compatibility.types.js";

import {
  ROAD_COMPATIBILITY_CONFIG,
} from "./road-compatibility.config.js";

function normalizeLowerIsBetterAbsoluteValue(
  value: number,
  maxValue: number,
): number {
  if (value <= 0) {
    return 100;
  }

  if (value >= maxValue) {
    return 0;
  }

  return (1 - value / maxValue) * 100;
}

export function calculateRoadCompatibility(
  averageExtraDurationSeconds: number,
  maxExtraDurationSeconds: number,
): RoadCompatibilityScore {
  const averageDetourScore =
    normalizeLowerIsBetterAbsoluteValue(
      averageExtraDurationSeconds,
      ROAD_COMPATIBILITY_CONFIG.maxAverageExtraDurationSeconds,
    );

  const maxDetourScore =
    normalizeLowerIsBetterAbsoluteValue(
      maxExtraDurationSeconds,
      ROAD_COMPATIBILITY_CONFIG.maxExtraDurationSeconds,
    );

  const roadScore =
    averageDetourScore *
      ROAD_COMPATIBILITY_CONFIG.averageDetourWeight +
    maxDetourScore *
      ROAD_COMPATIBILITY_CONFIG.maxDetourWeight;

  return {
    averageDetourScore,
    maxDetourScore,
    roadScore,
    averageExtraDurationSeconds,
    maxExtraDurationSeconds,
  };
}

export function findBestRoadCandidate(
  candidates: RouteCandidate[],
): RouteCandidate {
  if (candidates.length === 0) {
    throw new Error("No route candidate was provided.");
  }

  let bestCandidate = candidates[0]!;

  for (const candidate of candidates.slice(1)) {
    const candidateMaxExtra =
      candidate.evaluation.maxExtraDurationSeconds;

    const bestMaxExtra =
      bestCandidate.evaluation.maxExtraDurationSeconds;

    if (candidateMaxExtra < bestMaxExtra) {
      bestCandidate = candidate;
      continue;
    }

    if (candidateMaxExtra > bestMaxExtra) {
      continue;
    }

    const candidateAverageExtra =
      candidate.evaluation.averageExtraDurationSeconds;

    const bestAverageExtra =
      bestCandidate.evaluation.averageExtraDurationSeconds;

    if (candidateAverageExtra < bestAverageExtra) {
      bestCandidate = candidate;
      continue;
    }

    if (candidateAverageExtra > bestAverageExtra) {
      continue;
    }

    if (
      candidate.route.totalDurationSeconds <
      bestCandidate.route.totalDurationSeconds
    ) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}