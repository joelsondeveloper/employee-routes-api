import assert from "node:assert/strict";
import {test} from "node:test";
import type {AddressInfo} from "node:net";
import {createApp} from "../app.js";
import type {Employee} from "../employees/employee.types.js";
import type {AuthContext, EmployeeRepository} from "../database/repository.types.js";
import type {AuthService} from "./auth.types.js";

const employeeA: Employee = {id: "employee-a", name: "Ana", address: "Rua A", phone: "1", latitude: -8, longitude: -34};
const employeeB: Employee = {id: "employee-b", name: "Bruno", address: "Rua B", phone: "2", latitude: -8.1, longitude: -34.1};

function repository(rows: Employee[]): EmployeeRepository {
  const tenantRows = new Map([["org-a", [rows[0]!]], ["org-b", [rows[1]!]]]);
  return {
    async list(organizationId) { return tenantRows.get(organizationId) ?? []; },
    async findById(id, organizationId) { return (tenantRows.get(organizationId) ?? []).find((employee) => employee.id === id); },
    async findByIds(ids, organizationId) { return ids.map((id) => (tenantRows.get(organizationId) ?? []).find((employee) => employee.id === id)).filter((employee): employee is Employee => Boolean(employee)); },
    async create(employee, organizationId) { tenantRows.set(organizationId, [...(tenantRows.get(organizationId) ?? []), employee]); return employee; },
    async update(id, organizationId, employee) { const found = await this.findById(id, organizationId); return found ? {id, ...employee} : undefined; },
    async delete(id, organizationId) { const found = await this.findById(id, organizationId); return Boolean(found); },
  };
}

function context(organizationId: string): AuthContext {
  return {userId: `user-${organizationId}`, organizationId, role: "ADMIN", email: `${organizationId}@example.com`, name: organizationId, organizationName: organizationId};
}

function service(): AuthService {
  return {
    async signIn() { return context("org-a"); },
    async authenticate(token) { if (token === "token-a") return context("org-a"); if (token === "token-b") return context("org-b"); throw new Error("invalid"); },
  };
}

async function withServer(callback: (url: string) => Promise<void>): Promise<void> {
  const app = createApp({requireAuthentication: true, auth: {service: service()}, employees: {employeeRepository: repository([employeeA, employeeB])}, optimization: {employeeRepository: repository([employeeA, employeeB]), optimize: async (_origin, employees) => ({groups: [], issues: [], summary: {totalEmployees: employees.length, totalGroups: 0, acceptableGroups: 0, rejectedGroups: 0, unavailableGroups: 0, unroutableEmployees: 0, averageOccupancy: 0}})}});
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try { await callback(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("private endpoints reject requests without a Google identity", async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/employees`);
    assert.equal(response.status, 401);
  });
});

test("employee lookups and optimization are isolated by organization", async () => {
  await withServer(async (url) => {
    const own = await fetch(`${url}/employees/employee-a`, {headers: {Authorization: "Bearer token-a"}});
    assert.equal(own.status, 200);
    const foreign = await fetch(`${url}/employees/employee-b`, {headers: {Authorization: "Bearer token-a"}});
    assert.equal(foreign.status, 404);
    const optimize = await fetch(`${url}/api/routes/optimize`, {method: "POST", headers: {Authorization: "Bearer token-a", "Content-Type": "application/json"}, body: JSON.stringify({employeeIds: ["employee-b"]})});
    assert.equal(optimize.status, 400);
  });
});

test("Google sign-in returns the resolved user and organization", async () => {
  await withServer(async (url) => {
    const response = await fetch(`${url}/api/auth/google`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({credential: "test-token"})});
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
    assert.deepEqual(await response.json(), {user: {id: "user-org-a", name: "org-a", email: "org-a@example.com"}, organization: {id: "org-a", name: "org-a"}, role: "ADMIN"});
  });
});

