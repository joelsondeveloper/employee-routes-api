import type {OptimizationResponse, RouteGroup} from "../types/api";

export function resultCounts(result: OptimizationResponse): {employees: number; cars: number; accepted: number; attention: number; issues: number} {
  return {
    employees: result.summary.totalEmployees,
    cars: result.summary.totalGroups,
    accepted: result.summary.acceptableGroups,
    attention: result.summary.rejectedGroups,
    issues: result.issues.length,
  };
}

export function isAnomalousGroup(group: RouteGroup): boolean {
  return group.totalDistanceMeters > 500_000 || group.totalDurationSeconds > 3_600 * 4;
}
