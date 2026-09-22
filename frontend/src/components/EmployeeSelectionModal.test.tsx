import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {expect, it, vi} from "vitest";
import {EmployeeSelectionModal} from "./EmployeeSelectionModal";

const employees = [
  {id: "a", name: "Ana", address: "Rua Ana", phone: "1", latitude: 0, longitude: 0},
  {id: "b", name: "Bruno", address: "Rua Bruno", phone: "1", latitude: 0, longitude: 0},
];

it("starts empty, supports search/select all/clear and submits only selected IDs", async () => {
  const confirm = vi.fn();
  const user = userEvent.setup();
  render(<EmployeeSelectionModal employees={employees} onClose={() => undefined} onConfirm={confirm} />);
  expect(screen.getByRole("button", {name: "Gerar rotas para 0"})).toBeDisabled();
  await user.click(screen.getByRole("button", {name: "Selecionar todos"}));
  expect(screen.getByText("2 de 2 selecionados")).toBeVisible();
  await user.click(screen.getByRole("button", {name: "Limpar seleção"}));
  await user.type(screen.getByRole("textbox", {name: "Buscar funcionário"}), "Bruno");
  expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  await user.click(screen.getByRole("checkbox", {name: /Bruno/}));
  await user.click(screen.getByRole("button", {name: "Gerar rotas para 1"}));
  expect(confirm).toHaveBeenCalledWith(["b"]);
});
