import type {ApiErrorBody, AuthSession, Employee, EmployeeWriteInput, GeocodingPreview, OptimizationResponse, ManualRouteInput} from "../types/api";

// In production the Vercel deployment proxies API paths to Railway. Keeping
// this empty makes the browser request the proxy on its own origin, so the
// HttpOnly session cookie is first-party. Development can still use a direct
// API URL when needed.
const configuredApiUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || "http://localhost:3000")
  : "";
const API_URL = configuredApiUrl.replace(/\/$/, "");
let authToken: string | undefined;

export function setApiAuthToken(token: string | undefined): void { authToken = token; }

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string, message?: string) {
    super(message || "Não foi possível concluir a operação.");
    this.name = "ApiError";
  }
}

// The employee CRUD predates the structured error contract of /api/routes.
function errorCode(body: ApiErrorBody | undefined, path: string, status: number): string | undefined {
  if (body?.error && typeof body.error === "object") return body.error.code;
  if (path === "/api/geocoding/preview") {
    if (status === 404) return "GEOCODING_NOT_FOUND";
    if (status === 502) return "GEOCODING_PROVIDER_UNAVAILABLE";
    if (status === 400) return "INVALID_GEOCODING_INPUT";
  }
  if (path.startsWith("/employees")) {
    if (status === 404) return "EMPLOYEE_NOT_FOUND";
    if (status === 502) return "GEOCODING_UNAVAILABLE";
    const message = typeof body?.error === "string" ? body.error : body?.message;
    if (message === "Address not found" || message === "Address not found.") return "ADDRESS_NOT_FOUND";
    if (status === 400) return "INVALID_EMPLOYEE";
  }
  return status >= 500 ? "INTERNAL_ERROR" : undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? {"Content-Type": "application/json"} : {}),
        ...(authToken ? {Authorization: `Bearer ${authToken}`} : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR");
  }
  if (response.status === 204) return undefined as T;

  let body: unknown;
  try { body = await response.json(); }
  catch { throw new ApiError(response.status, "INVALID_RESPONSE"); }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("employee-routes-auth-expired"));
    throw new ApiError(response.status, errorCode(body as ApiErrorBody, path, response.status));
  }
  return body as T;
}

export const api = {
  health: () => request<{status: string}>("/health"),
  optimizeRoutes: (employeeIds: string[]) => request<OptimizationResponse>("/api/routes/optimize", {method: "POST", body: JSON.stringify({employeeIds})}),
  recalculateRoutes: (employeeIds: string[], groups: ManualRouteInput[]) => request<OptimizationResponse>("/api/routes/recalculate", {method: "POST", body: JSON.stringify({employeeIds, groups})}),
  listDemoEmployees: () => request<Employee[]>("/api/demo/employees"),
  optimizeDemoRoutes: (employeeIds: string[]) => request<OptimizationResponse>("/api/demo/routes/optimize", {method: "POST", body: JSON.stringify({employeeIds})}),
  recalculateDemoRoutes: (employeeIds: string[], groups: ManualRouteInput[]) => request<OptimizationResponse>("/api/demo/routes/recalculate", {method: "POST", body: JSON.stringify({employeeIds, groups})}),
  listEmployees: () => request<Employee[]>("/employees"),
  createEmployee: (input: EmployeeWriteInput) =>
    request<Employee>("/employees", {method: "POST", body: JSON.stringify(input)}),
  updateEmployee: (id: string, input: EmployeeWriteInput) =>
    request<Employee>(`/employees/${encodeURIComponent(id)}`, {method: "PUT", body: JSON.stringify(input)}),
  deleteEmployee: (id: string) =>
    request<void>(`/employees/${encodeURIComponent(id)}`, {method: "DELETE"}),
  geocodePreview: (address: string) =>
    request<GeocodingPreview>("/api/geocoding/preview", {method: "POST", body: JSON.stringify({address})}),
  googleLogin: (credential: string) => request<AuthSession>("/api/auth/google", {method: "POST", body: JSON.stringify({credential})}),
  currentUser: () => request<AuthSession>("/api/auth/me"),
  logout: () => request<void>("/api/auth/logout", {method: "POST"}),
};
