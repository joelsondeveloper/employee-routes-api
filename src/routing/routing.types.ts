export interface RoutingPoint {
    id: string;
    latitude: number;
    longitude: number;
}

export interface RouteMetrics {
    distanceMeters: number;
    durationSeconds: number;
}

export interface RoutingMatrix {
    points: RoutingPoint[];
    /** null means confirmed absence of route; missing cells are invalid. */
    metrics: (RouteMetrics | null)[][];
}

export interface RoutingProvider {
    getMatrix(
        points: RoutingPoint[]
    ): Promise<RoutingMatrix>;
}

export interface CalculatedRoute {
    pointIds: string[];
    totalDistanceMeters: number;
    totalDurationSeconds: number;
}

export interface PassengerRouteMetric {
    pointId: string;
    
    directDurationSeconds: number;
    sharedDurationSeconds: number;
    extraDurationSeconds: number;
}

export interface RouteEvaluation {
    route: CalculatedRoute;
    
    passengerMetrics: PassengerRouteMetric[];

    maxExtraDurationSeconds: number;
    averageExtraDurationSeconds: number;
}

export interface RouteCandidate {
  route: CalculatedRoute;
  evaluation: RouteEvaluation;
}

export interface RouteScore {
  efficiencyScore: number;
  averageDetourScore: number;
  maxDetourScore: number;
  finalScore: number;
}

export interface ScoredRouteCandidate {
  candidate: RouteCandidate;
  score: RouteScore;
  validation: RouteValidation;
}

export interface RouteConstraintViolation {
  type: "MAX_EXTRA_DURATION";
  pointId: string;
  actualValue: number;
  limit: number;
}

export interface RouteValidation {
  isAcceptable: boolean;
  violations: RouteConstraintViolation[];
}