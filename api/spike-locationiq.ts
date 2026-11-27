// THROWAWAY SPIKE for P0-2 (never merged): measures the real LocationIQ Matrix
// limits with the preview key. Runs only on Vercel previews and only once per
// function instance, to cap quota use. Never returns the key or provider URLs.
import type {IncomingMessage, ServerResponse} from "node:http";
import {DEMO_EMPLOYEES} from "../src/demo/demo-employees.js";
import {company} from "../src/company/company.config.js";

type Point = {latitude: number; longitude: number};
let alreadyRan = false;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function points(): Point[] {
  const synthetic: Point[] = [];
  // Inland grid west/south-west of the company (avoids the sea to the east).
  for (const lat of [-8.12, -8.18, -8.24, -8.30]) for (const lon of [-34.97, -35.00, -35.03]) synthetic.push({latitude: lat, longitude: lon});
  synthetic.push({latitude: -8.15, longitude: -35.05});
  return [company.coordinates, ...DEMO_EMPLOYEES.map(({latitude, longitude}) => ({latitude, longitude})), ...synthetic];
}

async function balance(key: string): Promise<unknown> {
  const response = await fetch(`https://us1.locationiq.com/v1/balance?key=${encodeURIComponent(key)}&format=json`, {signal: AbortSignal.timeout(10_000)});
  return {status: response.status, body: await response.json().catch(() => null)};
}

async function matrix(key: string, coords: Point[], extra: Record<string, string> = {}) {
  const path = coords.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const params = new URLSearchParams({key, annotations: "distance,duration", ...extra});
  const started = Date.now();
  try {
    const response = await fetch(`https://us1.locationiq.com/v1/matrix/driving/${path}?${params}`, {signal: AbortSignal.timeout(20_000)});
    const body = await response.json().catch(() => null) as {code?: string; durations?: (number | null)[][]; message?: string} | null;
    const rows = body?.durations?.length ?? 0;
    const cols = body?.durations?.[0]?.length ?? 0;
    const nulls = body?.durations?.flat().filter((value) => value === null).length ?? 0;
    return {k: coords.length, ...extra, http: response.status, code: body?.code ?? null, message: body?.message ?? null, shape: `${rows}x${cols}`, nullCells: nulls, ms: Date.now() - started, rateLimitRemaining: response.headers.get("x-ratelimit-remaining-second"), retryAfter: response.headers.get("retry-after")};
  } catch (error) {
    return {k: coords.length, ...extra, error: error instanceof Error ? error.name : "unknown", ms: Date.now() - started};
  }
}

export default async function handler(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  const key = process.env.LOCATIONIQ_API_KEY;
  if (process.env.VERCEL_ENV !== "preview" || !key) { response.statusCode = 404; response.end("{}"); return; }
  if (alreadyRan) { response.statusCode = 409; response.end(JSON.stringify({error: "spike already ran on this instance"})); return; }
  alreadyRan = true;
  const all = points();
  const results: unknown[] = [];
  const before = await balance(key);
  await sleep(1100);
  // 1) A single 6-point call, bracketed by balance reads, to learn how a matrix is billed.
  results.push(await matrix(key, all.slice(0, 6)));
  await sleep(1100);
  const afterOne = await balance(key);
  // 2) Growing sizes until the provider refuses.
  let maxAccepted = 6;
  for (const k of [12, 18, 25]) {
    await sleep(1100);
    const result = await matrix(key, all.slice(0, k));
    results.push(result);
    if ((result as {code?: string}).code === "Ok") maxAccepted = k; else break;
  }
  // 3) Rectangular request inside the 25-point limit: 12 sources x 13 destinations.
  await sleep(1100);
  results.push(await matrix(key, all.slice(0, 25), {sources: Array.from({length: 12}, (_, i) => i).join(";"), destinations: Array.from({length: 13}, (_, i) => i + 12).join(";")}));
  // 4) One request above the documented limit, to see the error shape.
  await sleep(1100);
  results.push(await matrix(key, [...all, {latitude: -8.2, longitude: -35.06}]));
  await sleep(1100);
  const after = await balance(key);
  response.end(JSON.stringify({totalPoints: all.length, maxAccepted, balance: {before, afterOne, after}, results}, null, 2));
}
