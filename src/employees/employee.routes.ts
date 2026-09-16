import { Router } from "express";
import type { Employee } from "./employee.types.js";
import { randomUUID } from "crypto";
import database from "../database/database.js";
import { geocodeAddress } from "../geocoding/geocoding.service.js";
import {
  GeocodingNotFoundError,
  GeocodingProviderError,
} from "../geocoding/geocoding.errors.js";

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

router.put("/:id", async (req, res) => {
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

  let latitude = employee.latitude;
  let longitude = employee.longitude;

  if (!name || !address || !phone) {
    return res.status(400).json({
      error: "Address not found.",
    });
  }

  if (address !== employee.address) {
    try {
      const coordinates = await geocodeAddress(address);

      latitude = coordinates.latitude;
      longitude = coordinates.longitude;
    } catch (error) {
      if (error instanceof GeocodingNotFoundError) {
        return res.status(400).json({
          error: "Address not found.",
        });
      }

      if (error instanceof GeocodingProviderError) {
        console.error(error);

        return res.status(502).json({
          error: "Geocoding service is unavailable.",
        });
      }

      console.error(error);

      return res.status(500).json({
        error: "Internal server error.",
      });
    }
  }

  database
    .prepare(
      `
    UPDATE employees
    SET
      name = ?,
      address = ?,
      phone = ?,
      latitude = ?,
      longitude = ?
    WHERE id = ?
  `,
    )
    .run(name, address, phone, latitude, longitude, id);

  const updatedEmployee = database
    .prepare("SELECT * FROM employees WHERE id = ?")
    .get(id) as Employee;

  return res.json(updatedEmployee);
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

router.post("/", async (req, res) => {
  const { name, address, phone } = req.body;

  if (!name || !address || !phone) {
    return res.status(400).json({
      message: "Name, address and phone are required",
    });
  }

  try {
    const coordinates = await geocodeAddress(address);

    const employee: Employee = {
      id: randomUUID(),
      name,
      address,
      phone,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };

    const statement = database.prepare(
      "INSERT INTO employees (id, name, address, phone, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)",
    );
    statement.run(
      employee.id,
      employee.name,
      employee.address,
      employee.phone,
      employee.latitude,
      employee.longitude,
    );
    res.status(201).json(employee);
  } catch (error) {
    if (error instanceof GeocodingNotFoundError) {
      return res.status(400).json({
        message: "Address not found",
      });
    }

    if (error instanceof GeocodingProviderError) {
      console.error(error);
      return res.status(502).json({
        message: "Geocoding service is unavailable.",
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;
