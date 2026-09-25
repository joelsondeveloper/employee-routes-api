import {Router, type Request, type Response} from "express";
import {company} from "../company/company.config.js";
import type {Employee} from "../employees/employee.types.js";
import {geocodeAddress} from "../geocoding/geocoding.service.js";
import {GeocodingNotFoundError, GeocodingProviderError} from "../geocoding/geocoding.errors.js";
import {logExternalProviderFailure} from "../external-provider.logging.js";
import {optimizeEmployeeRoutes} from "../optimization/employee-route-optimization.service.js";
import {recalculateManualGroups, type ManualRouteGroupInput} from "../optimization/manual-route.service.js";
import {optimizationErrorResponse, responseForResult} from "../optimization/optimization.routes.js";
import {LocationIQRoutingProvider} from "../routing/providers/locationiq-routing.provider.js";
import type {RoutingPoint, RoutingProvider} from "../routing/routing.types.js";
import type {GeocodingRouteDependencies} from "../geocoding/geocoding.routes.js";
import {DEMO_EMPLOYEES} from "../demo/demo-employees.js";
import {resolveOptimizationConfig} from "../optimization/optimization-behavior.config.js";

const MAX_EMPLOYEES = 12;
const MAX_STRING_LENGTH = 300;
const WINDOW_MS = 60_000;
const OPTIMIZE_LIMIT = 3;
const GEOCODE_LIMIT = 10;

interface RateBucket {count: number; resetAt: number}
export interface GuestRouteDependencies {
  employees?: readonly Employee[];
  optimize?: typeof optimizeEmployeeRoutes;
  routingProviderFactory?: () => RoutingProvider;
  geocoding?: GeocodingRouteDependencies;
  now?: () => number;
}

function clientKey(request: Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

function rateLimit(buckets: Map<string, RateBucket>, limit: number, now: () => number) {
  return (request: Request, response: Response, next: () => void): void => {
    const current = now();
    const key = clientKey(request);
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= current ? {count: 0, resetAt: current + WINDOW_MS} : existing;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > limit) {
      response.setHeader("Retry-After", Math.ceil((bucket.resetAt - current) / 1000));
      response.status(429).json({error: {code: "GUEST_RATE_LIMITED", message: "A demonstração recebeu muitas solicitações. Tente novamente em alguns instantes."}});
      return;
    }
    next();
  };
}

function validEmployee(value: unknown): value is Employee {
  if (!value || typeof value !== "object") return false;
  const keys = Object.keys(value);
  const allowedKeys = new Set(["id", "name", "address", "phone", "latitude", "longitude"]);
  if (keys.some((key) => !allowedKeys.has(key))) return false;
  const employee = value as Partial<Employee>;
  return typeof employee.id === "string" && employee.id.trim().length > 0 && employee.id.length <= 100 &&
    typeof employee.name === "string" && employee.name.trim().length > 0 && employee.name.length <= MAX_STRING_LENGTH &&
    typeof employee.address === "string" && employee.address.length <= MAX_STRING_LENGTH &&
    typeof employee.phone === "string" && employee.phone.length <= 60 &&
    typeof employee.latitude === "number" && Number.isFinite(employee.latitude) && employee.latitude >= -90 && employee.latitude <= 90 &&
    typeof employee.longitude === "number" && Number.isFinite(employee.longitude) && employee.longitude >= -180 && employee.longitude <= 180;
}

function parseEmployees(value: unknown): {employees?: Employee[]; error?: string} {
  if (!Array.isArray(value) || value.length === 0) return {error: "Informe ao menos um funcionário."};
  if (value.length > MAX_EMPLOYEES) return {error: `O modo visitante permite no máximo ${MAX_EMPLOYEES} funcionários por otimização.`};
  if (value.some((employee) => !validEmployee(employee))) return {error: "Cada funcionário deve conter dados e coordenadas válidos."};
  const employees = value as Employee[];
  if (new Set(employees.map((employee) => employee.id)).size !== employees.length) return {error: "A lista não pode conter funcionários duplicados."};
  return {employees};
}

function validateGroups(groups: unknown, employees: Employee[]): {groups?: ManualRouteGroupInput[]; error?: string} {
  if (!Array.isArray(groups)) return {error: "Informe grupos válidos."};
  const employeeIds = new Set(employees.map((employee) => employee.id));
  const used = new Set<string>();
  for (const group of groups) {
    if (!group || typeof group !== "object") return {error: "Os grupos possuem formato inválido."};
    const input = group as Partial<ManualRouteGroupInput>;
    const groupEmployeeIds = input.employeeIds;
    if (typeof input.groupNumber !== "number" || !Number.isInteger(input.groupNumber) || !Array.isArray(groupEmployeeIds) || groupEmployeeIds.length > 4 || groupEmployeeIds.some((id) => typeof id !== "string" || !employeeIds.has(id) || used.has(id))) return {error: "Os grupos contêm funcionários inválidos ou excedem a capacidade."};
    for (const id of groupEmployeeIds) used.add(id);
    if (input.stopOrder !== undefined) {
      if (!Array.isArray(input.stopOrder) || input.stopOrder.length !== groupEmployeeIds.length + 1 || input.stopOrder[0] !== "company" || new Set(input.stopOrder).size !== input.stopOrder.length || input.stopOrder.slice(1).some((id) => typeof id !== "string" || !groupEmployeeIds.includes(id))) return {error: "A ordem das paradas não corresponde aos passageiros."};
    }
  }
  return {groups: groups as ManualRouteGroupInput[]};
}

export function createGuestRouter(dependencies: GuestRouteDependencies = {}): Router {
  const employees = dependencies.employees ?? DEMO_EMPLOYEES;
  const optimize = dependencies.optimize ?? optimizeEmployeeRoutes;
  const makeProvider = dependencies.routingProviderFactory ?? (() => new LocationIQRoutingProvider());
  const geocode = dependencies.geocoding?.geocode ?? geocodeAddress;
  const now = dependencies.now ?? (() => Date.now());
  const optimizeBuckets = new Map<string, RateBucket>();
  const geocodeBuckets = new Map<string, RateBucket>();
  const router = Router();

  router.get("/employees", (_request, response) => response.json(employees));
  router.post("/geocoding/preview", rateLimit(geocodeBuckets, GEOCODE_LIMIT, now), async (request, response) => {
    const address = request.body?.address;
    if (typeof address !== "string" || !address.trim() || address.length > MAX_STRING_LENGTH) return response.status(400).json({error: {code: "INVALID_GEOCODING_INPUT", message: "Informe um endereço válido para localizar."}});
    try { return response.json(await geocode(address.trim())); }
    catch (error) {
      if (error instanceof GeocodingNotFoundError) return response.status(404).json({error: {code: "GEOCODING_NOT_FOUND", message: "Não encontramos esse endereço."}});
      if (error instanceof GeocodingProviderError) { logExternalProviderFailure("GEOCODING_FAILED", "LocationIQ", error, error.status); return response.status(502).json({error: {code: "GEOCODING_PROVIDER_UNAVAILABLE", message: "O serviço de localização está temporariamente indisponível."}}); }
      logExternalProviderFailure("GEOCODING_FAILED", "LocationIQ", error);
      return response.status(500).json({error: {code: "INTERNAL_ERROR", message: "Não foi possível localizar o endereço."}});
    }
  });

  router.post("/routes/optimize", rateLimit(optimizeBuckets, OPTIMIZE_LIMIT, now), async (request, response) => {
    const parsed = parseEmployees(request.body?.employees);
    if (parsed.error) return response.status(400).json({error: {code: "INVALID_GUEST_REQUEST", message: parsed.error}});
    const selected = parsed.employees!;
    let resolvedConfig;
    try { resolvedConfig = resolveOptimizationConfig(request.body?.optimizationProfile, request.body?.optimizationConfig); }
    catch (error) {
      const mapped = optimizationErrorResponse(error);
      return response.status(mapped.status).json(mapped.body);
    }
    try {
      const origin: RoutingPoint = {id: "company", ...company.coordinates};
      const result = await optimize(origin, selected, makeProvider(), resolvedConfig.config, resolvedConfig.profile);
      return response.json(responseForResult(result, selected, origin));
    } catch (error) {
      const mapped = optimizationErrorResponse(error);
      return response.status(mapped.status).json(mapped.body);
    }
  });

  router.post("/routes/recalculate", rateLimit(optimizeBuckets, OPTIMIZE_LIMIT, now), async (request, response) => {
    const parsed = parseEmployees(request.body?.employees);
    if (parsed.error) return response.status(400).json({error: {code: "INVALID_GUEST_REQUEST", message: parsed.error}});
    const selected = parsed.employees!;
    const parsedGroups = validateGroups(request.body?.groups, selected);
    if (parsedGroups.error) return response.status(400).json({error: {code: "INVALID_GUEST_REQUEST", message: parsedGroups.error}});
    let resolvedConfig;
    try { resolvedConfig = resolveOptimizationConfig(request.body?.optimizationProfile, request.body?.optimizationConfig); }
    catch (error) {
      const mapped = optimizationErrorResponse(error);
      return response.status(mapped.status).json(mapped.body);
    }
    try {
      const origin: RoutingPoint = {id: "company", ...company.coordinates};
      const result = await recalculateManualGroups(origin, selected, parsedGroups.groups!, makeProvider());
      const summary = {totalEmployees: selected.length, totalGroups: result.groups.length, acceptableGroups: result.groups.filter((group) => group.acceptable).length, rejectedGroups: result.groups.filter((group) => !group.acceptable).length, unavailableGroups: result.issues.filter((issue) => issue.type === "UNAVAILABLE_GROUP").length, unroutableEmployees: result.issues.filter((issue) => issue.type === "UNROUTABLE_EMPLOYEE").length, averageOccupancy: result.groups.length ? result.groups.reduce((sum, group) => sum + group.employees.length, 0) / result.groups.length : 0};
      return response.json(responseForResult({...result, summary, optimizationProfile: resolvedConfig.profile, appliedOptimizationConfig: resolvedConfig.config}, selected, origin));
    } catch (error) {
      const mapped = optimizationErrorResponse(error);
      return response.status(mapped.status).json(mapped.body);
    }
  });
  return router;
}


