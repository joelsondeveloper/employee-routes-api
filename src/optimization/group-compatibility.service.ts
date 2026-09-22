import type {
  GroupingPoint,
  GroupCompatibilityScore,
} from "./group-compatibility.types.js";

import {
  GROUP_COMPATIBILITY_CONFIG,
} from "./group-compatibility.config.js";

import {
  calculateBearing,
  calculateDistance,
  calculateAngularDifference,
} from "../geography/geography.utils.js";

function normalizeDifference(
  value: number,
  maxValue: number,
): number {
  if (value >= maxValue) {
    return 0;
  }

  return (1 - value / maxValue) * 100;
}

function calculateDirectionScore(
  origin: GroupingPoint,
  candidate: GroupingPoint,
  group: GroupingPoint[],
): number {
  const candidateBearing = calculateBearing(
    origin,
    candidate,
  );

  const differences = group.map((member) => {
    const memberBearing = calculateBearing(
      origin,
      member,
    );

    return calculateAngularDifference(
      candidateBearing,
      memberBearing,
    );
  });

  const averageDifference =
    differences.reduce(
      (total, difference) => total + difference,
      0,
    ) / differences.length;

  return normalizeDifference(
    averageDifference,
    GROUP_COMPATIBILITY_CONFIG.maxDirectionDifference,
  );
}

function calculateProximityScore(
  candidate: GroupingPoint,
  group: GroupingPoint[],
): number {
  const distances = group.map((member) =>
    calculateDistance(
      candidate,
      member,
    ),
  );

  const averageDistance =
    distances.reduce(
      (sum, distance) => sum + distance,
      0,
    ) / distances.length;

  return normalizeDifference(
    averageDistance,
    GROUP_COMPATIBILITY_CONFIG.maxProximityKm,
  );
}

function calculateDistanceScore(
  origin: GroupingPoint,
  candidate: GroupingPoint,
  group: GroupingPoint[],
): number {
  const candidateDistance = calculateDistance(
    origin,
    candidate,
  );

  const groupDistances = group.map((member) =>
    calculateDistance(
      origin,
      member,
    ),
  );

  const averageGroupDistance =
    groupDistances.reduce(
      (sum, distance) => sum + distance,
      0,
    ) / groupDistances.length;

  const difference = Math.abs(
    candidateDistance - averageGroupDistance,
  );

  return normalizeDifference(
    difference,
    GROUP_COMPATIBILITY_CONFIG.maxDistanceDifferenceKm,
  );
}

export function calculateGroupCompatibility(
  origin: GroupingPoint,
  candidate: GroupingPoint,
  group: GroupingPoint[],
  roadScore: number,
): GroupCompatibilityScore {
  if (group.length === 0) {
    return {
      directionScore: 100,
      proximityScore: 100,
      distanceScore: 100,
      roadScore: 100,
      finalScore: 100,
    };
  }

  const directionScore =
    calculateDirectionScore(
      origin,
      candidate,
      group,
    );

  const proximityScore =
    calculateProximityScore(
      candidate,
      group,
    );

  const distanceScore =
    calculateDistanceScore(
      origin,
      candidate,
      group,
    );

  const finalScore =
    directionScore *
      GROUP_COMPATIBILITY_CONFIG.directionWeight +
    proximityScore *
      GROUP_COMPATIBILITY_CONFIG.proximityWeight +
    distanceScore *
      GROUP_COMPATIBILITY_CONFIG.distanceWeight +
    roadScore *
      GROUP_COMPATIBILITY_CONFIG.roadWeight;

  return {
    directionScore,
    proximityScore,
    distanceScore,
    roadScore,
    finalScore,
  };
}