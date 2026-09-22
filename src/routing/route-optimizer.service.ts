import type { CalculatedRoute, RoutingMatrix, RouteCandidate } from "./routing.types.js";

import { evaluateRouteCandidates } from "./route-evaluator.service.js";
export { evaluateRouteCandidates } from "./route-evaluator.service.js";

import { calculateRoute } from "./route-calculator.service.js";
import { generatePermutations } from "./permutation.utils.js";

export function findFastestRoute(
  matrix: RoutingMatrix,
  originIndex: number,
  passengerIndexes: number[],
): CalculatedRoute {
  const candidates = evaluateRouteCandidates(matrix, originIndex, passengerIndexes);

  let fastestRoute: CalculatedRoute | null = null;

  for (const candidate of candidates) {
    const route = candidate.route;

    console.log(
      route.pointIds.join(" → "),
      `${Math.round(route.totalDurationSeconds)}s`,
    );

    if (
      !fastestRoute ||
      route.totalDurationSeconds < fastestRoute.totalDurationSeconds
    ) {
      fastestRoute = route;
    }
  }

  if (!fastestRoute) {
    throw new Error("Could not calculate a route.");
  }

  return fastestRoute;
}
