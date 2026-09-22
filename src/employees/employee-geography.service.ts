import type { Employee } from "./employee.types.js";
import type { Coordinates } from "../geography/geography.utils.js";
import { calculateDistance, calculateBearing } from "../geography/geography.utils.js";

export interface EmployeeGeography {
    employee: Employee;
    distanceFromCompany: number;
    bearingFromCompany: number;
}

export function analyzeEmployeeGeography(employee: Employee, companyCoordinates: Coordinates): EmployeeGeography {
    const employeeCoordinates: Coordinates = {
        latitude: employee.latitude,
        longitude: employee.longitude,
    };

    const distanceFromCompany = calculateDistance(employeeCoordinates, companyCoordinates);
    const bearingFromCompany = calculateBearing(companyCoordinates, employeeCoordinates);

    return {
        employee,
        distanceFromCompany,
        bearingFromCompany,
    };
    }