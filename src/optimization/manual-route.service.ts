import type { Employee } from "../employees/employee.types.js";
import { ExecutionRoutingProvider } from "../routing/execution-routing.provider.js";
import { RouteUnavailableError } from "../routing/routing.errors.js";
import { calculateRoute } from "../routing/route-calculator.service.js";
import { evaluateRoute, evaluateRouteCandidates } from "../routing/route-evaluator.service.js";
import { ScoredRouteCandidates, findBestScoredAttempt, findBestScoredRoute } from "../routing/route-score.service.js";
import { validateRoute } from "../routing/route-constraints.service.js";
import { validateRoutingMatrix } from "../routing/routing-validation.service.js";
import type { RoutingPoint, RoutingProvider } from "../routing/routing.types.js";
import type { OptimizedEmployeeGroup, OptimizationIssue } from "./employee-route-optimization.types.js";

export interface ManualRouteGroupInput {
  groupNumber: number;
  employeeIds: string[];
  stopOrder?: string[];
}

export async function recalculateManualGroups(
  origin: RoutingPoint,
  employees: Employee[],
  inputs: ManualRouteGroupInput[],
  routingProvider: RoutingProvider,
): Promise<{groups: OptimizedEmployeeGroup[]; issues: OptimizationIssue[]}> {
  const byId = new Map(employees.map(employee => [employee.id, employee]));
  const executionProvider = new ExecutionRoutingProvider(routingProvider);
  await executionProvider.prepare([origin, ...employees]);
  const groups: OptimizedEmployeeGroup[] = [];
  const issues: OptimizationIssue[] = [];

  for (const input of inputs) {
    const members = input.employeeIds.map(id => byId.get(id));
    if (members.some((employee): employee is undefined => !employee)) {
      throw new Error("Manual route contains an unknown employee.");
    }
    const passengers = members as Employee[];
    if (passengers.length > 4) throw new Error("A route cannot contain more than four passengers.");
    if (passengers.length === 0) continue;
    const points = [origin, ...passengers];
    try {
      const matrix = await executionProvider.getMatrix(points);
      validateRoutingMatrix(matrix, points);
      let route;
      let evaluation;
      let acceptable: boolean;
      let violations;
      if (input.stopOrder?.length) {
        const orderedIds = input.stopOrder;
        if (orderedIds.length !== passengers.length + 1 || orderedIds[0] !== origin.id || new Set(orderedIds).size !== orderedIds.length || orderedIds.slice(1).some(id => !input.employeeIds.includes(id))) {
          throw new Error("Manual stop order does not match the group passengers.");
        }
        const indexes = orderedIds.map(id => matrix.points.findIndex(point => point.id === id));
        if (indexes.some(index => index < 0)) throw new Error("Manual stop order contains an unknown point.");
        route = calculateRoute(matrix, indexes);
        evaluation = evaluateRoute(matrix, route, 0);
        const validation = validateRoute(evaluation);
        acceptable = validation.isAcceptable;
        violations = validation.violations;
      } else {
        const candidates = ScoredRouteCandidates(evaluateRouteCandidates(matrix, 0, passengers.map((_, index) => index + 1)));
        const best = candidates.some(candidate => candidate.validation.isAcceptable)
          ? findBestScoredRoute(candidates)
          : findBestScoredAttempt(candidates);
        route = best.candidate.route;
        evaluation = best.candidate.evaluation;
        acceptable = best.validation.isAcceptable;
        violations = best.validation.violations;
      }
      groups.push({groupNumber: input.groupNumber, employees: passengers, stopOrder: route.pointIds, acceptable,
        totalDurationSeconds: route.totalDurationSeconds, totalDistanceMeters: route.totalDistanceMeters,
        averageExtraDurationSeconds: evaluation.averageExtraDurationSeconds, maxExtraDurationSeconds: evaluation.maxExtraDurationSeconds,
        passengerMetrics: evaluation.passengerMetrics, violations});
    } catch (error) {
      if (!(error instanceof RouteUnavailableError)) throw error;
      issues.push({type: "UNAVAILABLE_GROUP", groupNumber: input.groupNumber, employees: passengers, reason: error.message, relations: error.relations});
    }
  }
  return {groups, issues};
}
