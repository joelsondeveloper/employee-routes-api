export interface GroupingPoint {
  id: string;
  latitude: number;
  longitude: number;
}

export interface GroupCompatibilityScore {
  directionScore: number;
  proximityScore: number;
  distanceScore: number;
  roadScore: number;
  finalScore: number;
}
export type CandidateCompatibilityScore = GroupCompatibilityScore & (
  | { routeAvailable: true }
  | { routeAvailable: false; unavailableRelations: import("../routing/routing.errors.js").UnavailableRoute[] }
);
