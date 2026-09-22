import assert from "node:assert/strict";
import { test } from "node:test";
import { optimizeEmployeeRoutes } from "./employee-route-optimization.service.js";
import { evaluateCandidateForGroup } from "./group-candidate-evaluator.service.js";
import { createCandidateGroups } from "./grouping.service.js";
import { GROUPING_CONFIG } from "./grouping.config.js";
import { analyzeEmployeeGeography } from "../employees/employee-geography.service.js";
import { evaluateRouteCandidates } from "../routing/route-evaluator.service.js";
import { findFastestRoute } from "../routing/route-optimizer.service.js";
import { LocationIQRoutingProvider } from "../routing/providers/locationiq-routing.provider.js";
import { RouteUnavailableError, RoutingInputError, InvalidRoutingMatrixError, RoutingMatrixTooLargeError } from "../routing/routing.errors.js";
import type { RoutingMatrix, RoutingPoint, RoutingProvider } from "../routing/routing.types.js";

const origin={id:"company",latitude:0,longitude:0};
const employee=(id:string)=>({id,name:id,address:"",phone:"",latitude:0,longitude:0.001});
function matrix(points:RoutingPoint[], duration=60):RoutingMatrix {
  return {points,metrics:points.map((_,i)=>points.map((_,j)=>({durationSeconds:i===j?0:duration,distanceMeters:i===j?0:100})))};
}
test("candidate unavailable with A continues to B",async()=>{
  const calls:string[][]=[];
  const p:RoutingProvider={async getMatrix(points){
    const ids=points.map(p=>p.id);calls.push(ids);
    const m=matrix(points);
    if(ids.includes("a")&&ids.length>2){m.metrics[1]![2]=null;m.metrics[2]![1]=null;}
    return m;
  }};
  const input=["a","b","c"].map(id=>analyzeEmployeeGeography(employee(id),origin));
  const groups=await createCandidateGroups(origin,input,p);
  assert.deepEqual(groups.map(g=>g.employees.map(e=>e.employee.id)),[["a"],["b","c"]]);
  assert.ok(calls.some(ids=>ids.join() === "company,b,c"));
});
test("unavailable cannot win with threshold zero",async()=>{
  const previous=GROUPING_CONFIG.minimumCompatibilityScore;
  GROUPING_CONFIG.minimumCompatibilityScore=0;
  try {
    const p:RoutingProvider={async getMatrix(points){const m=matrix(points);m.metrics[1]![2]=null;m.metrics[2]![1]=null;return m;}};
    const result=await createCandidateGroups(origin,["a","b"].map(id=>analyzeEmployeeGeography(employee(id),origin)),p);
    assert.equal(result.length,2);
  } finally {GROUPING_CONFIG.minimumCompatibilityScore=previous;}
});
test("public engine survives incompatible combination",async()=>{
  const p:RoutingProvider={async getMatrix(points){const m=matrix(points);if(points.length>2){m.metrics[1]![2]=null;m.metrics[2]![1]=null;}return m;}};
  const result=await optimizeEmployeeRoutes(origin,[employee("a"),employee("b")],p);
  assert.equal(result.groups.length,2);assert.deepEqual(result.issues,[]);
});
test("technical errors never become incompatibility",async()=>{
  const error=new Error("network failure");
  await assert.rejects(evaluateCandidateForGroup(origin,employee("b"),[employee("a")],{async getMatrix(){throw error;}}),e=>e===error);
});
test("partial Matrix keeps valid order, ignores unused unavailable reverse edge",()=>{
  const m=matrix([origin,employee("a"),employee("b")]);
  m.metrics[1]![2]=null;m.metrics[2]![0]=null;
  const candidates=evaluateRouteCandidates(m,0,[1,2]);
  assert.equal(candidates.length,1);
  assert.deepEqual(candidates[0]!.route.pointIds,["company","b","a"]);
  assert.equal(candidates[0]!.route.totalDurationSeconds,120);
  assert.deepEqual(findFastestRoute(m,0,[1,2]).pointIds,["company","b","a"]);
});
test("impossible Matrix yields explicit unavailable with no fabricated route",async()=>{
  const m=matrix([origin,employee("a"),employee("b")]);m.metrics[1]![2]=null;m.metrics[2]![1]=null;
  assert.throws(()=>evaluateRouteCandidates(m,0,[1,2]),RouteUnavailableError);
  const score=await evaluateCandidateForGroup(origin,employee("b"),[employee("a")],{async getMatrix(){return m;}});
  assert.equal(score.routeAvailable,false);assert.equal(score.finalScore,0);
  if(!score.routeAvailable)assert.ok(score.unavailableRelations.length>0);
});
test("origin-unreachable employee is reported while others continue",async()=>{
  const p:RoutingProvider={async getMatrix(points){const m=matrix(points);const i=points.findIndex(p=>p.id==="bad");if(i>=0)m.metrics[0]![i]=null;return m;}};
  const result=await optimizeEmployeeRoutes(origin,[employee("a"),employee("bad"),employee("b")],p);
  assert.deepEqual(result.groups.flatMap(g=>g.employees.map(e=>e.id)),["a","b"]);
  assert.equal(result.issues[0]!.type,"UNROUTABLE_EMPLOYEE");
  assert.deepEqual(result.issues[0]!.relations,[{fromId:"company",toId:"bad"}]);
  assert.equal(result.summary.totalEmployees,3);assert.equal(result.summary.unroutableEmployees,1);
  assert.equal(result.summary.averageOccupancy,2);
});
test("all employees unreachable returns issues and zero occupancy",async()=>{
  const result=await optimizeEmployeeRoutes(origin,[employee("a")],{async getMatrix(points){const m=matrix(points);m.metrics[0]![1]=null;return m;}});
  assert.equal(result.groups.length,0);assert.equal(result.issues.length,1);assert.equal(result.summary.averageOccupancy,0);
});
test("availability is a snapshot within each execution, refreshed in the next",async()=>{
  let calls=0;
  const provider={async getMatrix(points:RoutingPoint[]){const m=matrix(points);if(++calls>1)m.metrics[0]![1]=null;return m;}};
  const first=await optimizeEmployeeRoutes(origin,[employee("a")],provider);
  assert.equal(calls,1);assert.equal(first.groups.length,1);assert.deepEqual(first.issues,[]);
  const second=await optimizeEmployeeRoutes(origin,[employee("a")],provider);
  assert.equal(calls,2);assert.equal(second.groups.length,0);
  assert.equal(second.issues[0]!.type,"UNROUTABLE_EMPLOYEE");
});

test("invalid input and duplicate IDs fail before provider calls",async()=>{
  const p:RoutingProvider={async getMatrix(){assert.fail("must not route");}};
  for(const invalid of [NaN,Infinity,91,-91,undefined]){
    await assert.rejects(optimizeEmployeeRoutes(origin,[{...employee("a"),latitude:invalid as number}],p),RoutingInputError);
  }
  for(const invalid of [NaN,181,-181,undefined]){
    await assert.rejects(optimizeEmployeeRoutes(origin,[{...employee("a"),longitude:invalid as number}],p),RoutingInputError);
  }
  for(const input of [[employee("")],[employee("a"),employee("a")],[employee("company")]]){
    await assert.rejects(optimizeEmployeeRoutes(origin,input,p),RoutingInputError);
  }
});
test("identical coordinates and employee at origin preserve identity",async()=>{
  const input=[{...employee("a"),longitude:0},{...employee("b"),longitude:0}];
  const result=await optimizeEmployeeRoutes(origin,input,{async getMatrix(points){return matrix(points,0);}});
  assert.deepEqual(result.groups[0]!.stopOrder,["company","a","b"]);
  assert.equal(result.groups[0]!.totalDurationSeconds,0);
});
test("malformed Matrix is technical even alongside null cells",()=>{
  for(const kind of ["dimension","missing","nan","negative"]){
    const m=matrix([origin,employee("a")]);m.metrics[0]![1]=null;
    if(kind==="dimension")m.metrics.pop();
    if(kind==="missing")delete m.metrics[1]![0];
    if(kind==="nan")m.metrics[1]![0]!.durationSeconds=NaN;
    if(kind==="negative")m.metrics[1]![0]!.distanceMeters=-1;
    assert.throws(()=>evaluateRouteCandidates(m,0,[1]),InvalidRoutingMatrixError);
  }
});
test("empty passenger list is a calculable origin-only route",()=>{
  const result=evaluateRouteCandidates(matrix([origin]),0,[]);
  assert.equal(result.length,1);assert.deepEqual(result[0]!.route.pointIds,["company"]);
});
test("LocationIQ null, domain codes and technical response classifications",async()=>{
  const fetch=globalThis.fetch,key=process.env.LOCATIONIQ_API_KEY;
  process.env.LOCATIONIQ_API_KEY="test-key";
  const points=[origin,employee("a")];
  try {
    globalThis.fetch=async()=>Response.json({code:"Ok",durations:[[0,null],[60,0]],distances:[[0,null],[100,0]]});
    const m=await new LocationIQRoutingProvider().getMatrix(points);assert.equal(m.metrics[0]![1],null);
    for(const code of ["NoTable","NoSegment"]){
      globalThis.fetch=async()=>Response.json({code},{status:400});
      await assert.rejects(new LocationIQRoutingProvider().getMatrix(points),RouteUnavailableError);
    }
    globalThis.fetch=async()=>Response.json({code:"TooBig"},{status:400});
    await assert.rejects(new LocationIQRoutingProvider().getMatrix(points),RoutingMatrixTooLargeError);
    for(const status of [401,403,500,503]){
      globalThis.fetch=async()=>Response.json({code:"NoTable"},{status});
      await assert.rejects(new LocationIQRoutingProvider().getMatrix(points),e=>e instanceof Error&&!(e instanceof RouteUnavailableError));
    }
    for(const body of [{}, {durations:[[0]],distances:[[0]]}, {durations:[[0,null],[60,0]],distances:[[0,1],[100,0]]}]){
      globalThis.fetch=async()=>Response.json(body);
      await assert.rejects(new LocationIQRoutingProvider().getMatrix(points),InvalidRoutingMatrixError);
    }
    globalThis.fetch=async()=>{throw new Error("timeout");};
    await assert.rejects(new LocationIQRoutingProvider().getMatrix(points),/timeout/);
    delete process.env.LOCATIONIQ_API_KEY;
    await assert.rejects(new LocationIQRoutingProvider().getMatrix(points),/not configured/);
  } finally {globalThis.fetch=fetch;if(key===undefined)delete process.env.LOCATIONIQ_API_KEY;else process.env.LOCATIONIQ_API_KEY=key;}
});
