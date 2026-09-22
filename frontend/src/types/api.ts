export type RouteStatus = "ACCEPTED" | "REJECTED";

export interface Employee {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
}

export interface EmployeeWriteInput {
  name: string;
  address: string;
  phone: string;
  latitude?: number;
  longitude?: number;
}

export interface GeocodingPreview {
  latitude: number;
  longitude: number;
}

export interface OptimizationEmployee {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface RouteStop {
  type: "ORIGIN" | "EMPLOYEE";
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  employeeId?: string;
}

export interface PassengerMetric {
  employeeId: string;
  name: string;
  directDurationSeconds: number;
  sharedDurationSeconds: number;
  extraDurationSeconds: number;
}

export interface RouteViolation {
  type: string;
  employeeId: string;
  name: string;
  actualValue: number;
  limit: number;
}

export interface RouteGroup {
  groupNumber: number;
  status: RouteStatus;
  acceptable: boolean;
  employees: OptimizationEmployee[];
  stops: RouteStop[];
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  averageExtraDurationSeconds: number;
  maxExtraDurationSeconds: number;
  passengerMetrics: PassengerMetric[];
  violations: RouteViolation[];
}

export interface OptimizationIssue {
  type: "UNROUTABLE_EMPLOYEE" | "UNAVAILABLE_GROUP";
  employeeId?: string;
  employee?: OptimizationEmployee;
  groupNumber?: number;
  employees?: OptimizationEmployee[];
  reason: string;
  relations: Array<{fromId: string; toId: string}>;
}

export interface OptimizationSummary {
  totalEmployees: number;
  totalGroups: number;
  acceptableGroups: number;
  rejectedGroups: number;
  unavailableGroups: number;
  unroutableEmployees: number;
  averageOccupancy: number;
}

export interface OptimizationResponse {
  groups: RouteGroup[];
  issues: OptimizationIssue[];
  summary: OptimizationSummary;
}

export interface ManualRouteInput {
  groupNumber: number;
  employeeIds: string[];
  stopOrder?: string[];
}

export interface ApiErrorBody {
  error?: string | {
    code?: string;
    message?: string;
  };
  message?: string;
}
