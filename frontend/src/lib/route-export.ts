import type {Employee, OptimizationResponse, RouteGroup, RouteStop} from "../types/api";

export interface UberRoutePreview {
  groupNumber: number;
  ready: boolean;
  issues: string[];
  payload?: Record<string, unknown>;
}

export interface FinalRoute {
  groupNumber: number;
  origin: RouteStop;
  passengers: Employee[];
  stops: RouteStop[];
  metrics: Pick<RouteGroup, "totalDurationSeconds" | "totalDistanceMeters" | "averageExtraDurationSeconds" | "maxExtraDurationSeconds">;
  status: RouteGroup["status"];
  manuallyModified: boolean;
}

function e164(phone: string): string | undefined {
  const value = phone.replace(/[^\d+]/g, "");
  if (value.startsWith("+55") && /^\+55\d{10,11}$/.test(value)) return value;
  const digits = value.replace(/\D/g, "");
  if (/^[1-9]{2}9?\d{8}$/.test(digits)) return `+55${digits}`;
  return undefined;
}

function stopEmployee(stop: RouteStop, employees: Map<string, Employee>): Employee | undefined {
  return stop.employeeId ? employees.get(stop.employeeId) : undefined;
}

export function buildUberPreview(result: OptimizationResponse, employees: Employee[]): UberRoutePreview[] {
  const byId = new Map(employees.map(employee => [employee.id, employee]));
  return result.groups.map((group: RouteGroup) => {
    const issues: string[] = [];
    const stops = group.stops;
    const origin = stops[0];
    const destination = stops[stops.length - 1];
    if (!origin || origin.type !== "ORIGIN") issues.push("Origem ausente.");
    if (!destination || destination.type !== "EMPLOYEE") issues.push("Destino ausente.");
    const passengers = stops.slice(1).map(stop => stopEmployee(stop, byId));
    if (passengers.some(passenger => !passenger)) issues.push("Há passageiros sem cadastro completo.");
    const validPassengers = passengers.filter((passenger): passenger is Employee => Boolean(passenger));
    const phones = validPassengers.map(passenger => e164(passenger.phone));
    if (phones.some(phone => !phone)) issues.push("Há telefone que não pode ser convertido para E.164.");
    if (validPassengers.length > 4) issues.push("A rota excede quatro passageiros.");
    if (issues.length) return {groupNumber: group.groupNumber, ready: false, issues};
    const [primary, ...additional] = validPassengers;
    const location = (stop: RouteStop) => ({latitude: stop.latitude, longitude: stop.longitude, address: stop.name});
    const payload = {
      pickup: location(origin!),
      stops: stops.slice(1, -1).map(location),
      dropoff: location(destination!),
      guest: {first_name: primary!.name, phone_number: e164(primary!.phone)},
      additional_guests: additional.map(passenger => ({first_name: passenger.name, phone_number: e164(passenger.phone)})),
    };
    return {groupNumber: group.groupNumber, ready: true, issues: [], payload};
  });
}

export function finalRoutes(result: OptimizationResponse, employees: Employee[], manuallyModified = false): FinalRoute[] {
  const byId = new Map(employees.map(employee => [employee.id, employee]));
  return result.groups.flatMap(group => { const origin = group.stops[0]; if (!origin) return []; return [{groupNumber: group.groupNumber, origin, passengers: group.stops.slice(1).flatMap(stop => stop.employeeId ? (byId.get(stop.employeeId) ? [byId.get(stop.employeeId)!] : []) : []), stops: group.stops, metrics: {totalDurationSeconds: group.totalDurationSeconds, totalDistanceMeters: group.totalDistanceMeters, averageExtraDurationSeconds: group.averageExtraDurationSeconds, maxExtraDurationSeconds: group.maxExtraDurationSeconds}, status: group.status, manuallyModified}]; });
}

export function internalJson(result: OptimizationResponse, employees: Employee[]): string {
  return JSON.stringify({generatedAt: new Date().toISOString(), result, employees}, null, 2);
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function operationalCsv(result: OptimizationResponse, employees: Employee[]): string {
  const byId = new Map(employees.map(employee => [employee.id, employee]));
  const rows = [["grupo", "ordem", "funcionário", "telefone", "endereço", "latitude", "longitude", "status", "distância_m", "duração_s"]];
  for (const group of result.groups) group.stops.filter(stop => stop.type === "EMPLOYEE").forEach((stop, index) => {
    const employee = stop.employeeId ? byId.get(stop.employeeId) : undefined;
    rows.push([String(group.groupNumber), String(index + 1), stop.name, employee?.phone ?? "", employee?.address ?? "", String(stop.latitude), String(stop.longitude), group.status, String(group.totalDistanceMeters), String(group.totalDurationSeconds)]);
  });
  return rows.map(row => row.map(csvCell).join(",")).join("\n");
}

export function routeText(result: OptimizationResponse): string {
  return result.groups.map(group => [`ROTA ${group.groupNumber}`, "", ...group.stops.filter(stop => stop.type === "EMPLOYEE").map((stop, index) => `${index + 1}. ${stop.name}`), "", `${group.employees.length} passageiros`, `Distância: ${(group.totalDistanceMeters / 1000).toLocaleString("pt-BR", {maximumFractionDigits: 1})} km`, `Duração: ${(group.totalDurationSeconds / 60).toLocaleString("pt-BR", {maximumFractionDigits: 1})} min`].join("\n")).join("\n\n");
}
