import {describe, expect, it} from "vitest";
import {isAnomalousGroup, resultCounts} from "./route-utils";
import type {OptimizationResponse} from "../types/api";

const fixture: OptimizationResponse = {
  groups: [{groupNumber: 1, status: "REJECTED", acceptable: false, employees: [], stops: [], totalDurationSeconds: 200, totalDistanceMeters: 1000, averageExtraDurationSeconds: 0, maxExtraDurationSeconds: 0, passengerMetrics: [], violations: []}],
  issues: [{type: "UNROUTABLE_EMPLOYEE", employeeId: "x", reason: "unavailable", relations: []}],
  summary: {totalEmployees: 2, totalGroups: 1, acceptableGroups: 0, rejectedGroups: 1, unavailableGroups: 0, unroutableEmployees: 1, averageOccupancy: 1},
};

describe("route helpers", () => {
  it("summarizes the operational counts", () => expect(resultCounts(fixture)).toEqual({employees: 2, cars: 1, accepted: 0, attention: 1, issues: 1}));
  it("marks an anomalous route for neutral diagnosis only", () => expect(isAnomalousGroup({...fixture.groups[0]!, totalDistanceMeters: 500001})).toBe(true));
});
