import assert from "node:assert/strict";
import { test } from "node:test";
import { createCandidateGroups } from "./grouping.service.js";
import { evaluateCandidateForGroup } from "./group-candidate-evaluator.service.js";
import { calculateRoadCompatibility, findBestRoadCandidate } from "./road-compatibility.service.js";
import { calculateGroupCompatibility } from "./group-compatibility.service.js";
import { evaluateRouteCandidates } from "../routing/route-evaluator.service.js";
import { ScoredRouteCandidates, findBestScoredRoute } from "../routing/route-score.service.js";
import { analyzeEmployeeGeography } from "../employees/employee-geography.service.js";
import type { RoutingProvider, RoutingPoint } from "../routing/routing.types.js";
import { LocationIQRoutingProvider } from "../routing/providers/locationiq-routing.provider.js";
import { resolveOptimizationConfig } from "./optimization-behavior.config.js";

const origin = { id: "company", latitude: 0, longitude: 0 };
const employee = (id: string, longitude = 0.01) => analyzeEmployeeGeography({ id, latitude: 0, longitude, name: id, address: "", phone: "" }, origin);
function provider(duration: number): RoutingProvider {
  return { async getMatrix(points) { return { points, metrics: points.map((_, i) => points.map((_, j) => ({ durationSeconds: i === j ? 0 : duration, distanceMeters: i === j ? 0 : 100 }))) }; } };
}
test("empty input makes no Matrix request", async () => {
  assert.deepEqual(await createCandidateGroups(origin, [], { async getMatrix() { throw Error("unexpected request"); } }), []);
});
test("nested employee coordinates, capacity, uniqueness and input order", async () => {
  const employees = Array.from({length: 15}, (_, i) => employee(String(i), (15-i)*0.001));
  const before = structuredClone(employees);
  const groups = await createCandidateGroups(origin, employees, provider(60));
  assert.deepEqual(groups.map(g => g.employees.length), [4,4,4,3]);
  assert.equal(new Set(groups.flatMap(g => g.employees.map(e => e.employee.id))).size,15);
  assert.deepEqual(employees,before);
});
test("low compatibility creates a new group and all available groups are evaluated", async () => {
  const calls: string[][] = [];
  const slow=provider(10000);
  const p: RoutingProvider = { async getMatrix(points) { calls.push(points.map(p => p.id)); return slow.getMatrix(points); } };
  const groups=await createCandidateGroups(origin,[employee("a",0.01),employee("b",1),employee("c",-2)],p);
  assert.equal(groups.length,3);
  assert.deepEqual(calls.map(ids => ids.slice(1)),[["a","b"],["a","c"],["b","c"]]);
});
test("per-execution threshold can create a new group without changing the normal preset", async () => {
  const employees = [employee("a", 0.01), employee("b", 0.02)];
  const normal = await createCandidateGroups(origin, employees, provider(60), resolveOptimizationConfig().config);
  const strict = await createCandidateGroups(origin, employees, provider(60), resolveOptimizationConfig("CUSTOM", {
    minimumCompatibilityScore: 100, maxDirectionDifference: 90, maxProximityKm: 10, maxDistanceDifferenceKm: 20,
    maxAverageExtraDurationMinutes: 20, maxExtraDurationMinutes: 30,
  }).config);
  assert.equal(normal.length, 1);
  assert.equal(strict.length, 2);
});
test("highest score wins even when an earlier group has room", async () => {
  const slow=provider(10000), fast=provider(0);
  const p: RoutingProvider = { async getMatrix(points) {
    return (points.some(p=>p.id === "a") ? slow : fast).getMatrix(points);
  } };
  const groups=await createCandidateGroups(origin,[employee("a",0.01),employee("b",1),employee("c",1.01)],p);
  assert.deepEqual(groups.map(g=>g.employees.map(e=>e.employee.id)),[["a"],["b","c"]]);
});
test("Matrix road score is combined with geographical scores", async () => {
  const a=employee("a").employee,b=employee("b").employee;
  const result=await evaluateCandidateForGroup(origin,b,[a],provider(60));
  assert.deepEqual(result,{...calculateGroupCompatibility(origin,b,[a],calculateRoadCompatibility(30,60).roadScore),routeAvailable:true});
  assert.equal((await evaluateCandidateForGroup(origin,b,[],provider(60))).finalScore,100);
});
test("route evaluator enumerates permutations and road selector minimizes worst detour", async () => {
  const points: RoutingPoint[]=[origin,employee("a").employee,employee("b").employee];
  const matrix=await provider(60).getMatrix(points);
  matrix.metrics[1]![2]!.durationSeconds=120;
  const routes=evaluateRouteCandidates(matrix,0,[1,2]);
  assert.equal(routes.length,2);
  assert.deepEqual(findBestRoadCandidate(routes).route.pointIds,["company","b","a"]);
  assert.throws(()=>findBestRoadCandidate([]));
});
test("route selection never returns a rejected candidate with a higher score", async () => {
  const matrix=await provider(60).getMatrix([origin,employee("a").employee,employee("b").employee]);
  const scored=ScoredRouteCandidates(evaluateRouteCandidates(matrix,0,[1,2]));
  scored[0]!.score.finalScore=10;
  scored[1]!.score.finalScore=100;
  scored[1]!.validation.isAcceptable=false;
  assert.equal(findBestScoredRoute(scored),scored[0]);
  scored[0]!.validation.isAcceptable=false;
  assert.throws(()=>findBestScoredRoute(scored));
});
test("provider failures propagate instead of producing partial groups", async () => {
  await assert.rejects(createCandidateGroups(origin,[employee("a"),employee("b")],{ async getMatrix(){throw Error("Matrix unavailable");} }),/Matrix unavailable/);
});
test("LocationIQ serializes calls and retries 429 respecting Retry-After", async () => {
  const originalFetch=globalThis.fetch;
  const originalKey=process.env.LOCATIONIQ_API_KEY;
  const starts: number[]=[];
  process.env.LOCATIONIQ_API_KEY="unit-test";
  globalThis.fetch=async () => {
    starts.push(Date.now());
    if (starts.length===1) return new Response(null,{status:429,headers:{"retry-after":"2"}});
    return Response.json({durations:[[0,60],[60,0]],distances:[[0,100],[100,0]]});
  };
  try {
    const p=new LocationIQRoutingProvider();
    const points=[origin,employee("a").employee];
    const results=await Promise.all([p.getMatrix(points),p.getMatrix(points)]);
    assert.equal(starts.length,3);
    assert.ok(starts[1]!-starts[0]!>=1950);
    assert.ok(starts[2]!-starts[1]!>=1950);
    assert.equal(results[0]!.metrics[0]![1]!.durationSeconds,60);
  } finally {
    globalThis.fetch=originalFetch;
    if(originalKey===undefined) delete process.env.LOCATIONIQ_API_KEY;
    else process.env.LOCATIONIQ_API_KEY=originalKey;
  }
});
