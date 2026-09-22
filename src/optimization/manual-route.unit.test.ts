import assert from "node:assert/strict";
import {test} from "node:test";
import {recalculateManualGroups} from "./manual-route.service.js";
import type {Employee} from "../employees/employee.types.js";

const origin = {id: "company", latitude: 0, longitude: 0};
const employees: Employee[] = ["a", "b", "c"].map((id, index) => ({id, name: id, address: "", phone: "", latitude: 0, longitude: index + 1}));
const provider = {getMatrix: async (points: typeof origin[]) => ({points, metrics: points.map(() => points.map(() => ({durationSeconds: 60, distanceMeters: 1000})))})};

test("manual route preserves explicit stop order and recalculates metrics", async () => {
  const result = await recalculateManualGroups(origin, employees, [{groupNumber: 1, employeeIds: ["a", "b", "c"], stopOrder: ["company", "c", "a", "b"]}], provider);
  assert.deepEqual(result.groups[0]?.stopOrder, ["company", "c", "a", "b"]);
  assert.equal(result.groups[0]?.acceptable, true);
  assert.equal(result.groups[0]?.totalDurationSeconds, 180);
});

test("manual route rejects capacity above four", async () => {
  const five = [...employees, {id: "d", name: "d", address: "", phone: "", latitude: 0, longitude: 4}, {id: "e", name: "e", address: "", phone: "", latitude: 0, longitude: 5}];
  await assert.rejects(() => recalculateManualGroups(origin, five, [{groupNumber: 1, employeeIds: five.map(employee => employee.id)}], provider), /more than four/);
});
