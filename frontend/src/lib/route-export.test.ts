import {describe, expect, it} from "vitest";
import {buildUberPreview, csvCell, operationalCsv, routeText} from "./route-export";
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
  it("neutralizes spreadsheet formulas but keeps negative coordinates numeric", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+5581999999999")).toBe("'+5581999999999");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-cmd")).toBe("'-cmd");
    expect(csvCell('=HYPERLINK("http://x","clique")')).toBe(`"'=HYPERLINK(""http://x"",""clique"")"`);
    expect(csvCell("-8.1678849")).toBe("-8.1678849");
    expect(csvCell("Ana Souza")).toBe("Ana Souza");
    const hostile = employees.map((employee, index) => index === 0 ? {...employee, address: "=cmd|' /C calc'!A0"} : employee);
    const csv = operationalCsv(result, hostile);
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).not.toMatch(/(^|,)=cmd/m);
  });
});
