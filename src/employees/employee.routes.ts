import { Router } from "express";
import type { Employee } from "./employee.types.js";
import { randomUUID } from "crypto";
import database from "../database/database.js";
import { geocodeAddress } from "../geocoding/geocoding.service.js";
import {
  GeocodingNotFoundError,
  GeocodingProviderError,
} from "../geocoding/geocoding.errors.js";
import {validateOptionalCoordinates} from "./employee-input.validation.js";

interface EmployeeStore {
  prepare(sql: string): {
    all(): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): {changes: number};
  };
}

export interface EmployeeRouteDependencies {
  employeeStore?: EmployeeStore;
  geocode?: typeof geocodeAddress;
}

export function createEmployeeRouter(dependencies: EmployeeRouteDependencies = {}) {
  const router = Router();
  const employeeStore = dependencies.employeeStore ?? database;
  const geocode = dependencies.geocode ?? geocodeAddress;

router.get("/", (req, res) => {
  const employees = employeeStore.prepare("SELECT * FROM employees").all();
  return res.json(employees);
});

router.get("/:id", (req, res) => {
  const { id } = req.params;
  const employee = employeeStore
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
  const { name, address, phone, latitude: requestedLatitude, longitude: requestedLongitude } = req.body ?? {};

  const employee = employeeStore
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

  const coordinates = validateOptionalCoordinates({latitude: requestedLatitude, longitude: requestedLongitude});
  if (!coordinates.valid) return res.status(400).json({error: coordinates.message});

  if (coordinates.provided) {
    latitude = coordinates.latitude!;
    longitude = coordinates.longitude!;
  } else if (address !== employee.address) {
    try {
      const coordinates = await geocode(address);

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

  employeeStore
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

  const updatedEmployee = employeeStore
    .prepare("SELECT * FROM employees WHERE id = ?")
    .get(id) as Employee;

  return res.json(updatedEmployee);
});

router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const result = employeeStore.prepare("DELETE FROM employees WHERE id = ?").run(id);

  if (result.changes === 0) {
    return res.status(404).json({
      error: "Employee not found",
    });
  }

  return res.sendStatus(204).send();
});

router.post("/", async (req, res) => {
  const { name, address, phone, latitude: requestedLatitude, longitude: requestedLongitude } = req.body ?? {};

  if (!name || !address || !phone) {
    return res.status(400).json({
      message: "Name, address and phone are required",
    });
  }

  const coordinates = validateOptionalCoordinates({latitude: requestedLatitude, longitude: requestedLongitude});
  if (!coordinates.valid) return res.status(400).json({error: coordinates.message});

  try {
    const resolved = coordinates.provided
      ? {latitude: coordinates.latitude!, longitude: coordinates.longitude!}
      : await geocode(address);

    const employee: Employee = {
      id: randomUUID(),
      name,
      address,
      phone,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    };

    const statement = employeeStore.prepare(
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

  return router;
}

export default createEmployeeRouter();
