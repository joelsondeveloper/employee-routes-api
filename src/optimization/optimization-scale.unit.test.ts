import assert from "node:assert/strict";
import {test} from "node:test";
import {company} from "../company/company.config.js";
import type {Employee} from "../employees/employee.types.js";
import {calculateDistance} from "../geography/geography.utils.js";
import {ExecutionRoutingProvider} from "../routing/execution-routing.provider.js";
import {OptimizationBudgetExceededError} from "../routing/routing.errors.js";
import type {RoutingPoint, RoutingProvider} from "../routing/routing.types.js";
import {optimizeEmployeeRoutes} from "./employee-route-optimization.service.js";
import {optimizationErrorResponse} from "./optimization.routes.js";

const origin: RoutingPoint = {id: "company", ...company.coordinates};

/** Deterministic employees within ~22 km of the company (same generator as the audit measurement). */
function employees(count: number): Employee[] {
  let seed = 42;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({length: count}, (_, index) => ({
    id: `e${index}`, name: `E${index}`, address: "", phone: "",
    latitude: origin.latitude + (random() - 0.5) * 0.4,
    longitude: origin.longitude + (random() - 0.5) * 0.4,
  }));
}

/** Road-like metrics derived only from coordinates, so every strategy sees the same matrix. */
function countingProvider(): RoutingProvider & {calls: number; largest: number} {
  const provider = {
    calls: 0,
    largest: 0,
    async getMatrix(points: RoutingPoint[]) {
      provider.calls++;
      provider.largest = Math.max(provider.largest, points.length);
      return {points, metrics: points.map((a) => points.map((b) => {
        const km = calculateDistance(a, b);
        return {distanceMeters: km * 1300, durationSeconds: (km * 1300) / 8};
      }))};
    },
  };
  return provider;
}

for (const [count, maxCalls] of [[40, 10], [100, 40]] as const) {
  test(`${count} employees need at most ${maxCalls} Matrix requests with the measured 25-point limit`, async () => {
    const provider = countingProvider();
    const result = await optimizeEmployeeRoutes(origin, employees(count), provider);
    assert.ok(provider.calls <= maxCalls, `${provider.calls} calls`);
    assert.ok(provider.largest <= 25);
    assert.equal(result.diagnostics?.externalCalls, provider.calls);
    assert.equal(result.groups.flatMap((group) => group.employees).length + result.summary.unroutableEmployees, count);
  });
}

test("documents the cost with a six-point limit (fallback if a plan ever lowers it)", async () => {
  // Kept as a record for docs/adr/0001: the strategy stays correct, only slower.
  const observed: Record<number, number> = {};
  for (const count of [40, 100]) {
    const provider = countingProvider();
    await optimizeEmployeeRoutes(origin, employees(count), provider, undefined, undefined, {maxPoints: 6});
    assert.ok(provider.largest <= 6);
    observed[count] = provider.calls;
  }
  // Blocks of 3 -> C(⌈41/3⌉,2) = 91 and C(⌈101/3⌉,2) = 561 requests.
  assert.deepEqual(observed, {40: 91, 100: 561});
});

test("grouping and routes are identical whatever the batch size", async () => {
  const selected = employees(40);
  const strip = ({diagnostics: _ignored, ...rest}: Awaited<ReturnType<typeof optimizeEmployeeRoutes>>) => rest;
  const wide = strip(await optimizeEmployeeRoutes(origin, selected, countingProvider()));
  const narrow = strip(await optimizeEmployeeRoutes(origin, selected, countingProvider(), undefined, undefined, {maxPoints: 6}));
  assert.deepEqual(wide, narrow);
  assert.ok(wide.groups.length > 1);
});

test("the execution stops with a typed error once its time budget is spent", async () => {
  let clock = 0;
  const slow: RoutingProvider = {async getMatrix(points) { clock += 1_000; return countingProvider().getMatrix(points); }};
  const execution = new ExecutionRoutingProvider(slow, {maxPoints: 6, budgetMs: 2_500, now: () => clock});
  const points = [origin, ...employees(20)];
  await assert.rejects(execution.prepare(points), (error: unknown) => {
    assert.ok(error instanceof OptimizationBudgetExceededError);
    assert.equal(error.externalCalls, 3);
    return true;
  });
  const mapped = optimizationErrorResponse(new OptimizationBudgetExceededError(240_000, 99));
  assert.equal(mapped.status, 504);
  assert.equal(mapped.body.error.code, "OPTIMIZATION_TIME_BUDGET_EXCEEDED");
});
