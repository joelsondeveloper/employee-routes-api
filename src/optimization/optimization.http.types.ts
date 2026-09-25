export interface OptimizationEmployeeResponse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface OptimizationStopResponse {
  type: "ORIGIN" | "EMPLOYEE";
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  employeeId?: string;
}

export interface PassengerMetricResponse {
  employeeId: string;
  name: string;
  directDurationSeconds: number;
  sharedDurationSeconds: number;
  extraDurationSeconds: number;
}

export interface RouteViolationResponse {
  type: string;
  employeeId: string;
  name: string;
  actualValue: number;
  limit: number;
}

export interface RouteGroupResponse {
  groupNumber: number;
  status: "ACCEPTED" | "REJECTED";
  acceptable: boolean;
  employees: OptimizationEmployeeResponse[];
  stops: OptimizationStopResponse[];
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  averageExtraDurationSeconds: number;
  maxExtraDurationSeconds: number;
  passengerMetrics: PassengerMetricResponse[];
  violations: RouteViolationResponse[];
}

export interface OptimizationIssueResponse {
  type: "UNROUTABLE_EMPLOYEE" | "UNAVAILABLE_GROUP";
  employeeId?: string;
  employee?: OptimizationEmployeeResponse;
  groupNumber?: number;
  employees?: OptimizationEmployeeResponse[];
  reason: string;
  relations: Array<{fromId: string; toId: string}>;
}

export interface OptimizationSummaryResponse {
  totalEmployees: number;
  totalGroups: number;
  acceptableGroups: number;
  rejectedGroups: number;
  unavailableGroups: number;
  unroutableEmployees: number;
  averageOccupancy: number;
}

export type OptimizationProfileResponse = "NORMAL" | "CONSERVATIVE" | "CUSTOM";

export interface AppliedOptimizationConfigResponse {
  minimumCompatibilityScore: number;
  maxDirectionDifference: number;
  maxProximityKm: number;
  maxDistanceDifferenceKm: number;
  maxAverageExtraDurationSeconds: number;
  maxExtraDurationSeconds: number;
}

export interface OptimizeRoutesResponse {
  groups: RouteGroupResponse[];
  issues: OptimizationIssueResponse[];
  summary: OptimizationSummaryResponse;
  optimizationProfile?: OptimizationProfileResponse;
  appliedOptimizationConfig?: AppliedOptimizationConfigResponse;
}

export interface HttpErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
