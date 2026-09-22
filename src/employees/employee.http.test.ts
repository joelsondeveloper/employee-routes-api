import assert from "node:assert/strict";
import {test} from "node:test";
import type {AddressInfo} from "node:net";
import {createApp} from "../app.js";
import type {Employee} from "./employee.types.js";

function memoryStore(initial: Employee[]) {
  const rows = [...initial];
  return {
    rows,
    prepare(sql: string) {
      return {
        all: () => rows,
        get: (id?: string) => rows.find((employee) => employee.id === id),
        run: (...params: unknown[]) => {
          if (sql.includes("INSERT INTO")) {
            rows.push({id: String(params[0]), name: String(params[1]), address: String(params[2]), phone: String(params[3]), latitude: Number(params[4]), longitude: Number(params[5])});
            return {changes: 1};
          }
          if (sql.includes("UPDATE employees")) {
            const employee = rows.find((item) => item.id === params[5]);
            if (!employee) return {changes: 0};
            Object.assign(employee, {name: params[0], address: params[1], phone: params[2], latitude: params[3], longitude: params[4]});
            return {changes: 1};
          }
          const index = rows.findIndex((item) => item.id === params[0]);
          if (index < 0) return {changes: 0};
          rows.splice(index, 1);
          return {changes: 1};
        },
      };
    },
  };
}

async function withServer(options: Parameters<typeof createApp>[0], callback: (url: string) => Promise<void>) {
  const server = createApp(options).listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const existing: Employee = {id: "e1", name: "Ana", address: "Rua antiga", phone: "81999990000", latitude: -8.1, longitude: -34.9};

test("employee coordinates are accepted, preserved and updated without geocoding", async () => {
  const store = memoryStore([existing]);
  let geocodeCalls = 0;
  await withServer({employees: {employeeStore: store, geocode: async () => { geocodeCalls++; return {latitude: 1, longitude: 1}; }}}, async (url) => {
    const created = await fetch(`${url}/employees`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({name: "Bruno", address: "Rua corrigida", phone: "81888888888", latitude: -8.2, longitude: -34.8})});
    assert.equal(created.status, 201);
    assert.deepEqual((await created.json() as Employee).latitude, -8.2);
    assert.equal(geocodeCalls, 0);

    const updated = await fetch(`${url}/employees/e1`, {method: "PUT", headers: {"content-type": "application/json"}, body: JSON.stringify({name: "Ana", address: "Rua antiga", phone: existing.phone, latitude: -8.3, longitude: -34.7})});
    assert.equal(updated.status, 200);
    assert.deepEqual((await updated.json() as Employee).longitude, -34.7);
    assert.equal(geocodeCalls, 0);
  });
});

test("partial or invalid coordinates are rejected before geocoding", async () => {
  const store = memoryStore([]);
  await withServer({employees: {employeeStore: store, geocode: async () => ({latitude: 1, longitude: 1})}}, async (url) => {
    for (const coordinates of [{latitude: -8}, {longitude: -34}, {latitude: Number.NaN, longitude: 1}, {latitude: 91, longitude: 1}]) {
      const response = await fetch(`${url}/employees`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({name: "Teste", address: "Rua", phone: "1", ...coordinates})});
      assert.equal(response.status, 400);
    }
  });
});

test("address without explicit coordinates keeps automatic geocoding", async () => {
  const store = memoryStore([]);
  let calls = 0;
  await withServer({employees: {employeeStore: store, geocode: async () => { calls++; return {latitude: -8.4, longitude: -34.6}; }}}, async (url) => {
    const response = await fetch(`${url}/employees`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({name: "Geocodificada", address: "Rua", phone: "1"})});
    assert.equal(response.status, 201);
    assert.equal(calls, 1);
    assert.equal((await response.json() as Employee).latitude, -8.4);
  });
});
