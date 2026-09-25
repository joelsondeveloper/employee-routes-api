import type { Employee } from "../employees/employee.types.js";
import type { CalculatedRoute, RouteEvaluation, RouteValidation } from "../routing/routing.types.js";
import type { OptimizationBehaviorConfig, OptimizationProfile } from "./optimization-behavior.config.js";

export interface OptimizedEmployeeGroup extends
  Pick<CalculatedRoute, "totalDurationSeconds" | "totalDistanceMeters">,
  Pick<RouteEvaluation, "averageExtraDurationSeconds" | "maxExtraDurationSeconds" | "passengerMetrics"> {
  groupNumber: number;
  employees: Employee[];
  /** IDs in visit order, including the origin as the first stop. */
  stopOrder: CalculatedRoute["pointIds"];
  acceptable: boolean;
  violations: RouteValidation["violations"];
}

export interface EmployeeRouteOptimizationResult {
  groups: OptimizedEmployeeGroup[];
  issues: OptimizationIssue[];
  summary: {
    totalEmployees: number;
    totalGroups: number;
    acceptableGroups: number;
    rejectedGroups: number;
    unavailableGroups: number;
    unroutableEmployees: number;
    /** Passengers per group, not a percentage. Zero for empty input. */
    averageOccupancy: number;
  };
  optimizationProfile?: OptimizationProfile;
  appliedOptimizationConfig?: OptimizationBehaviorConfig;
}

export type OptimizationIssue = (
  | { type: "UNROUTABLE_EMPLOYEE"; employeeId: string }
  | { type: "UNAVAILABLE_GROUP"; groupNumber: number; employees: Employee[] }
) & { reason: string; relations: import("../routing/routing.errors.js").UnavailableRoute[] };
