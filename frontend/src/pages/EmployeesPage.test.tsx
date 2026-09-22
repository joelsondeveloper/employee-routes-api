import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {EmployeesPage} from "./EmployeesPage";
import {api, ApiError} from "../services/api";
import {employeeFixture} from "../test/optimization.fixture";

vi.mock("../components/EmployeeLocationMap", () => ({
  EmployeeLocationMap: ({onChange}: {onChange: (coordinates: {latitude: number; longitude: number}) => void}) => <button type="button" onClick={() => onChange({latitude: -8.2, longitude: -34.8})}>Mock mapa</button>,
}));

beforeEach(() => vi.spyOn(api, "listEmployees").mockResolvedValue([employeeFixture]));
afterEach(() => vi.restoreAllMocks());

it("shows persisted employees, creates one and updates the count", async () => {
  const create = vi.spyOn(api, "createEmployee").mockResolvedValue({...employeeFixture, id: "new", name: "Nova"});
  const count = vi.fn();
  const user = userEvent.setup();
  render(<EmployeesPage onCountChange={count} />);
  await screen.findByText("Ana");
  await user.click(screen.getByRole("button", {name: "Novo funcionário"}));
  const dialog = screen.getByRole("dialog", {name: "Novo funcionário"});
  await user.type(within(dialog).getByLabelText("Nome"), "Nova");
  await user.type(within(dialog).getByLabelText("Telefone"), "81999990000");
  await user.type(within(dialog).getByLabelText("Endereço"), "Rua nova, Recife");
  await user.click(within(dialog).getByRole("button", {name: "Cadastrar"}));
  await screen.findByText("Nova");
  expect(create).toHaveBeenCalledWith({name: "Nova", phone: "81999990000", address: "Rua nova, Recife"});
  expect(count).toHaveBeenLastCalledWith(2);
});

it("edits via PUT and reports geocoding errors without losing input", async () => {
  const update = vi.spyOn(api, "updateEmployee").mockRejectedValueOnce(new ApiError(400, "ADDRESS_NOT_FOUND"))
    .mockResolvedValueOnce({...employeeFixture, name: "Ana Lima"});
  const user = userEvent.setup();
  render(<EmployeesPage />);
  await user.click(await screen.findByRole("button", {name: "Editar Ana"}));
  const dialog = screen.getByRole("dialog");
  await user.clear(within(dialog).getByLabelText("Nome"));
  await user.type(within(dialog).getByLabelText("Nome"), "Ana Lima");
  await user.click(within(dialog).getByRole("button", {name: "Salvar alterações"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não encontramos esse endereço");
  expect(within(dialog).getByLabelText("Nome")).toHaveValue("Ana Lima");
  await user.click(within(dialog).getByRole("button", {name: "Salvar alterações"}));
  await screen.findByText("Ana Lima");
  expect(update).toHaveBeenLastCalledWith(employeeFixture.id, {name: "Ana Lima",
    address: employeeFixture.address, phone: employeeFixture.phone,
    latitude: employeeFixture.latitude, longitude: employeeFixture.longitude});
});

it("previews geocoding, allows a manual coordinate adjustment and sends it on create", async () => {
  const locate = vi.spyOn(api, "geocodePreview").mockResolvedValue({latitude: -8.12, longitude: -34.91});
  const create = vi.spyOn(api, "createEmployee").mockResolvedValue({...employeeFixture, id: "new", name: "Nova"});
  const user = userEvent.setup();
  render(<EmployeesPage />);
  await user.click(await screen.findByRole("button", {name: "Novo funcionário"}));
  const dialog = screen.getByRole("dialog", {name: "Novo funcionário"});
  await user.type(within(dialog).getByLabelText("Nome"), "Nova");
  await user.type(within(dialog).getByLabelText("Telefone"), "81999990000");
  await user.type(within(dialog).getByLabelText("Endereço"), "Rua nova");
  await user.click(within(dialog).getByRole("button", {name: "Localizar no mapa"}));
  await screen.findByText("Localização encontrada. Arraste o marcador se necessário.");
  expect(locate).toHaveBeenCalledWith("Rua nova");
  await user.click(within(dialog).getByRole("button", {name: "Mock mapa"}));
  await user.click(within(dialog).getByRole("button", {name: "Cadastrar"}));
  expect(create).toHaveBeenCalledWith({name: "Nova", phone: "81999990000", address: "Rua nova", latitude: -8.2, longitude: -34.8});
});

it("deletes only after the explicit confirmation, and cancel does not send a request", async () => {
  const remove = vi.spyOn(api, "deleteEmployee").mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<EmployeesPage />);
  await user.click(await screen.findByRole("button", {name: "Excluir Ana"}));
  expect(remove).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", {name: "Cancelar"}));
  expect(remove).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", {name: "Excluir Ana"}));
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", {name: "Excluir"}));
  await waitFor(() => expect(screen.queryByText("Ana")).not.toBeInTheDocument());
  expect(remove).toHaveBeenCalledExactlyOnceWith(employeeFixture.id);
});
