import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";
import {OptimizationSettings, defaultOptimizationRequest} from "./OptimizationSettings";

describe("OptimizationSettings", () => {
  it("starts in normal mode and exposes conservative/custom choices", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<OptimizationSettings value={defaultOptimizationRequest()} onChange={onChange} />);
    expect(screen.getByText("Configuração atual validada.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", {name: /Conservador/}));
    expect(onChange).toHaveBeenCalledWith({optimizationProfile: "CONSERVATIVE"});
    await user.click(screen.getByRole("radio", {name: /Personalizado/}));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({optimizationProfile: "CUSTOM"}));
  });
});
