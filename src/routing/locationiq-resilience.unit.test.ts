import assert from "node:assert/strict";
import {afterEach, beforeEach, test} from "node:test";
import {geocodeAddress} from "../geocoding/geocoding.service.js";
import {GeocodingProviderError} from "../geocoding/geocoding.errors.js";
import {optimizationErrorResponse} from "../optimization/optimization.routes.js";
import {LocationIQRoutingProvider} from "./providers/locationiq-routing.provider.js";
import {RouteUnavailableError, RoutingProviderError} from "./routing.errors.js";

const points = [{id: "company", latitude: -8.16, longitude: -34.94}, {id: "a", latitude: -8.2, longitude: -34.95}];
const okMatrix = () => Response.json({code: "Ok", durations: [[0, 60], [60, 0]], distances: [[0, 100], [100, 0]]});
const fast = () => new LocationIQRoutingProvider({minIntervalMs: 0, baseBackoffMs: 1, timeoutMs: 50, random: () => 0});

const originalFetch = globalThis.fetch;
const originalKey = process.env.LOCATIONIQ_API_KEY;
beforeEach(() => { process.env.LOCATIONIQ_API_KEY = "unit-test"; });
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.LOCATIONIQ_API_KEY; else process.env.LOCATIONIQ_API_KEY = originalKey;
});

test("a transient 503 is retried and the next answer is used", async () => {
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1 ? new Response("busy", {status: 503}) : okMatrix());
  const matrix = await fast().getMatrix(points);
  assert.equal(calls, 2);
  assert.equal(matrix.metrics[0]![1]!.durationSeconds, 60);
});

test("network failures are retried up to the attempt limit, then surface as provider errors", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError("fetch failed"); };
  await assert.rejects(fast().getMatrix(points), RoutingProviderError);
  assert.equal(calls, 3);
});

test("a hung request is aborted by the per-attempt timeout and maps to HTTP 504", async () => {
  let calls = 0;
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    calls++;
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  });
  const started = Date.now();
  // AbortSignal.timeout uses an unref'd timer. In the server the open HTTP request
  // keeps the event loop alive; here nothing does, so hold it for the duration.
  const keepAlive = setInterval(() => undefined, 1_000);
  const error = await fast().getMatrix(points).then(() => undefined, (caught: unknown) => caught).finally(() => clearInterval(keepAlive));
  assert.ok(error instanceof RoutingProviderError);
  assert.equal(calls, 3);
  assert.ok(Date.now() - started < 2_000, "the timeout, not the test runner, ended the request");
  assert.equal(optimizationErrorResponse(error).status, 504);
});

test("domain answers (4xx) and auth failures are never retried", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({code: "NoTable"}, {status: 400}); };
  await assert.rejects(fast().getMatrix(points), RouteUnavailableError);
  assert.equal(calls, 1);
  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("no", {status: 401}); };
  await assert.rejects(fast().getMatrix(points), RoutingProviderError);
  assert.equal(calls, 1);
});

test("backoff grows exponentially with jitter between retries", async () => {
  const starts: number[] = [];
  globalThis.fetch = async () => { starts.push(Date.now()); return starts.length < 3 ? new Response(null, {status: 500}) : okMatrix(); };
  await new LocationIQRoutingProvider({minIntervalMs: 0, baseBackoffMs: 40, random: () => 0.5}).getMatrix(points);
  // 40 * 2^0 * 1.5 = 60 ms, then 40 * 2^1 * 1.5 = 120 ms.
  assert.ok(starts[1]! - starts[0]! >= 55, `${starts[1]! - starts[0]!} ms`);
  assert.ok(starts[2]! - starts[1]! >= 115, `${starts[2]! - starts[1]!} ms`);
});

test("geocoding retries one transient failure and reports persistent ones", async () => {
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1 ? new Response(null, {status: 502}) : Response.json([{lat: "-8.1", lon: "-34.9"}]));
  assert.deepEqual(await geocodeAddress("Rua A"), {latitude: -8.1, longitude: -34.9});
  assert.equal(calls, 2);
  calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError("fetch failed"); };
  await assert.rejects(geocodeAddress("Rua A"), GeocodingProviderError);
  assert.equal(calls, 2);
});
