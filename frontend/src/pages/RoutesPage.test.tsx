import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import {RoutesPage} from "./RoutesPage";
import {api, ApiError} from "../services/api";
import type {OptimizationResponse} from "../types/api";

vi.mock("../components/RouteMap", () => ({
  RouteMap: () => <div data-testid="route-map">Mapa</div>,
}));

function resultFixture(): OptimizationResponse {
  return {
    groups: [
      {
        groupNumber: 1,
        status: "ACCEPTED",
        acceptable: true,
        employees: [{id: "ana", name: "Ana", latitude: -8.1, longitude: -34.9}],
        stops: [
          {type: "ORIGIN", id: "company", name: "Empresa", latitude: -8.16, longitude: -34.94},
          {type: "EMPLOYEE", id: "ana", employeeId: "ana", name: "Ana", latitude: -8.1, longitude: -34.9},
        ],
        totalDurationSeconds: 900,
        totalDistanceMeters: 4_500,
        averageExtraDurationSeconds: 120,
        maxExtraDurationSeconds: 240,
        passengerMetrics: [],
        violations: [],
      },
      {
        groupNumber: 2,
        status: "REJECTED",
        acceptable: false,
        employees: [{id: "bruno", name: "Bruno", latitude: -8.11, longitude: -34.91}],
        stops: [
          {type: "ORIGIN", id: "company", name: "Empresa", latitude: -8.16, longitude: -34.94},
          {type: "EMPLOYEE", id: "bruno", employeeId: "bruno", name: "Bruno", latitude: -8.11, longitude: -34.91},
        ],
        totalDurationSeconds: 1_800,
        totalDistanceMeters: 9_000,
        averageExtraDurationSeconds: 900,
        maxExtraDurationSeconds: 1_560,
        passengerMetrics: [],
        violations: [{type: "MAX_EXTRA_DURATION", employeeId: "bruno", name: "Bruno", actualValue: 1_560, limit: 900}],
      },
    ],
    issues: [{
      type: "UNROUTABLE_EMPLOYEE",
      employeeId: "joelson3",
      employee: {id: "joelson3", name: "Joelson3", latitude: -8.2, longitude: -34.8},
      reason: "Route unavailable",
      relations: [{fromId: "company", toId: "joelson3"}],
    }],
    summary: {
      totalEmployees: 3,
      totalGroups: 2,
      acceptableGroups: 1,
      rejectedGroups: 1,
      unavailableGroups: 0,
      unroutableEmployees: 1,
      averageOccupancy: 1,
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("RoutesPage", () => {
  it("starts with a useful empty state", () => {
    render(<RoutesPage employeeCount={24} />);

    expect(screen.getByRole("heading", {name: "Nenhuma rota gerada"})).toBeInTheDocument();
    expect(screen.getByText("24 funcionários cadastrados")).toBeInTheDocument();
    expect(screen.getAllByRole("button", {name: "Gerar rotas"})).toHaveLength(2);
  });

  it("loads the isolated demo dataset and sends only selected demo employees", async () => {
    const realEmployee = {id: "real-1", name: "Real", address: "Rua Real", phone: "1", latitude: -8.1, longitude: -34.9};
    const demoEmployee = {id: "demo-01", name: "Lucas Almeida", address: "Centro, Cabo", phone: "(81) 99000-0001", latitude: -8.29, longitude: -35.03};
    vi.spyOn(api, "listEmployees").mockResolvedValue([realEmployee]);
    vi.spyOn(api, "listDemoEmployees").mockResolvedValue([demoEmployee]);
    const optimizeDemo = vi.spyOn(api, "optimizeDemoRoutes").mockResolvedValue({...resultFixture(), groups: [], issues: [], summary: {...resultFixture().summary, totalEmployees: 1, totalGroups: 0, acceptableGroups: 0, rejectedGroups: 0, unroutableEmployees: 0}});
    const user = userEvent.setup();
    render(<RoutesPage />);

    await user.click(screen.getByRole("button", {name: "Usar dados de demonstração"}));
    expect(await screen.findByText("Modo demonstração")).toBeInTheDocument();
    expect(screen.getByText("1 funcionário fictício disponível. Nenhum dado será salvo na organização.")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", {name: "Gerar rotas"})[0]!);
    await user.click(screen.getByRole("checkbox", {name: /Lucas Almeida/}));
    await user.click(screen.getByRole("button", {name: "Gerar rotas para 1"}));
    await waitFor(() => expect(optimizeDemo).toHaveBeenCalledWith(["demo-01"]));
    await user.click(screen.getByRole("button", {name: "Sair do modo demonstração"}));
    await waitFor(() => expect(screen.getByText("Nenhuma rota gerada")).toBeInTheDocument());
    expect(screen.queryByText("Modo demonstração")).not.toBeInTheDocument();
  });

  it("shows honest loading feedback and renders accepted, rejected and issue states", async () => {
    let resolveRequest!: (value: OptimizationResponse) => void;
    vi.spyOn(api, "optimizeRoutes").mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    vi.spyOn(api, "listEmployees").mockResolvedValue([
      {id: "ana", name: "Ana", address: "Rua Ana", phone: "1", latitude: -8.1, longitude: -34.9},
      {id: "bruno", name: "Bruno", address: "Rua Bruno", phone: "1", latitude: -8.1, longitude: -34.9},
      {id: "joelson3", name: "Joelson3", address: "Rua Joelson", phone: "1", latitude: -8.1, longitude: -34.9},
    ]);
    const user = userEvent.setup();
    render(<RoutesPage employeeCount={24} />);

    await user.click(screen.getAllByRole("button", {name: "Gerar rotas"})[0]!);
    await user.click(screen.getByRole("checkbox", {name: /Ana/}));
    await user.click(screen.getByRole("button", {name: "Gerar rotas para 1"}));
    expect(screen.getByText("Otimizando rotas...")).toBeInTheDocument();
    expect(screen.getByText(/Estamos analisando 1 funcionário/)).toBeInTheDocument();
    expect(screen.getByText("Tempo decorrido:")).toBeInTheDocument();
    expect(screen.getByText("0s")).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Calculando..."})).toBeDisabled();

    resolveRequest(resultFixture());
    await waitFor(() => expect(screen.getByRole("heading", {name: "Grupos de transporte"})).toBeInTheDocument());
    expect(screen.getByText("Rota válida")).toBeInTheDocument();
    expect(screen.getAllByText("Requer atenção").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Bruno terá 26 min de desvio/)).toBeInTheDocument();
    expect(screen.getByText("Problemas encontrados")).toBeInTheDocument();
    expect(screen.getByText("Joelson3")).toBeInTheDocument();
  });

  it("translates API failures and allows a manual retry", async () => {
    const optimize = vi.spyOn(api, "optimizeRoutes")
      .mockRejectedValueOnce(new ApiError(504, "ROUTING_PROVIDER_TIMEOUT"))
      .mockResolvedValueOnce(resultFixture());
    vi.spyOn(api, "listEmployees").mockResolvedValue([
      {id: "ana", name: "Ana", address: "Rua Ana", phone: "1", latitude: -8.1, longitude: -34.9},
    ]);
    const user = userEvent.setup();
    render(<RoutesPage />);

    await user.click(screen.getAllByRole("button", {name: "Gerar rotas"})[0]!);
    await user.click(screen.getByRole("checkbox", {name: /Ana/}));
    await user.click(screen.getByRole("button", {name: "Gerar rotas para 1"}));
    await waitFor(() => expect(screen.getByText("O serviço de rotas demorou mais que o esperado.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", {name: "Tentar novamente"}));
    await waitFor(() => expect(screen.getByRole("heading", {name: "Grupos de transporte"})).toBeInTheDocument());
    expect(optimize).toHaveBeenCalledTimes(2);
  });

  it("updates elapsed time while the optimization is pending", async () => {
    vi.useFakeTimers();
    let resolveRequest!: (value: OptimizationResponse) => void;
    vi.spyOn(api, "optimizeRoutes").mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    vi.spyOn(api, "listEmployees").mockResolvedValue([
      {id: "ana", name: "Ana", address: "Rua Ana", phone: "1", latitude: -8.1, longitude: -34.9},
    ]);
    try {
      render(<RoutesPage />);
      await act(async () => { await Promise.resolve(); });
      fireEvent.click(screen.getAllByRole("button", {name: "Gerar rotas"})[0]!);
      fireEvent.click(screen.getByRole("checkbox", {name: /Ana/}));
      fireEvent.click(screen.getByRole("button", {name: "Gerar rotas para 1"}));
      act(() => { vi.advanceTimersByTime(5000); });
      expect(screen.getByText("5s")).toBeInTheDocument();
      await act(async () => { resolveRequest(resultFixture()); await Promise.resolve(); });
    } finally {
      vi.useRealTimers();
    }
  });
});
