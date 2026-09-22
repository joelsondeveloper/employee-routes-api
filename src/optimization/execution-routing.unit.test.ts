import assert from "node:assert/strict";
import { test } from "node:test";
import { ExecutionRoutingProvider } from "../routing/execution-routing.provider.js";
import { RouteUnavailableError, InvalidRoutingMatrixError, RoutingMatrixTooLargeError } from "../routing/routing.errors.js";
import type { RoutingPoint, RoutingMatrix } from "../routing/routing.types.js";
import { optimizeEmployeeRoutes } from "./employee-route-optimization.service.js";

const points: RoutingPoint[] = Array.from({length:51},(_,i)=>({id:`p${i}`,latitude:i/100,longitude:0}));
function build(selected: RoutingPoint[]): RoutingMatrix {
  return {points:selected,metrics:selected.map(a=>selected.map(b=>({distanceMeters:Math.abs(a.latitude-b.latitude)*1000,durationSeconds:a.id===b.id?0:Number(a.id.slice(1))*100+Number(b.id.slice(1))})))};
}
test("reuses subsets and directions, preserves requested order and isolates mutation",async()=>{
  let calls=0;const cache=new ExecutionRoutingProvider({async getMatrix(p){calls++;return build(p);}});
  await cache.getMatrix(points.slice(0,4));
  const m=await cache.getMatrix([points[2]!,points[1]!]);
  assert.equal(calls,1);assert.deepEqual(m.points.map(p=>p.id),["p2","p1"]);
  assert.equal(m.metrics[0]![1]!.durationSeconds,201);assert.equal(m.metrics[1]![0]!.durationSeconds,102);
  m.metrics[0]![1]!.durationSeconds=0;
  assert.equal((await cache.getMatrix([points[2]!,points[1]!])).metrics[0]![1]!.durationSeconds,201);
});
test("null is a known directed value, not a zero or a cache miss",async()=>{
  let calls=0;const cache=new ExecutionRoutingProvider({async getMatrix(p){calls++;const m=build(p);m.metrics[0]![1]=null;return m;}});
  await cache.getMatrix(points.slice(0,2));const m=await cache.getMatrix(points.slice(0,2));
  assert.equal(calls,1);assert.equal(m.metrics[0]![1],null);assert.notEqual(m.metrics[1]![0],null);
});
test("technical and malformed failures do not poison cache",async()=>{
  let calls=0;const cache=new ExecutionRoutingProvider({async getMatrix(p){calls++;if(calls===1)throw new Error("503");if(calls===2)return {points:p,metrics:[]};return build(p);}});
  await assert.rejects(cache.getMatrix(points.slice(0,2)),/503/);
  await assert.rejects(cache.getMatrix(points.slice(0,2)),InvalidRoutingMatrixError);
  await cache.getMatrix(points.slice(0,2));assert.equal(calls,3);
});
test("concurrent overlapping misses share the first response",async()=>{
  let calls=0;const cache=new ExecutionRoutingProvider({async getMatrix(p){calls++;return build(p);}});
  await Promise.all([cache.getMatrix(points.slice(0,4)),cache.getMatrix(points.slice(1,3)),cache.getMatrix(points.slice(0,4))]);
  assert.equal(calls,1);
});
test("coordinates participate in the key",async()=>{
  let calls=0;const cache=new ExecutionRoutingProvider({async getMatrix(p){calls++;return build(p);}});
  await cache.getMatrix(points.slice(0,2));await cache.getMatrix([points[0]!,{...points[1]!,latitude:1}]);assert.equal(calls,2);
});
test("51 points use ten bounded batches and resolve cross-block pairs on demand",async()=>{
  const sizes:number[]=[];const cache=new ExecutionRoutingProvider({async getMatrix(p){sizes.push(p.length);return build(p);}});
  await cache.prepare(points);assert.equal(sizes.length,10);assert.ok(sizes.every(n=>n<=6));
  assert.equal(sizes.reduce((sum,n)=>sum+n*n,0),360);
  for(const a of points)for(const b of points)if(a.id!==b.id){
    const m=await cache.getMatrix([a,b]);assert.equal(m.metrics[0]![1]!.durationSeconds,Number(a.id.slice(1))*100+Number(b.id.slice(1)));
  }
  assert.ok(sizes.every(n=>n<=6));
});
test("TooBig prefetch is isolated without changing the configured six-point limit",async()=>{
  const sizes:number[]=[];
  const cache=new ExecutionRoutingProvider({async getMatrix(p){
    sizes.push(p.length);
    if(p.length>3) throw new RoutingMatrixTooLargeError(p.map(point=>point.id));
    return build(p);
  }});
  await cache.prepare(points.slice(0,6));
  assert.deepEqual(sizes,[6,4,3,2,3]);
  assert.ok(sizes.some(size=>size===6));
  assert.ok(sizes.every(size=>size<=6));
});
test("global domain error falls back without marking unrelated pairs unavailable",async()=>{
  let calls=0;const cache=new ExecutionRoutingProvider({async getMatrix(p){calls++;if(p.length>2)throw new RouteUnavailableError([]);return build(p);}});
  await cache.prepare(points.slice(0,3));const m=await cache.getMatrix(points.slice(0,2));
  assert.equal(calls,2);assert.notEqual(m.metrics[0]![1],null);
});
test("cache belongs to each execution and unrouteable employees remain issues",async()=>{
  let calls=0;const p={async getMatrix(selected:RoutingPoint[]){calls++;const m=build(selected);m.metrics[0]![1]=null;return m;}};
  const employees=points.slice(1,3).map(p=>({...p,name:p.id,address:"",phone:""}));
  const first=await optimizeEmployeeRoutes(points[0]!,employees,p);
  const second=await optimizeEmployeeRoutes(points[0]!,employees,p);
  assert.equal(calls,2);assert.deepEqual(first,second);assert.equal(first.issues[0]!.type,"UNROUTABLE_EMPLOYEE");
});
test("existing rejected metrics remain available with a single external request",async()=>{
  let calls=0;const p={async getMatrix(selected:RoutingPoint[]){calls++;return {points:selected,metrics:selected.map((_,i)=>selected.map((_,j)=>({distanceMeters:i===j?0:100,durationSeconds:i===j?0:1000})))};}};
  const employees=points.slice(1,5).map(p=>({...p,latitude:0.001,name:p.id,address:"",phone:""}));
  const result=await optimizeEmployeeRoutes(points[0]!,employees,p);
  assert.equal(calls,1);assert.equal(result.groups[0]!.acceptable,false);assert.equal(result.groups[0]!.maxExtraDurationSeconds,3000);assert.equal(result.groups[0]!.violations.length,3);
});
