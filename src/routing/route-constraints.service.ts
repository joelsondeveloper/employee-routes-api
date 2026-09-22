import type {
  RouteEvaluation,
  RouteValidation,
} from "./routing.types.js";

import { ROUTE_CONSTRAINTS_CONFIG }
  from "./route-constraints.config.js";

export function validateRoute(
  evaluation: RouteEvaluation,
): RouteValidation {
  const violations: RouteValidation["violations"] = [];

  for (const passenger of evaluation.passengerMetrics) {
    if (
      passenger.extraDurationSeconds >
      ROUTE_CONSTRAINTS_CONFIG.maxExtraDurationSeconds
    ) {
      violations.push({
        type: "MAX_EXTRA_DURATION",
        pointId: passenger.pointId,
        actualValue: passenger.extraDurationSeconds,
        limit:
          ROUTE_CONSTRAINTS_CONFIG.maxExtraDurationSeconds,
      });
    }
  }

  return {
    isAcceptable: violations.length === 0,
    violations,
  };
}