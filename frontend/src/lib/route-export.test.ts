import {describe, expect, it} from "vitest";
import {buildUberPreview, operationalCsv, routeText} from "./route-export";
import {optimizationFixture} from "../test/optimization.fixture";
import type {Employee} from "../types/api";

describe("route exporters", () => {
  const result = optimizationFixture();
  const employees = result.groups.flatMap(group => group.employees).map(employee => ({...employee, address: "Rua, 10", phone: "81999999999"})) as Employee[];
  it("creates a valid Uber preview without making a request", () => {
    const preview = buildUberPreview(result, employees);
    expect(preview.length).toBe(result.groups.length);
    expect(preview.some(item => item.ready)).toBe(true);
    expect((preview.find(item => item.ready)?.payload as Record<string, unknown>).pickup).toBeDefined();
  });
  it("escapes CSV and creates text output", () => {
    expect(operationalCsv(result, employees)).toContain('"Rua, 10"');
    expect(routeText(result)).toContain("ROTA 1");
  });
});
