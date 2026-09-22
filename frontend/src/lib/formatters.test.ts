import {describe, expect, it} from "vitest";
import {formatDistance, formatDuration, formatExtraDuration} from "./formatters";

describe("route formatters", () => {
  it("formats backend seconds and meters for operators", () => {
    expect(formatDuration(775.8)).toBe("12,9 min");
    expect(formatDistance(9070)).toBe("9,1 km");
    expect(formatExtraDuration(0)).toBe("Sem desvio");
    expect(formatExtraDuration(1561.8)).toBe("26 min de desvio");
  });
});
