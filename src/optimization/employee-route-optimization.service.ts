import { ExecutionRoutingProvider } from "../routing/execution-routing.provider.js";
import { RouteUnavailableError } from "../routing/routing.errors.js";
import { validateRoutingPoints, validateRoutingMatrix, getRouteMetric } from "../routing/routing-validation.service.js";
import type { Employee } from "../employees/employee.types.js";
import type { RoutingPoint, RoutingProvider } from "../routing/routing.types.js";
import type { EmployeeRouteOptimizationResult, OptimizedEmployeeGroup, OptimizationIssue } from "./employee-route-optimization.types.js";
import { analyzeEmployeeGeography } from "../employees/employee-geography.service.js";
import { createCandidateGroups } from "./grouping.service.js";
import { evaluateRouteCandidates } from "../routing/route-evaluator.service.js";
import { ScoredRouteCandidates, findBestScoredRoute, findBestScoredAttempt } from "../routing/route-score.service.js";

export async function optimizeEmployeeRoutes(
  origin: RoutingPoint,
  employees: Employee[],
  routingProvider: RoutingProvider,
): Promise<EmployeeRouteOptimizationResult> {
  validateRoutingPoints([origin, ...employees]);
  const executionProvider = new ExecutionRoutingProvider(routingProvider);
  await executionProvider.prepare([origin, ...employees]);
  const issues: OptimizationIssue[] = [];
  const routable: Employee[] = [];
  for (const employee of employees) {
    try {
      const points = [origin, employee];
      const matrix = await executionProvider.getMatrix(points);
      validateRoutingMatrix(matrix, points);
      getRouteMetric(matrix, 0, 1);
      routable.push(employee);
    } catch (error) {
      if (!(error instanceof RouteUnavailableError)) throw error;
      issues.push({type: "UNROUTABLE_EMPLOYEE", employeeId: employee.id,
        reason: error.message, relations: error.relations});
    }
  }
  const geography = routable.map(employee => analyzeEmployeeGeography(employee, origin));
  const candidates = await createCandidateGroups(origin, geography, executionProvider);
  const groups: OptimizedEmployeeGroup[] = [];

  for (const [index, group] of candidates.entries()) {
    const members = group.employees.map(item => item.employee);
    try {
    const matrix = await executionProvider.getMatrix([origin, ...members]);
    validateRoutingMatrix(matrix, [origin, ...members]);
    const routes = evaluateRouteCandidates(matrix, 0, members.map((_, i) => i + 1));
    const scored = ScoredRouteCandidates(routes);
    // Rejection is a valid result; routing/provider failures still propagate.
    const best = scored.some(route => route.validation.isAcceptable)
      ? findBestScoredRoute(scored)
      : findBestScoredAttempt(scored);
    const { route, evaluation } = best.candidate;
    groups.push({
      groupNumber: index + 1,
      employees: members,
      stopOrder: route.pointIds,
      acceptable: best.validation.isAcceptable,
      totalDurationSeconds: route.totalDurationSeconds,
      totalDistanceMeters: route.totalDistanceMeters,
      averageExtraDurationSeconds: evaluation.averageExtraDurationSeconds,
      maxExtraDurationSeconds: evaluation.maxExtraDurationSeconds,
      passengerMetrics: evaluation.passengerMetrics,
      violations: best.validation.violations,
    });
    } catch (error) {
      if (!(error instanceof RouteUnavailableError)) throw error;
      issues.push({type: "UNAVAILABLE_GROUP", groupNumber: index + 1, employees: members,
        reason: error.message, relations: error.relations});
    }
  }

  const acceptableGroups = groups.filter(group => group.acceptable).length;
  return {
    groups,
    issues,
    summary: {
      totalEmployees: employees.length,
      totalGroups: candidates.length,
      acceptableGroups,
      rejectedGroups: groups.length - acceptableGroups,
      unavailableGroups: issues.filter(issue => issue.type === "UNAVAILABLE_GROUP").length,
      unroutableEmployees: employees.length - routable.length,
      averageOccupancy: candidates.length === 0 ? 0 : routable.length / candidates.length,
    },
  };
}
