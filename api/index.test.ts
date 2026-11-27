import assert from "node:assert/strict";
import {createServer} from "node:http";
import type {AddressInfo} from "node:net";
import {readFileSync} from "node:fs";
import {test} from "node:test";

// The Vercel handler must boot without DATABASE_URL (previews) and serve only
// /health and the guest playground; private routes answer a clear 503.
test("Vercel handler without DATABASE_URL serves guest mode and rejects private routes", async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const {default: handler} = await import("./index.js");
  const server = createServer((request, response) => void handler(request, response));
  server.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${url}/health`)).status, 200);
    const guest = await fetch(`${url}/api/guest/employees`);
    assert.equal(guest.status, 200);
    assert.ok(((await guest.json()) as unknown[]).length > 0);
    for (const [method, path] of [["GET", "/employees"], ["GET", "/api/auth/me"], ["POST", "/api/auth/google"], ["POST", "/api/routes/optimize"], ["POST", "/api/geocoding/preview"]] as const) {
      const response = await fetch(`${url}${path}`, {method, headers: {"Content-Type": "application/json"}, ...(method === "POST" ? {body: "{}"} : {})});
      assert.equal(response.status, 503, `${method} ${path}`);
      assert.equal(((await response.json()) as {error: {code: string}}).error.code, "PRIVATE_API_UNAVAILABLE");
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  }
});

test("vercel.json sends the security headers on every path", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {headers: Array<{source: string; headers: Array<{key: string; value: string}>}>};
  const all = config.headers.find((entry) => entry.source === "/(.*)");
  assert.ok(all, "catch-all header rule");
  const byKey = new Map(all.headers.map(({key, value}) => [key.toLowerCase(), value]));
  for (const key of ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"]) {
    assert.ok(byKey.get(key), `missing ${key}`);
  }
  const csp = byKey.get("content-security-policy")!;
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  // Google Identity Services injects inline styles, so only style-src may be relaxed.
  const scriptSrc = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src")) ?? "";
  assert.doesNotMatch(scriptSrc, /unsafe-inline/);
});
