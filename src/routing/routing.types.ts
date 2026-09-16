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
    metrics: RouteMetrics[][];
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