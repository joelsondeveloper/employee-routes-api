import { GROUP_COMPATIBILITY_CONFIG } from "./group-compatibility.config.js";
import { GROUPING_CONFIG } from "./grouping.config.js";
import { ROAD_COMPATIBILITY_CONFIG } from "./road-compatibility.config.js";

export type OptimizationProfile = "NORMAL" | "CONSERVATIVE" | "CUSTOM";

/** Per-execution grouping tolerances. Weights, capacity and final constraints stay internal. */
export interface OptimizationBehaviorConfig {
  minimumCompatibilityScore: number;
  maxDirectionDifference: number;
  maxProximityKm: number;
  maxDistanceDifferenceKm: number;
  roadCompatibility: {
    maxAverageExtraDurationSeconds: number;
    maxExtraDurationSeconds: number;
  };
}

export interface OptimizationRequestConfig {
  minimumCompatibilityScore?: unknown;
  maxDirectionDifference?: unknown;
  maxProximityKm?: unknown;
  maxDistanceDifferenceKm?: unknown;
  maxAverageExtraDurationMinutes?: unknown;
  maxExtraDurationMinutes?: unknown;
}

export interface ResolvedOptimizationConfig {
  profile: OptimizationProfile;
  config: OptimizationBehaviorConfig;
}

export class OptimizationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OptimizationConfigurationError";
  }
}

export const NORMAL_OPTIMIZATION_CONFIG: OptimizationBehaviorConfig = Object.freeze({
  minimumCompatibilityScore: GROUPING_CONFIG.minimumCompatibilityScore,
  maxDirectionDifference: GROUP_COMPATIBILITY_CONFIG.maxDirectionDifference,
  maxProximityKm: GROUP_COMPATIBILITY_CONFIG.maxProximityKm,
  maxDistanceDifferenceKm: GROUP_COMPATIBILITY_CONFIG.maxDistanceDifferenceKm,
  roadCompatibility: Object.freeze({
    maxAverageExtraDurationSeconds: ROAD_COMPATIBILITY_CONFIG.maxAverageExtraDurationSeconds,
    maxExtraDurationSeconds: ROAD_COMPATIBILITY_CONFIG.maxExtraDurationSeconds,
  }),
});

export const CONSERVATIVE_OPTIMIZATION_CONFIG: OptimizationBehaviorConfig = Object.freeze({
  minimumCompatibilityScore: 45,
  maxDirectionDifference: 60,
  maxProximityKm: 8,
  maxDistanceDifferenceKm: 20,
  roadCompatibility: Object.freeze({
    maxAverageExtraDurationSeconds: 15 * 60,
    maxExtraDurationSeconds: 25 * 60,
  }),
});

const CUSTOM_KEYS = new Set([
  "minimumCompatibilityScore", "maxDirectionDifference", "maxProximityKm", "maxDistanceDifferenceKm",
  "maxAverageExtraDurationMinutes", "maxExtraDurationMinutes",
]);

function finiteNumber(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new OptimizationConfigurationError(`${name} must be a finite number between ${min} and ${max}.`);
  }
  return value;
}

export function resolveOptimizationConfig(profileValue?: unknown, customValue?: unknown): ResolvedOptimizationConfig {
  const profile = profileValue === undefined ? "NORMAL" : profileValue;
  if (profile !== "NORMAL" && profile !== "CONSERVATIVE" && profile !== "CUSTOM") {
    throw new OptimizationConfigurationError("optimizationProfile must be NORMAL, CONSERVATIVE or CUSTOM.");
  }
  if (profile === "NORMAL") {
    if (customValue !== undefined) throw new OptimizationConfigurationError("optimizationConfig is only valid with CUSTOM.");
    return {profile, config: NORMAL_OPTIMIZATION_CONFIG};
  }
  if (profile === "CONSERVATIVE") {
    if (customValue !== undefined) throw new OptimizationConfigurationError("optimizationConfig is only valid with CUSTOM.");
    return {profile, config: CONSERVATIVE_OPTIMIZATION_CONFIG};
  }
  if (!customValue || typeof customValue !== "object" || Array.isArray(customValue)) {
    throw new OptimizationConfigurationError("CUSTOM requires optimizationConfig.");
  }
  const input = customValue as OptimizationRequestConfig;
  if (Object.keys(input).some((key) => !CUSTOM_KEYS.has(key))) {
    throw new OptimizationConfigurationError("optimizationConfig contains unsupported fields.");
  }
  const averageMinutes = finiteNumber(input.maxAverageExtraDurationMinutes, "maxAverageExtraDurationMinutes", 5, 60);
  const maxMinutes = finiteNumber(input.maxExtraDurationMinutes, "maxExtraDurationMinutes", 5, 90);
  if (maxMinutes < averageMinutes) throw new OptimizationConfigurationError("maxExtraDurationMinutes must be greater than or equal to maxAverageExtraDurationMinutes.");
  return {
    profile,
    config: Object.freeze({
      minimumCompatibilityScore: finiteNumber(input.minimumCompatibilityScore, "minimumCompatibilityScore", 0, 100),
      maxDirectionDifference: finiteNumber(input.maxDirectionDifference, "maxDirectionDifference", 10, 180),
      maxProximityKm: finiteNumber(input.maxProximityKm, "maxProximityKm", 1, 30),
      maxDistanceDifferenceKm: finiteNumber(input.maxDistanceDifferenceKm, "maxDistanceDifferenceKm", 1, 50),
      roadCompatibility: Object.freeze({
        maxAverageExtraDurationSeconds: averageMinutes * 60,
        maxExtraDurationSeconds: maxMinutes * 60,
      }),
    }),
  };
}

export function optimizationConfigKey(resolved: ResolvedOptimizationConfig): string {
  return JSON.stringify([resolved.profile, resolved.config.minimumCompatibilityScore, resolved.config.maxDirectionDifference,
    resolved.config.maxProximityKm, resolved.config.maxDistanceDifferenceKm,
    resolved.config.roadCompatibility.maxAverageExtraDurationSeconds, resolved.config.roadCompatibility.maxExtraDurationSeconds]);
}
