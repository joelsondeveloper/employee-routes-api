import type { EmployeeGeography } from "../employees/employee-geography.service.js";
import type { CandidateGroup } from "./grouping.types.js";

import { calculateAngularDifference } from "../geography/geography.utils.js";
import { GROUPING_CONFIG } from "./grouping.config.js";

function areBearingsCompatible(
  employeeA: EmployeeGeography,
  employeeB: EmployeeGeography,
): boolean {
  const difference = calculateAngularDifference(
    employeeA.bearingFromCompany,
    employeeB.bearingFromCompany,
  );

  return difference <= GROUPING_CONFIG.preferredBearingDifference;
}

function isCompatibleWithGroup(
  candidate: EmployeeGeography,
  group: EmployeeGeography[],
): boolean {
  return group.every((employee) => areBearingsCompatible(candidate, employee));
}

function sortByDistance(employees: EmployeeGeography[]): EmployeeGeography[] {
  return [...employees].sort(
    (a, b) => a.distanceFromCompany - b.distanceFromCompany,
  );
}

export function createCandidateGroups(
  employees: EmployeeGeography[],
): CandidateGroup[] {
  const sortedEmployees = sortByDistance(employees);

  const groups: CandidateGroup[] = [];

  for (const employee of sortedEmployees) {
    let addedToGroup = false;

    for (const group of groups) {
      if (
        group.employees.length < GROUPING_CONFIG.maxPassengers &&
        isCompatibleWithGroup(employee, group.employees)
      ) {
        group.employees.push(employee);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      groups.push({
        employees: [employee],
      });
    }
  }

  return groups;
}
