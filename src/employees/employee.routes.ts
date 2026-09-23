import {Router, type Request} from "express";
import {randomUUID} from "node:crypto";
import type {Employee} from "./employee.types.js";
import {geocodeAddress} from "../geocoding/geocoding.service.js";
import {GeocodingNotFoundError, GeocodingProviderError} from "../geocoding/geocoding.errors.js";
import {validateOptionalCoordinates} from "./employee-input.validation.js";
import {createDefaultEmployeeRepository, fromLegacyEmployeeStore, type LegacyEmployeeStore} from "../database/employee-repository.js";
import type {EmployeeRepository} from "../database/repository.types.js";

export interface EmployeeRouteDependencies {
  employeeRepository?: EmployeeRepository;
  /** Kept for the existing in-memory/SQLite HTTP tests. */
  employeeStore?: LegacyEmployeeStore;
  geocode?: typeof geocodeAddress;
}

function tenantId(request: Request): string {
  return request.auth?.organizationId ?? "legacy";
}

export function createEmployeeRouter(dependencies: EmployeeRouteDependencies = {}): Router {
  const router = Router();
  const repository = dependencies.employeeRepository ?? (dependencies.employeeStore ? fromLegacyEmployeeStore(dependencies.employeeStore) : createDefaultEmployeeRepository());
  const geocode = dependencies.geocode ?? geocodeAddress;

  router.get("/", async (request, response) => response.json(await repository.list(tenantId(request))));

  router.get("/:id", async (request, response) => {
    const employee = await repository.findById(request.params.id, tenantId(request));
    if (!employee) return response.status(404).json({error: "Employee not found"});
    return response.json(employee);
  });

  router.put("/:id", async (request, response) => {
    const id = request.params.id;
    const {name, address, phone, latitude: requestedLatitude, longitude: requestedLongitude} = request.body ?? {};
    const current = await repository.findById(id, tenantId(request));
    if (!current) return response.status(404).json({error: "Employee not found"});
    if (!name || !address || !phone) return response.status(400).json({error: "Address not found."});
    const coordinates = validateOptionalCoordinates({latitude: requestedLatitude, longitude: requestedLongitude});
    if (!coordinates.valid) return response.status(400).json({error: coordinates.message});
    let latitude = current.latitude;
    let longitude = current.longitude;
    if (coordinates.provided) {
      latitude = coordinates.latitude!;
      longitude = coordinates.longitude!;
    } else if (address !== current.address) {
      try {
        const resolved = await geocode(address);
        latitude = resolved.latitude;
        longitude = resolved.longitude;
      } catch (error) {
        if (error instanceof GeocodingNotFoundError) return response.status(400).json({error: "Address not found."});
        if (error instanceof GeocodingProviderError) {
          console.error("GEOCODING_UPDATE_FAILED", {status: error.status, error: error.name});
          return response.status(502).json({error: "Geocoding service is unavailable."});
        }
        console.error("EMPLOYEE_UPDATE_FAILED", {error: error instanceof Error ? error.name : "unknown"});
        return response.status(500).json({error: "Internal server error."});
      }
    }
    const updated = await repository.update(id, tenantId(request), {name, address, phone, latitude, longitude});
    if (!updated) return response.status(404).json({error: "Employee not found"});
    return response.json(updated);
  });

  router.delete("/:id", async (request, response) => {
    if (!await repository.delete(request.params.id, tenantId(request))) return response.status(404).json({error: "Employee not found"});
    return response.sendStatus(204);
  });

  router.post("/", async (request, response) => {
    const {name, address, phone, latitude: requestedLatitude, longitude: requestedLongitude} = request.body ?? {};
    if (!name || !address || !phone) return response.status(400).json({message: "Name, address and phone are required"});
    const coordinates = validateOptionalCoordinates({latitude: requestedLatitude, longitude: requestedLongitude});
    if (!coordinates.valid) return response.status(400).json({error: coordinates.message});
    try {
      const resolved = coordinates.provided ? {latitude: coordinates.latitude!, longitude: coordinates.longitude!} : await geocode(address);
      const employee: Employee = {id: randomUUID(), name, address, phone, latitude: resolved.latitude, longitude: resolved.longitude};
      await repository.create(employee, tenantId(request));
      return response.status(201).json(employee);
    } catch (error) {
      if (error instanceof GeocodingNotFoundError) return response.status(400).json({message: "Address not found"});
      if (error instanceof GeocodingProviderError) {
        console.error("GEOCODING_CREATE_FAILED", {status: error.status, error: error.name});
        return response.status(502).json({message: "Geocoding service is unavailable."});
      }
      console.error("EMPLOYEE_CREATE_FAILED", {error: error instanceof Error ? error.name : "unknown"});
      return response.status(500).json({message: "Internal server error"});
    }
  });

  return router;
}

