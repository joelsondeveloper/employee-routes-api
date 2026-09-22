import assert from "node:assert/strict";
import {test} from "node:test";
import type {AddressInfo} from "node:net";
import type {Employee} from "../employees/employee.types.js";
import {createApp} from "../app.js";
import type {OptimizationRouteDependencies} from "./optimization.routes.js";
import type {EmployeeRouteOptimizationResult} from "./employee-route-optimization.types.js";
import {RoutingProviderError} from "../routing/routing.errors.js";

const employee = (id: string, name = id): Employee => ({
  id,
  name,
  address: `${name} address`,
  phone: "private",
  latitude: -8.1,
  longitude: -34.9,
});

const e1 = employee("employee-1", "Ana");
const e2 = employee("employee-2", "Bruno");
const e3 = employee("employee-3", "Joelson3");

const result: EmployeeRouteOptimizationResult = {
  groups: [{
    groupNumber: 1,
    employees: [e1, e2],
    stopOrder: ["company", e1.id, e2.id],
    acceptable: false,
    totalDurationSeconds: 1_200,
    totalDistanceMeters: 4_500,
    averageExtraDurationSeconds: 300,
    maxExtraDurationSeconds: 960,
    passengerMetrics: [
      {pointId: e1.id, directDurationSeconds: 500, sharedDurationSeconds: 600, extraDurationSeconds: 100},
      {pointId: e2.id, directDurationSeconds: 600, sharedDurationSeconds: 960, extraDurationSeconds: 360},
    ],
    violations: [{type: "MAX_EXTRA_DURATION", pointId: e2.id, actualValue: 960, limit: 900}],
  }],
  issues: [{
    type: "UNROUTABLE_EMPLOYEE",
    employeeId: e3.id,
    reason: "Route unavailable: company -> employee-3",
    relations: [{fromId: "company", toId: e3.id}],
  }],
  summary: {
    totalEmployees: 3,
    totalGroups: 1,
    acceptableGroups: 0,
    rejectedGroups: 1,
    unavailableGroups: 0,
    unroutableEmployees: 1,
    averageOccupancy: 2,
  },
};

function store(rows: Employee[]): NonNullable<OptimizationRouteDependencies["employeeStore"]> {
  return {prepare: () => ({all: () => rows})};
}

async function withServer(dependencies: OptimizationRouteDependencies, callback: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = createApp({optimization: dependencies});
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function post(baseUrl: string, body: unknown): Promise<{status: number; json: () => Promise<unknown>}> {
  const response = await fetch(`${baseUrl}/api/routes/optimize`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  });
  return {status: response.status, json: () => response.json()};
}

const selected = [e1.id, e2.id, e3.id];

test("GET /health returns a local health response", async () => {
  await withServer({employeeStore: store([])}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {status: "ok"});
  });
});

test("empty selection is rejected at the HTTP boundary", async () => {
  await withServer({
    employeeStore: store([]),
    optimize: async (_origin, employees) => ({
      groups: [],
      issues: [],
      summary: {totalEmployees: employees.length, totalGroups: 0, acceptableGroups: 0, rejectedGroups: 0, unavailableGroups: 0, unroutableEmployees: 0, averageOccupancy: 0},
    }),
  }, async (baseUrl) => {
    const response = await post(baseUrl, {employeeIds: []});
    assert.equal(response.status, 400);
  });
});

test("accepted/rejected groups, stops, issues and employee coverage are exposed as HTTP DTOs", async () => {
  await withServer({employeeStore: store([e1, e2, e3]), optimize: async (_origin, employees) => ({...result, summary: {...result.summary, totalEmployees: employees.length}})}, async (baseUrl) => {
    const response = await post(baseUrl, {employeeIds: selected});
    assert.equal(response.status, 200);
    const body = await response.json() as typeof result & {groups: Array<Record<string, unknown>>};
    const group = body.groups[0]!;
    assert.equal(group.status, "REJECTED");
    assert.equal(group.acceptable, false);
    assert.deepEqual((group.stops as Array<Record<string, unknown>>).map((stop) => stop.type), ["ORIGIN", "EMPLOYEE", "EMPLOYEE"]);
    assert.equal((group.stops as Array<Record<string, unknown>>)[1]!.employeeId, e1.id);
    assert.equal((group.violations as unknown as Array<Record<string, unknown>>)[0]!.employeeId, e2.id);
    assert.equal((body.issues[0] as Record<string, unknown>).employeeId, e3.id);
    const groupIds = (group.employees as unknown as Array<Record<string, unknown>>).map((item) => item.id);
    const issueIds = body.issues.map((issue) => (issue as Record<string, unknown>).employeeId).filter(Boolean);
    assert.deepEqual(new Set([...groupIds, ...issueIds]), new Set([e1.id, e2.id, e3.id]));
  });
});

test("unroutable issue includes a safe employee DTO", async () => {
  await withServer({employeeStore: store([e1, e2, e3]), optimize: async () => result}, async (baseUrl) => {
    const response = await post(baseUrl, {employeeIds: selected});
    const body = await response.json() as {issues: Array<Record<string, unknown>>};
    const issue = body.issues[0]!;
    assert.deepEqual(issue.employee, {id: e3.id, name: e3.name, latitude: e3.latitude, longitude: e3.longitude});
    assert.equal((issue.employee as Record<string, unknown>).address, undefined);
    assert.equal((issue.employee as Record<string, unknown>).phone, undefined);
  });
});

test("invalid HTTP input returns 400", async () => {
  await withServer({employeeStore: store([])}, async (baseUrl) => {
    const response = await post(baseUrl, []);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {error: {code: "INVALID_REQUEST", message: "O corpo da requisição deve ser um objeto JSON."}});
  });
});

test("unsupported optimization filters are rejected instead of being ignored", async () => {
  await withServer({employeeStore: store([])}, async (baseUrl) => {
    const response = await post(baseUrl, {employees: []});
    assert.equal(response.status, 400);
    assert.equal((await response.json() as {error: {code: string}}).error.code, "INVALID_REQUEST");
  });
});

test("selection validates unknown and duplicate IDs and only optimizes selected employees", async () => {
  let received: string[] = [];
  await withServer({employeeStore: store([e1, e2, e3]), optimize: async (_origin, employees) => {
    received = employees.map((employee) => employee.id);
    return {...result, groups: [], issues: [], summary: {...result.summary, totalEmployees: employees.length, totalGroups: 0, rejectedGroups: 0, acceptableGroups: 0, unroutableEmployees: 0, averageOccupancy: 0}};
  }}, async (baseUrl) => {
    assert.equal((await post(baseUrl, {employeeIds: [e1.id, e3.id]})).status, 200);
    assert.deepEqual(received, [e1.id, e3.id]);
    assert.equal((await post(baseUrl, {employeeIds: [e1.id, e1.id]})).status, 400);
    assert.equal((await post(baseUrl, {employeeIds: ["missing"]})).status, 400);
    assert.equal((await post(baseUrl, {})).status, 400);
  });
});

test("provider failures map to safe upstream errors", async () => {
  await withServer({
    employeeStore: store([e1]),
    optimize: async () => { throw new RoutingProviderError("secret API_KEY and stack", "UPSTREAM", 503); },
  }, async (baseUrl) => {
    const response = await post(baseUrl, {employeeIds: [e1.id]});
    assert.equal(response.status, 503);
    const body = await response.json() as {error: {code: string; message: string}};
    assert.equal(body.error.code, "ROUTING_PROVIDER_UNAVAILABLE");
    assert.equal(body.error.message.includes("API_KEY"), false);
    assert.equal(JSON.stringify(body).includes("stack"), false);
  });
});

test("unexpected failures map to a safe 500", async () => {
  const original = console.error;
  console.error = () => undefined;
  try {
    await withServer({employeeStore: store([e1]), optimize: async () => { throw new Error("private stack"); }}, async (baseUrl) => {
      const response = await post(baseUrl, {employeeIds: [e1.id]});
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), {error: {code: "INTERNAL_ERROR", message: "Ocorreu um erro interno."}});
    });
  } finally { console.error = original; }
});

test("concurrent optimization requests share one execution", async () => {
  let calls = 0;
  await withServer({
      employeeStore: store([e1]),
    optimize: async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return result;
    },
  }, async (baseUrl) => {
    const responses = await Promise.all([post(baseUrl, {employeeIds: [e1.id]}), post(baseUrl, {employeeIds: [e1.id]})]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.equal(calls, 1);
  });
});

test("concurrent different selections never share an execution", async () => {
  const received: string[][] = [];
  await withServer({
    employeeStore: store([e1, e2, e3]),
    optimize: async (_origin, employees) => {
      received.push(employees.map((employee) => employee.id));
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {...result, groups: [], issues: [], summary: {...result.summary, totalEmployees: employees.length, totalGroups: 0, acceptableGroups: 0, rejectedGroups: 0, unroutableEmployees: 0, averageOccupancy: 0}};
    },
  }, async (baseUrl) => {
    const responses = await Promise.all([
      post(baseUrl, {employeeIds: [e1.id]}),
      post(baseUrl, {employeeIds: [e2.id]}),
    ]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.deepEqual(received.sort(), [[e1.id], [e2.id]].sort());
  });
});
