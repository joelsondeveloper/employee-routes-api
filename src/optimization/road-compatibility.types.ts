export interface RoadCompatibilityScore {
  averageDetourScore: number;
  maxDetourScore: number;
  roadScore: number;

  averageExtraDurationSeconds: number;
  maxExtraDurationSeconds: number;
}