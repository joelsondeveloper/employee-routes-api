import assert from "node:assert/strict";
import { LocationIQRoutingProvider } from "../routing/providers/locationiq-routing.provider.js";
import { optimizeEmployeeRoutes } from "./employee-route-optimization.service.js";
import { GROUPING_CONFIG } from "./grouping.config.js";
import { ROUTE_CONSTRAINTS_CONFIG } from "../routing/route-constraints.config.js";

const points = [
  {
    id: "company",
    latitude: -8.3058014,
    longitude: -35.0223791,
  },

  // =========================================================
  // 15 FUNCIONÁRIOS DE TESTE
  // =========================================================

  {
    id: "employee-a",
    latitude: -8.2985031,
    longitude: -35.036529,
  },
  {
    id: "employee-b",
    latitude: -8.285917,
    longitude: -35.0374083,
  },
  {
    id: "employee-c",
    latitude: -8.288198,
    longitude: -35.034804,
  },
  {
    id: "employee-d",
    latitude: -8.3309844,
    longitude: -34.9507633,
  },
  {
    id: "employee-e",
    latitude: -8.2755,
    longitude: -35.0182,
  },
  {
    id: "employee-f",
    latitude: -8.2928,
    longitude: -34.9876,
  },
  {
    id: "employee-g",
    latitude: -8.3374,
    longitude: -34.9472,
  },
  {
    id: "employee-h",
    latitude: -8.3498,
    longitude: -34.9461,
  },
  {
    id: "employee-i",
    latitude: -8.2471,
    longitude: -35.0318,
  },
  {
    id: "employee-j",
    latitude: -8.2789,
    longitude: -35.0453,
  },
  {
    id: "employee-k",
    latitude: -8.2697,
    longitude: -35.0401,
  },
  {
    id: "employee-l",
    latitude: -8.2608,
    longitude: -35.0522,
  },
  {
    id: "employee-m",
    latitude: -8.2305,
    longitude: -35.0811,
  },
  {
    id: "employee-n",
    latitude: -8.3094,
    longitude: -34.9728,
  },
  {
    id: "employee-o",
    latitude: -8.3652,
    longitude: -34.9625,
  },
];
const origin = points[0]!;
const employees = points.slice(1).map(point => ({
  ...point, name: point.id.replace("employee-", "").toUpperCase(), address: "", phone: "",
}));
const result = await optimizeEmployeeRoutes(origin, employees, new LocationIQRoutingProvider());
const ids = result.groups.flatMap(group => group.employees.map(employee => employee.id));
assert.equal(ids.length, employees.length);
assert.equal(new Set(ids).size, employees.length);
assert.deepEqual([...ids].sort(), employees.map(employee => employee.id).sort());
for (const group of result.groups) {
  assert.ok(group.employees.length > 0 && group.employees.length <= GROUPING_CONFIG.maxPassengers);
  assert.equal(group.stopOrder[0], origin.id);
  assert.deepEqual(group.stopOrder.slice(1).sort(), group.employees.map(employee => employee.id).sort());
  assert.deepEqual(group.passengerMetrics.map(metric => metric.pointId).sort(), group.employees.map(employee => employee.id).sort());
  const exceeded = group.passengerMetrics.filter(metric => metric.extraDurationSeconds > ROUTE_CONSTRAINTS_CONFIG.maxExtraDurationSeconds);
  assert.equal(group.acceptable, exceeded.length === 0);
  assert.deepEqual(group.violations.map(v => v.pointId).sort(), exceeded.map(metric => metric.pointId).sort());
  for (const violation of group.violations) {
    assert.equal(violation.limit, ROUTE_CONSTRAINTS_CONFIG.maxExtraDurationSeconds);
    assert.ok(violation.actualValue > violation.limit);
  }
  console.log(`\nGROUP ${group.groupNumber}
Employees: ${group.employees.map(employee => employee.name).join(", ")}
Stop order: ${group.stopOrder.join(" → ")}
Duration: ${(group.totalDurationSeconds / 60).toFixed(2)} min
Distance: ${(group.totalDistanceMeters / 1000).toFixed(2)} km
Average extra: ${(group.averageExtraDurationSeconds / 60).toFixed(2)} min
Max extra: ${(group.maxExtraDurationSeconds / 60).toFixed(2)} min
Status: ${group.acceptable ? "ACCEPTED" : "REJECTED"}
Violations: ${JSON.stringify(group.violations)}`);
}
assert.equal(result.summary.totalEmployees, employees.length);
assert.equal(result.summary.totalGroups, result.groups.length);
assert.equal(result.summary.acceptableGroups, result.groups.filter(g => g.acceptable).length);
assert.equal(result.summary.rejectedGroups, result.groups.filter(g => !g.acceptable).length);
assert.equal(result.summary.averageOccupancy, employees.length / result.groups.length);
console.log("\nSUMMARY", result.summary);
console.log("PASS: employee coverage, capacity, stop order, metrics, constraints and summary.");
