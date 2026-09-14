import { Router } from "express";
import type { Employee } from "./employee.types.js";
import { randomUUID } from "crypto";
import database from "../database/database.js";

const router = Router();

router.get("/", (req, res) => {
  const employees = database.prepare("SELECT * FROM employees").all();
  return res.json(employees);
});

router.get("/:id", (req, res) => {
  const { id } = req.params;
  const employee = database
    .prepare("SELECT * FROM employees WHERE id = ?")
    .get(id) as Employee | undefined;

  if (!employee) {
    return res.status(404).json({
      error: "Employee not found",
    });
  }

  return res.json(employee);
});

router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, address, phone } = req.body;

  const employee = database
    .prepare("SELECT * FROM employees WHERE id = ?")
    .get(id) as Employee | undefined;

  if (!employee) {
    return res.status(404).json({
      error: "Employee not found",
    });
  }

  if (!name && !address && !phone) {
    return res.status(400).json({
      message: "Name, address and phone are required",
    });
  }

  database.prepare(
    "UPDATE employees SET name = ?, address = ?, phone = ? WHERE id = ?",
  ).run(name, address, phone, id);

  const updatedEmployee = database
    .prepare("SELECT * FROM employees WHERE id = ?")
    .get(id) as Employee;

  return res.json(employee);
});

router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const result = database.prepare("DELETE FROM employees WHERE id = ?").run(id);

  if (result.changes === 0) {
    return res.status(404).json({
      error: "Employee not found",
    });
  }

  return res.sendStatus(204).send();
});

router.post("/", (req, res) => {
  const { name, address, phone } = req.body;

  if (!name || !address || !phone) {
    return res.status(400).json({
      message: "Name, address and phone are required",
    });
  }

  const employee: Employee = {
    id: randomUUID(),
    name,
    address,
    phone,
  };

  const statement = database.prepare(
    "INSERT INTO employees (id, name, address, phone) VALUES (?, ?, ?, ?)",
  );
  statement.run(employee.id, employee.name, employee.address, employee.phone);
  res.status(201).json(employee);
});

export default router;
