import assert from "node:assert/strict";
import { test } from "node:test";
import { optimizeEmployeeRoutes } from "./employee-route-optimization.service.js";
import { findBestScoredAttempt, findBestScoredRoute, ScoredRouteCandidates } from "../routing/route-score.service.js";
import { evaluateRouteCandidates } from "../routing/route-evaluator.service.js";
import type { RoutingProvider } from "../routing/routing.types.js";
import type { Employee } from "../employees/employee.types.js";
const origin={id:"company",latitude:0,longitude:0};
const employees: Employee[]=Array.from({length:4},(_,i)=>({id:String(i),name:String(i),latitude:0,longitude:0.001,address:"",phone:""}));
const provider=(duration:number):RoutingProvider=>({async getMatrix(points){return {points,metrics:points.map((_,i)=>points.map((_,j)=>({durationSeconds:i===j?0:duration,distanceMeters:i===j?0:100})))};}});
test("empty input returns zero summary without Matrix calls",async()=>{
  const result=await optimizeEmployeeRoutes(origin,[],{async getMatrix(){throw Error("unexpected");}});
  assert.deepEqual(result,{groups:[],issues:[],summary:{totalEmployees:0,totalGroups:0,acceptableGroups:0,rejectedGroups:0,unavailableGroups:0,unroutableEmployees:0,averageOccupancy:0}});
});
test("single passenger exposes original employee, stop IDs and direct metrics",async()=>{
  const result=await optimizeEmployeeRoutes(origin,[employees[0]!],provider(60));
  const g=result.groups[0]!;
  assert.equal(g.employees[0],employees[0]);
  assert.deepEqual(g.stopOrder,["company","0"]);
  assert.equal(g.totalDurationSeconds,60);
  assert.equal(g.totalDistanceMeters,100);
  assert.equal(g.maxExtraDurationSeconds,0);
  assert.equal(g.averageExtraDurationSeconds,0);
  assert.deepEqual(g.violations,[]);
  assert.equal(g.acceptable,true);
});
test("all-rejected group returns best diagnostic attempt and violations",async()=>{
  const result=await optimizeEmployeeRoutes(origin,employees,provider(1000));
  assert.equal(result.groups.length,1);
  const g=result.groups[0]!;
  assert.equal(g.acceptable,false);
  assert.equal(g.stopOrder.length,5);
  assert.equal(g.totalDurationSeconds,4000);
  assert.equal(g.maxExtraDurationSeconds,3000);
  assert.equal(g.averageExtraDurationSeconds,1500);
  assert.equal(g.violations.length,3);
  assert.equal(result.summary.rejectedGroups,1);
  assert.equal(result.summary.averageOccupancy,4);
});
test("acceptable routes still use existing selection policy",async()=>{
  const p=provider(60);
  const result=await optimizeEmployeeRoutes(origin,employees,p);
  const matrix=await p.getMatrix([origin,...employees]);
  const best=findBestScoredRoute(ScoredRouteCandidates(evaluateRouteCandidates(matrix,0,[1,2,3,4])));
  assert.deepEqual(result.groups[0]!.stopOrder,best.candidate.route.pointIds);
  assert.deepEqual(result.groups[0]!.passengerMetrics,best.candidate.evaluation.passengerMetrics);
  assert.equal(result.summary.acceptableGroups,1);
});
test("diagnostic selection uses highest score, preserves ties and rejects empty candidates",async()=>{
  const matrix=await provider(60).getMatrix([origin,...employees.slice(0,2)]);
  const scored=ScoredRouteCandidates(evaluateRouteCandidates(matrix,0,[1,2]));
  scored.forEach(s=>s.validation.isAcceptable=false);
  scored[0]!.score.finalScore=10;
  scored[1]!.score.finalScore=20;
  assert.equal(findBestScoredAttempt(scored),scored[1]);
  scored[0]!.score.finalScore=20;
  assert.equal(findBestScoredAttempt(scored),scored[0]);
  assert.throws(()=>findBestScoredAttempt([]));
  assert.throws(()=>findBestScoredRoute(scored));
});
test("uncalculable Matrix propagates an error instead of an ordinary rejection",async()=>{
  await assert.rejects(optimizeEmployeeRoutes(origin,[employees[0]!],{async getMatrix(points){return {points,metrics:[]};}}),/Invalid routing Matrix dimensions/);
});
test("provider error propagates",async()=>{
  await assert.rejects(optimizeEmployeeRoutes(origin,employees,{async getMatrix(){throw Error("provider unavailable");}}),/provider unavailable/);
});
