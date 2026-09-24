import assert from "node:assert/strict";
import {test} from "node:test";
import {DEMO_EMPLOYEES} from "./demo-employees.js";

test("demo dataset contains 30 unique fictitious employees with valid regional coordinates", () => {
  assert.equal(DEMO_EMPLOYEES.length, 30);
  assert.equal(new Set(DEMO_EMPLOYEES.map((employee) => employee.id)).size, 30);
  assert.equal(new Set(DEMO_EMPLOYEES.map((employee) => employee.phone)).size, 30);
  for (const employee of DEMO_EMPLOYEES) {
    assert.match(employee.id, /^demo-\d{2}$/);
    assert.ok(Number.isFinite(employee.latitude));
    assert.ok(Number.isFinite(employee.longitude));
    assert.ok(employee.latitude >= -8.5 && employee.latitude <= -8);
    assert.ok(employee.longitude >= -35.3 && employee.longitude <= -34.7);
  }
});
