import assert from "node:assert/strict";
import {test} from "node:test";
import {CONSERVATIVE_OPTIMIZATION_CONFIG, NORMAL_OPTIMIZATION_CONFIG, OptimizationConfigurationError, optimizationConfigKey, resolveOptimizationConfig} from "./optimization-behavior.config.js";

test("defaults missing profile to the unchanged normal configuration", () => {
    const resolved = resolveOptimizationConfig();
    assert.equal(resolved.profile, "NORMAL");
    assert.deepEqual(resolved.config, NORMAL_OPTIMIZATION_CONFIG);
});

test("resolves the conservative preset without mutating normal", () => {
    const resolved = resolveOptimizationConfig("CONSERVATIVE");
    assert.deepEqual(resolved.config, CONSERVATIVE_OPTIMIZATION_CONFIG);
    assert.equal(NORMAL_OPTIMIZATION_CONFIG.minimumCompatibilityScore, 35);
});

test("validates and converts custom minute values to seconds", () => {
    const resolved = resolveOptimizationConfig("CUSTOM", {
      minimumCompatibilityScore: 52,
      maxDirectionDifference: 70,
      maxProximityKm: 8,
      maxDistanceDifferenceKm: 15,
      maxAverageExtraDurationMinutes: 12,
      maxExtraDurationMinutes: 20,
    });
    assert.deepEqual(resolved.config.roadCompatibility, {maxAverageExtraDurationSeconds: 720, maxExtraDurationSeconds: 1200});
});

for (const [profile, config] of [
    ["UNKNOWN", undefined], ["NORMAL", {minimumCompatibilityScore: 50}], ["CUSTOM", undefined],
  ] as const) test(`rejects invalid profile configuration ${profile}`, () => {
    assert.throws(() => resolveOptimizationConfig(profile, config), OptimizationConfigurationError);
  });

test("rejects out of range values and inverted road limits", () => {
    assert.throws(() => resolveOptimizationConfig("CUSTOM", {minimumCompatibilityScore: 101, maxDirectionDifference: 90, maxProximityKm: 10, maxDistanceDifferenceKm: 20, maxAverageExtraDurationMinutes: 20, maxExtraDurationMinutes: 30}));
    assert.throws(() => resolveOptimizationConfig("CUSTOM", {minimumCompatibilityScore: 35, maxDirectionDifference: 90, maxProximityKm: 10, maxDistanceDifferenceKm: 20, maxAverageExtraDurationMinutes: 30, maxExtraDurationMinutes: 20}));
});

test("produces different deterministic keys for different profiles", () => {
    assert.notEqual(optimizationConfigKey(resolveOptimizationConfig("NORMAL")), optimizationConfigKey(resolveOptimizationConfig("CONSERVATIVE")));
});
