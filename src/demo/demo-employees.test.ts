import assert from "node:assert/strict";
import test from "node:test";
import {DEMO_EMPLOYEES} from "./demo-employees.js";

function distanceMeters(a: {latitude: number; longitude: number}, b: {latitude: number; longitude: number}): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

test("demo employees have unique ids and no stacked map markers", () => {
  assert.equal(new Set(DEMO_EMPLOYEES.map((employee) => employee.id)).size, DEMO_EMPLOYEES.length);
  for (let i = 0; i < DEMO_EMPLOYEES.length; i++) {
    for (let j = i + 1; j < DEMO_EMPLOYEES.length; j++) {
      const [a, b] = [DEMO_EMPLOYEES[i]!, DEMO_EMPLOYEES[j]!];
      assert.ok(distanceMeters(a, b) >= 50, `${a.id} and ${b.id} are less than 50 m apart`);
    }
  }
});
