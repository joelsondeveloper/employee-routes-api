import {describe, expect, it} from "vitest";
import {friendlyApiError, friendlyViolation} from "./messages";

describe("operator messages", () => {
  it("translates backend errors without exposing technical details", () => {
    expect(friendlyApiError("ROUTING_PROVIDER_TIMEOUT")).toContain("demorou");
    expect(friendlyApiError("UNKNOWN_CODE")).toContain("Não foi possível");
  });
  it("translates the hard constraint violation", () => {
    expect(friendlyViolation("MAX_EXTRA_DURATION", "Matheus Silva", 1561.8, 900)).toBe("Matheus Silva terá 26 min de desvio. Limite configurado: 15 min.");
  });
});
