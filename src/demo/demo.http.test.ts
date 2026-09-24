import assert from "node:assert/strict";
import {test} from "node:test";
import type {AddressInfo} from "node:net";
import {createApp} from "../app.js";
import type {AuthService} from "../auth/auth.types.js";
import type {AuthContext} from "../database/repository.types.js";
import {DEMO_EMPLOYEES} from "./demo-employees.js";

const authContext: AuthContext = {userId: "demo-user", organizationId: "org-a", role: "ADMIN", email: "demo@example.com", name: "Demo", organizationName: "Demo org"};
const auth: AuthService = {async signIn() { return authContext; }, async authenticate(token) { if (token === "demo-token") return authContext; throw new Error("invalid"); }};

async function withServer(callback: (url: string) => Promise<void>): Promise<void> {
  const app = createApp({requireAuthentication: true, auth: {service: auth}, demo: {optimization: {
    optimize: async (_origin, employees) => ({groups: [], issues: [], summary: {totalEmployees: employees.length, totalGroups: 0, acceptableGroups: 0, rejectedGroups: 0, unavailableGroups: 0, unroutableEmployees: 0, averageOccupancy: 0}}),
  }}});
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try { await callback(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

const headers = {Authorization: "Bearer demo-token", "Content-Type": "application/json"};

test("demo endpoints require authentication", async () => {
  await withServer(async (url) => {
    assert.equal((await fetch(`${url}/api/demo/employees`)).status, 401);
  });
});

test("authenticated demo employees are isolated from the normal repository and selection is validated", async () => {
  let optimizedIds: string[] = [];
  const app = createApp({requireAuthentication: true, auth: {service: auth}, demo: {optimization: {
    optimize: async (_origin, employees) => {
      optimizedIds = employees.map((employee) => employee.id);
      return {groups: [], issues: [], summary: {totalEmployees: employees.length, totalGroups: 0, acceptableGroups: 0, rejectedGroups: 0, unavailableGroups: 0, unroutableEmployees: 0, averageOccupancy: 0}};
    },
  }}});
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const list = await fetch(`${url}/api/demo/employees`, {headers});
    assert.equal(list.status, 200);
    assert.equal((await list.json() as unknown[]).length, 30);
    const optimize = await fetch(`${url}/api/demo/routes/optimize`, {method: "POST", headers, body: JSON.stringify({employeeIds: ["demo-02", "demo-01"]})});
    assert.equal(optimize.status, 200);
    assert.deepEqual(optimizedIds, ["demo-02", "demo-01"]);
    assert.equal((await fetch(`${url}/api/demo/routes/optimize`, {method: "POST", headers, body: JSON.stringify({employeeIds: ["demo-01", "demo-01"]})})).status, 400);
    assert.equal((await fetch(`${url}/api/demo/routes/optimize`, {method: "POST", headers, body: JSON.stringify({employeeIds: ["missing"]})})).status, 400);
    assert.equal((await fetch(`${url}/api/demo/routes/recalculate`, {method: "POST", headers, body: JSON.stringify({employeeIds: ["missing"], groups: []})})).status, 400);
    assert.equal(DEMO_EMPLOYEES.some((employee) => optimizedIds.includes(employee.id)), true);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
