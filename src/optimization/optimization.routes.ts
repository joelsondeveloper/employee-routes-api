import { Router, type Request, type Response } from "express";
import database from "../database/database.js";
import { company } from "../company/company.config.js";
import type { Employee } from "../employees/employee.types.js";
import { optimizeEmployeeRoutes } from "./employee-route-optimization.service.js";
import type { EmployeeRouteOptimizationResult, OptimizedEmployeeGroup, OptimizationIssue } from "./employee-route-optimization.types.js";
import {
  InvalidRoutingMatrixError,
  RouteUnavailableError,
  RoutingInputError,
  RoutingMatrixTooLargeError,
  RoutingProviderError,
} from "../routing/routing.errors.js";
import { LocationIQRoutingProvider } from "../routing/providers/locationiq-routing.provider.js";
import type { RoutingPoint, RoutingProvider } from "../routing/routing.types.js";
import type {
  HttpErrorResponse,
  OptimizationEmployeeResponse,
  OptimizationIssueResponse,
  OptimizationStopResponse,
  OptimizeRoutesResponse,
  PassengerMetricResponse,
  RouteGroupResponse,
  RouteViolationResponse,
} from "./optimization.http.types.js";
import { recalculateManualGroups, type ManualRouteGroupInput } from "./manual-route.service.js";

interface EmployeeStore {
  prepare(sql: string): {all(): unknown[]};
}

export interface OptimizationRouteDependencies {
  employeeStore?: EmployeeStore;
  routingProviderFactory?: () => RoutingProvider;
  optimize?: typeof optimizeEmployeeRoutes;
}

function employeeResponse(employee: Employee): OptimizationEmployeeResponse {
  return {
    id: employee.id,
    name: employee.name,
    latitude: employee.latitude,
    longitude: employee.longitude,
  };
}

function groupEmployeeMap(group: OptimizedEmployeeGroup): Map<string, Employee> {
  return new Map(group.employees.map((employee) => [employee.id, employee]));
}

function stopsForGroup(group: OptimizedEmployeeGroup, origin: RoutingPoint): OptimizationStopResponse[] {
  const employees = groupEmployeeMap(group);
  return group.stopOrder.map((id, index) => {
    if (index === 0 && id === origin.id) {
      return {
        type: "ORIGIN",
        id: origin.id,
        name: company.name,
        latitude: origin.latitude,
        longitude: origin.longitude,
      };
    }

    const employee = employees.get(id);
    if (!employee) throw new Error(`Optimization returned an unknown stop: ${id}.`);
    return {
      type: "EMPLOYEE",
      id: employee.id,
      employeeId: employee.id,
      name: employee.name,
      latitude: employee.latitude,
      longitude: employee.longitude,
    };
  });
}

function passengerMetricsForGroup(group: OptimizedEmployeeGroup): PassengerMetricResponse[] {
  const employees = groupEmployeeMap(group);
  return group.passengerMetrics.map((metric) => {
    const employee = employees.get(metric.pointId);
    if (!employee) throw new Error(`Optimization returned an unknown passenger: ${metric.pointId}.`);
    return {
      employeeId: employee.id,
      name: employee.name,
      directDurationSeconds: metric.directDurationSeconds,
      sharedDurationSeconds: metric.sharedDurationSeconds,
      extraDurationSeconds: metric.extraDurationSeconds,
    };
  });
}

function violationsForGroup(group: OptimizedEmployeeGroup): RouteViolationResponse[] {
  const employees = groupEmployeeMap(group);
  return group.violations.map((violation) => {
    const employee = employees.get(violation.pointId);
    if (!employee) throw new Error(`Optimization returned an unknown violation passenger: ${violation.pointId}.`);
    return {
      type: violation.type,
      employeeId: employee.id,
      name: employee.name,
      actualValue: violation.actualValue,
      limit: violation.limit,
    };
  });
}

function groupResponse(group: OptimizedEmployeeGroup, origin: RoutingPoint): RouteGroupResponse {
  return {
    groupNumber: group.groupNumber,
    status: group.acceptable ? "ACCEPTED" : "REJECTED",
    acceptable: group.acceptable,
    employees: group.employees.map(employeeResponse),
    stops: stopsForGroup(group, origin),
    totalDurationSeconds: group.totalDurationSeconds,
    totalDistanceMeters: group.totalDistanceMeters,
    averageExtraDurationSeconds: group.averageExtraDurationSeconds,
    maxExtraDurationSeconds: group.maxExtraDurationSeconds,
    passengerMetrics: passengerMetricsForGroup(group),
    violations: violationsForGroup(group),
  };
}

function issueResponse(issue: OptimizationIssue): OptimizationIssueResponse {
  if (issue.type === "UNROUTABLE_EMPLOYEE") {
    return {
      type: issue.type,
      employeeId: issue.employeeId,
      reason: issue.reason,
      relations: issue.relations,
    };
  }
  return {
    type: issue.type,
    groupNumber: issue.groupNumber,
    employees: issue.employees.map(employeeResponse),
    reason: issue.reason,
    relations: issue.relations,
  };
}

export function responseForResult(result: EmployeeRouteOptimizationResult, employees: Employee[], origin: RoutingPoint): OptimizeRoutesResponse {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const issues = result.issues.map((issue) => {
    const response = issueResponse(issue);
    if (issue.type === "UNROUTABLE_EMPLOYEE") {
      const employee = employeeById.get(issue.employeeId);
      if (employee) response.employee = employeeResponse(employee);
    }
    return response;
  });
  return {
    groups: result.groups.map((group) => groupResponse(group, origin)),
    issues,
    summary: result.summary,
  };
}

function errorResponse(error: unknown): {status: number; body: HttpErrorResponse} {
  if (error instanceof RoutingInputError) {
    return {status: 400, body: {error: {code: "INVALID_ROUTING_INPUT", message: "Os dados de roteamento são inválidos."}}};
  }
  if (error instanceof RoutingProviderError) {
    if (error.kind === "CONFIGURATION") {
      return {status: 500, body: {error: {code: "ROUTING_PROVIDER_CONFIGURATION", message: "O serviço de roteamento não está configurado."}}};
    }
    if (error.status === 408 || /timeout/i.test(error.message)) {
      return {status: 504, body: {error: {code: "ROUTING_PROVIDER_TIMEOUT", message: "O serviço de roteamento demorou além do esperado."}}};
    }
    return {status: 503, body: {error: {code: "ROUTING_PROVIDER_UNAVAILABLE", message: "Não foi possível calcular as rotas no momento."}}};
  }
  if (error instanceof RoutingMatrixTooLargeError || error instanceof InvalidRoutingMatrixError) {
    return {status: 502, body: {error: {code: "ROUTING_PROVIDER_RESPONSE_INVALID", message: "O serviço de roteamento retornou uma resposta inválida."}}};
  }
  if (error instanceof RouteUnavailableError) {
    return {status: 502, body: {error: {code: "ROUTE_UNAVAILABLE", message: "Não foi possível calcular as rotas solicitadas."}}};
  }
  return {status: 500, body: {error: {code: "INTERNAL_ERROR", message: "Ocorreu um erro interno."}}};
}

export function createOptimizationRouter(dependencies: OptimizationRouteDependencies = {}): Router {
  const router = Router();
  const employeeStore = dependencies.employeeStore ?? database;
  const makeProvider = dependencies.routingProviderFactory ?? (() => new LocationIQRoutingProvider());
  const runOptimization = dependencies.optimize ?? optimizeEmployeeRoutes;
  const inFlight = new Map<string, Promise<OptimizeRoutesResponse>>();

  router.post("/optimize", async (request: Request, response: Response) => {
    if (request.body === null || typeof request.body !== "object" || Array.isArray(request.body)) {
      return response.status(400).json({error: {code: "INVALID_REQUEST", message: "O corpo da requisição deve ser um objeto JSON."}} satisfies HttpErrorResponse);
    }
    const body = request.body as {employeeIds?: unknown};
    if (!("employeeIds" in body)) {
      return response.status(400).json({error: {code: "INVALID_REQUEST", message: "Informe employeeIds para definir quem participará da otimização."}} satisfies HttpErrorResponse);
    }
    if (!Array.isArray(body.employeeIds) || body.employeeIds.some((id) => typeof id !== "string" || !id.trim())) {
      return response.status(400).json({error: {code: "INVALID_REQUEST", message: "employeeIds deve ser um array de IDs válidos."}} satisfies HttpErrorResponse);
    }
    const employeeIds = body.employeeIds as string[];
    if (employeeIds.length === 0) {
      return response.status(400).json({error: {code: "INVALID_REQUEST", message: "Selecione ao menos um funcionário."}} satisfies HttpErrorResponse);
    }
    if (new Set(employeeIds).size !== employeeIds.length) {
      return response.status(400).json({error: {code: "INVALID_REQUEST", message: "employeeIds não pode conter IDs duplicados."}} satisfies HttpErrorResponse);
    }

    const key = [...employeeIds].sort().join("\u001f");
    let execution = inFlight.get(key);

    if (!execution) {
      execution = Promise.resolve().then(() => {
        const allEmployees = employeeStore.prepare(
          "SELECT id, name, address, phone, latitude, longitude FROM employees ORDER BY id",
        ).all() as Employee[];
        const byId = new Map(allEmployees.map((employee) => [employee.id, employee]));
        const missing = employeeIds.filter((id) => !byId.has(id));
        if (missing.length) {
          throw new Error(`Unknown employee IDs: ${missing.join(", ")}`);
        }
        const employees = employeeIds.map((id) => byId.get(id)!);
        const origin: RoutingPoint = {id: "company", ...company.coordinates};
        return runOptimization(origin, employees, makeProvider()).then((result) => responseForResult(result, employees, origin));
      }).finally(() => { inFlight.delete(key); });
      inFlight.set(key, execution);
    }

    try {
      return response.json(await execution);
    } catch (error) {
      console.error("Optimization request failed:", error instanceof Error ? error.name : "unknown error");
      const mapped = error instanceof Error && error.message.startsWith("Unknown employee IDs:")
        ? {status: 400, body: {error: {code: "EMPLOYEE_NOT_FOUND", message: "Um ou mais funcionários selecionados não existem."}} satisfies HttpErrorResponse}
        : errorResponse(error);
      return response.status(mapped.status).json(mapped.body);
    }
  });

  router.post("/recalculate", async (request: Request, response: Response) => {
    const body = request.body as {employeeIds?: unknown; groups?: unknown} | null;
    if (!body || !Array.isArray(body.employeeIds) || !Array.isArray(body.groups) ||
        body.employeeIds.some(id => typeof id !== "string" || !id.trim())) {
      return response.status(400).json({error: {code: "INVALID_REQUEST", message: "Informe employeeIds e groups válidos."}} satisfies HttpErrorResponse);
    }
    const employeeIds = body.employeeIds as string[];
    const allEmployees = employeeStore.prepare("SELECT id, name, address, phone, latitude, longitude FROM employees ORDER BY id").all() as Employee[];
    const byId = new Map(allEmployees.map(employee => [employee.id, employee]));
    if (employeeIds.some(id => !byId.has(id)) || new Set(employeeIds).size !== employeeIds.length) {
      return response.status(400).json({error: {code: "EMPLOYEE_NOT_FOUND", message: "A seleção contém funcionários inválidos ou duplicados."}} satisfies HttpErrorResponse);
    }
    const inputs = body.groups as ManualRouteGroupInput[];
    if (inputs.some(group => !group || typeof group.groupNumber !== "number" || !Array.isArray(group.employeeIds) || group.employeeIds.length > 4 || group.employeeIds.some(id => typeof id !== "string" || !employeeIds.includes(id)))) {
      return response.status(400).json({error: {code: "INVALID_REQUEST", message: "Os grupos manuais excedem a capacidade ou contêm funcionários inválidos."}} satisfies HttpErrorResponse);
    }
    const used = inputs.flatMap(group => group.employeeIds);
    if (new Set(used).size !== used.length || used.some(id => !employeeIds.includes(id))) {
      return response.status(400).json({error: {code: "INVALID_REQUEST", message: "Cada funcionário deve aparecer no máximo uma vez nos grupos."}} satisfies HttpErrorResponse);
    }
    try {
      const origin: RoutingPoint = {id: "company", ...company.coordinates};
      const selected = employeeIds.map(id => byId.get(id)!);
      const recalculated = await recalculateManualGroups(origin, selected, inputs, makeProvider());
      const result: EmployeeRouteOptimizationResult = {
        groups: recalculated.groups,
        issues: recalculated.issues,
        summary: {totalEmployees: selected.length, totalGroups: recalculated.groups.length, acceptableGroups: recalculated.groups.filter(group => group.acceptable).length,
          rejectedGroups: recalculated.groups.filter(group => !group.acceptable).length, unavailableGroups: recalculated.issues.filter(issue => issue.type === "UNAVAILABLE_GROUP").length,
          unroutableEmployees: 0, averageOccupancy: recalculated.groups.length ? selected.length / recalculated.groups.length : 0},
      };
      return response.json(responseForResult(result, selected, origin));
    } catch (error) {
      const mapped = errorResponse(error);
      return response.status(mapped.status).json(mapped.body);
    }
  });

  return router;
}
