import assert from "node:assert/strict";
import {test} from "node:test";
import type {AddressInfo} from "node:net";
import {createApp} from "../app.js";
import type {Employee} from "../employees/employee.types.js";
import type {EmployeeRouteOptimizationResult} from "../optimization/employee-route-optimization.types.js";

const employee = (id: string): Employee => ({id, name: `Guest ${id}`, address: "Centro, Cabo de Santo Agostinho", phone: "(81) 99000-0001", latitude: -8.29, longitude: -35.03});
const result: EmployeeRouteOptimizationResult = {groups: [], issues: [], summary: {totalEmployees: 0, totalGroups: 0, acceptableGroups: 0, rejectedGroups: 0, unavailableGroups: 0, unroutableEmployees: 0, averageOccupancy: 0}};

async function withServer(callback: (url: string) => Promise<void>): Promise<void> {
  let received: Employee[] = [];
  const app = createApp({requireAuthentication: false, guest: {optimize: async (_origin, employees) => { received = employees; return {...result, summary: {...result.summary, totalEmployees: employees.length}}; }}});
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try { await callback(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  assert.ok(received.length >= 0);
}

test("guest dataset is public and optimization accepts only validated selections", async () => {
  await withServer(async (url) => {
    const list = await fetch(`${url}/api/guest/employees`);
    assert.equal(list.status, 200);
    const dataset = await list.json() as Employee[];
    assert.equal(dataset.length, 30);
    assert.equal(new Set(dataset.map((item) => item.id)).size, 30);
    assert.equal(new Set(dataset.map((item) => item.phone)).size, 30);
    assert.ok(dataset.every((item) => Number.isFinite(item.latitude) && item.latitude >= -9 && item.latitude <= -7 && Number.isFinite(item.longitude) && item.longitude >= -36 && item.longitude <= -34));
    const valid = await fetch(`${url}/api/guest/routes/optimize`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({employees: [employee("guest-local")]})});
    assert.equal(valid.status, 200);
    const tooMany = await fetch(`${url}/api/guest/routes/optimize`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({employees: Array.from({length: 13}, (_, index) => employee(`e-${index}`))})});
    assert.equal(tooMany.status, 400);
    const invalid = await fetch(`${url}/api/guest/routes/optimize`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({employees: [{...employee("bad"), latitude: Number.NaN}]})});
    assert.equal(invalid.status, 400);
  });
});

test("guest rate limit and manual group validation are enforced", async () => {
  await withServer(async (url) => {
    const body = {employees: [employee("guest-local")]};
    const request = () => fetch(`${url}/api/guest/routes/optimize`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)});
    const recalc = await fetch(`${url}/api/guest/routes/recalculate`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({employees: [employee("guest-local")], groups: [{groupNumber: 1, employeeIds: ["missing"]}]})});
    assert.equal(recalc.status, 400);
    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 429);
    assert.equal((await request()).status, 429);
  });
});

