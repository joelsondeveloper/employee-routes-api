import {render, screen, within, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import App from "./App";
import {RoutesPage} from "./pages/RoutesPage";
import {api, ApiError} from "./services/api";
import {optimizationFixture, employeeFixture} from "./test/optimization.fixture";
import type {OptimizationResponse} from "./types/api";

vi.mock("./components/RouteMap", () => ({RouteMap: () => <div>Mapa de teste</div>}));
beforeEach(() => {
  vi.spyOn(api, "health").mockResolvedValue({status: "ok"});
  vi.spyOn(api, "listEmployees").mockResolvedValue([employeeFixture]);
});
afterEach(() => vi.restoreAllMocks());

it("keeps the in-flight operation and result across navigation, with one request", async () => {
  let resolve!: (result: OptimizationResponse) => void;
  const optimize = vi.spyOn(api, "optimizeRoutes").mockReturnValue(new Promise((r) => { resolve = r; }));
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getAllByRole("button", {name: "Gerar rotas"})[0]);
  await user.click(screen.getByRole("checkbox", {name: /Ana/}));
  await user.dblClick(screen.getByRole("button", {name: "Gerar rotas para 1"}));
  expect(optimize).toHaveBeenCalledTimes(1);
  expect(optimize).toHaveBeenCalledWith([employeeFixture.id]);
  await user.click(screen.getByRole("button", {name: "Funcionários"}));
  await screen.findByText("Ana");
  await user.click(screen.getByRole("button", {name: "Rotas"}));
  expect(screen.getByRole("button", {name: "Calculando..."})).toBeDisabled();
  resolve(optimizationFixture());
  await screen.findByRole("button", {name: "Selecionar carro 9"});
  await user.click(screen.getByRole("button", {name: "Funcionários"}));
  await user.click(screen.getByRole("button", {name: "Rotas"}));
  expect(screen.getByRole("button", {name: "Selecionar carro 9"})).toBeInTheDocument();
  expect(optimize).toHaveBeenCalledTimes(1);
});

it("renders all nine groups, official states, named issue, passenger detail and stop sequence", async () => {
  const result = optimizationFixture();
  result.groups[0].employees.reverse();
  vi.spyOn(api, "optimizeRoutes").mockResolvedValue(result);
  const user = userEvent.setup();
  render(<RoutesPage />);
  await user.click(screen.getAllByRole("button", {name: "Gerar rotas"})[0]);
  await user.click(screen.getByRole("checkbox", {name: /Ana/}));
  await user.click(screen.getByRole("button", {name: "Gerar rotas para 1"}));
  await screen.findByRole("button", {name: "Selecionar carro 9"});
  expect(screen.getAllByRole("button", {name: /Selecionar carro/})).toHaveLength(9);
  expect(screen.getAllByText("Rota válida")).toHaveLength(8);
  expect(screen.getByText("Matheus Silva terá 26 min de desvio. Limite configurado: 15 min.")).toBeVisible();
  expect(screen.getByText("Joelson3")).toBeVisible();
  const order = within(screen.getByRole("list", {name: "Ordem das paradas do carro 1"}))
    .getAllByRole("listitem").map((element) => element.textContent?.replace(/^\d+/, ""));
  expect(order).toEqual(["Empresa", "Vinícius Carvalho", "André Lima", "Bruno Ferreira", "Thiago Rodrigues"]);
  expect(screen.getByText(/23 funcionários em 9 carros calculáveis; 1/)).toBeVisible();
  const accountedIds = [
    ...result.groups.flatMap((group) => group.employees.map((employee) => employee.id)),
    ...result.issues.map((issue) => issue.employeeId),
  ];
  expect(accountedIds).toHaveLength(24);
  expect(new Set(accountedIds).size).toBe(24);
});

it("selects groups by keyboard and exposes map selection and sequence disclaimer", async () => {
  vi.spyOn(api, "optimizeRoutes").mockResolvedValue(optimizationFixture());
  const user = userEvent.setup();
  render(<RoutesPage />);
  await user.click(screen.getAllByRole("button", {name: "Gerar rotas"})[0]);
  await user.click(screen.getByRole("checkbox", {name: /Ana/}));
  await user.click(screen.getByRole("button", {name: "Gerar rotas para 1"}));
  const select = await screen.findByRole("button", {name: "Selecionar carro 4"});
  select.focus();
  await user.keyboard(" ");
  expect(select).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Carro 4 em destaque")).toBeVisible();
  expect(screen.getByText("A linha indica a sequência das paradas, não o trajeto pelas ruas.")).toBeVisible();
  await user.click(screen.getByRole("button", {name: "Ver todos"}));
  expect(screen.getByText("Todas as paradas")).toBeVisible();
});

it("retains prior results while showing a refresh error and a manual retry", async () => {
  const optimize = vi.spyOn(api, "optimizeRoutes")
    .mockResolvedValueOnce(optimizationFixture())
    .mockRejectedValueOnce(new ApiError(503, "ROUTING_PROVIDER_UNAVAILABLE"))
    .mockResolvedValueOnce(optimizationFixture());
  const user = userEvent.setup();
  render(<RoutesPage />);
  await user.click(screen.getAllByRole("button", {name: "Gerar rotas"})[0]);
  await user.click(screen.getByRole("checkbox", {name: /Ana/}));
  await user.click(screen.getByRole("button", {name: "Gerar rotas para 1"}));
  await user.click(await screen.findByRole("button", {name: "Gerar novas rotas"}));
  await user.click(screen.getByRole("checkbox", {name: /Ana/}));
  await user.click(screen.getByRole("button", {name: "Gerar rotas para 1"}));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("temporariamente indisponível"));
  expect(screen.getByRole("button", {name: "Selecionar carro 9"})).toBeVisible();
  await user.click(screen.getByRole("button", {name: "Tentar novamente"}));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(optimize).toHaveBeenCalledTimes(3);
});
