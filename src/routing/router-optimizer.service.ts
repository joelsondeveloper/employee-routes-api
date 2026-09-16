import type { CalculatedRoute, RoutingMatrix } from "./routing.types.js";

import { calculateRoute } from "./route-calculator.service.js";
import { generatePermutations } from "./permutation.utils.js";

export function findFastedRoute(
  matrix: RoutingMatrix,
  originIndex: number,
  passengerIndexes: number[],
): CalculatedRoute {
  const permutations = generatePermutations(passengerIndexes);

  let fastestRoute: CalculatedRoute | null = null;

  for (const permutation of permutations) {
    const routeIndexes = [originIndex, ...permutation];

    const route = calculateRoute(matrix, routeIndexes);

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
