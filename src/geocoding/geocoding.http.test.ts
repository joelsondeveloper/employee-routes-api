import assert from "node:assert/strict";
import {test} from "node:test";
import type {AddressInfo} from "node:net";
import {createApp} from "../app.js";
import {GeocodingNotFoundError, GeocodingProviderError} from "./geocoding.errors.js";

async function withServer(geocode: (address: string) => Promise<{latitude: number; longitude: number}>, callback: (url: string) => Promise<void>) {
  const server = createApp({geocoding: {geocode}}).listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("geocoding preview returns only confirmed coordinates", async () => {
  await withServer(async () => ({latitude: -8.12, longitude: -34.91}), async (url) => {
    const response = await fetch(`${url}/api/geocoding/preview`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({address: "Rua teste"})});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {latitude: -8.12, longitude: -34.91});
  });
});

test("geocoding preview maps not found and provider errors safely", async () => {
  await withServer(async () => { throw new GeocodingNotFoundError(); }, async (url) => {
    const response = await fetch(`${url}/api/geocoding/preview`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({address: "inexistente"})});
    assert.equal(response.status, 404);
    assert.equal((await response.json() as {error: {code: string}}).error.code, "GEOCODING_NOT_FOUND");
  });
  await withServer(async () => { throw new GeocodingProviderError("secret"); }, async (url) => {
    const response = await fetch(`${url}/api/geocoding/preview`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({address: "Rua"})});
    assert.equal(response.status, 502);
    const body = JSON.stringify(await response.json());
    assert.equal(body.includes("secret"), false);
  });
});
