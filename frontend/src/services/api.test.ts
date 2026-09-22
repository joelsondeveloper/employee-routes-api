import {afterEach, describe, expect, it, vi} from "vitest";
import {api} from "./api";
import {optimizationFixture} from "../test/optimization.fixture";

afterEach(() => vi.unstubAllGlobals());

describe("HTTP client", () => {
  it("sends only an empty object to optimize, without a timeout or client retries", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(optimizationFixture()));
    vi.stubGlobal("fetch", fetch);
    await api.optimizeRoutes(["employee-1", "employee-2"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/routes\/optimize$/);
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({employeeIds: ["employee-1", "employee-2"]}));
    expect(options.signal).toBeUndefined();
  });

  it.each([
    [400, {message: "Address not found"}, "ADDRESS_NOT_FOUND"],
    [400, {error: "Address not found."}, "ADDRESS_NOT_FOUND"],
    [502, {error: "Geocoding service is unavailable."}, "GEOCODING_UNAVAILABLE"],
    [404, {error: "Employee not found"}, "EMPLOYEE_NOT_FOUND"],
  ])("normalizes employee HTTP %s responses", async (status, body, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body, {status})));
    await expect(api.createEmployee({name: "Ana", address: "Rua", phone: "81999990000"})).rejects.toMatchObject({code});
  });

  it("does not expose raw technical messages from the provider", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      error: {code: "ROUTING_PROVIDER_UNAVAILABLE", message: "SECRET key and local stack"},
    }, {status: 503})));
    await expect(api.optimizeRoutes(["employee-1"])).rejects.toMatchObject({code: "ROUTING_PROVIDER_UNAVAILABLE"});
    await expect(api.optimizeRoutes(["employee-1"])).rejects.not.toHaveProperty("message", "SECRET key and local stack");
  });

  it("handles a bodyless delete and preserves network errors", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, {status: 204})).mockRejectedValueOnce(new TypeError("secret"));
    vi.stubGlobal("fetch", fetch);
    await expect(api.deleteEmployee("id/with slash")).resolves.toBeUndefined();
    expect(fetch.mock.calls[0][0]).toMatch(/id%2Fwith%20slash$/);
    await expect(api.deleteEmployee("x")).rejects.toMatchObject({code: "NETWORK_ERROR"});
  });

  it("rejects invalid JSON instead of treating it as a successful result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not JSON")));
    await expect(api.optimizeRoutes(["employee-1"])).rejects.toMatchObject({code: "INVALID_RESPONSE"});
  });
});
