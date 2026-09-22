import type {Employee, OptimizationResponse, RouteGroup} from "../types/api";

// Synthetic coordinates and IDs; group shape/metrics are based on the observed 24-person run.
// Never imported by the production application.
const groupNames = [
  ["Vinícius Carvalho", "André Lima", "Bruno Ferreira", "Thiago Rodrigues"],
  ["João Henrique", "Felipe Martins", "Gustavo Barbosa", "Eduardo Melo"],
  ["Samuel Gomes", "Leonardo Alves"],
  ["Pedro Oliveira", "Rafael Costa", "Daniel Souza", "Matheus Silva"],
  ["Caio Nascimento", "Lucas Almeida"],
  ["Gabriel Santos"],
  ["Henrique Araújo", "Murilo Correia", "Funcionário Teste A", "Funcionário Teste B"],
  ["Diego Ribeiro"],
  ["Joelson"],
];
const durations = [775.8, 1044, 1794, 2798.4, 2046, 1248, 1476, 1656, 194220];
const distances = [9070, 14600, 21600, 36600, 34900, 19000, 22700, 31600, 4001200];
const averages = [186, 240, 420, 636, 426, 0, 162, 0, 0];
const maxima = [432, 354, 840, 1561.8, 852, 0, 264, 0, 0];
const origin = {type: "ORIGIN" as const, id: "company", name: "Empresa", latitude: -8.1678849, longitude: -34.9442083};

export function optimizationFixture(): OptimizationResponse {
  let employeeIndex = 0;
  const groups: RouteGroup[] = groupNames.map((names, index) => {
    const employees = names.map((name) => {
      const n = ++employeeIndex;
      return {id: `fixture-${n}`, name, latitude: -8.14 + n * .001, longitude: -34.92 - (n % 6) * .008};
    });
    const rejected = index === 3;
    const passengerMetrics = employees.map((employee, i) => {
      const sharedDurationSeconds = durations[index] * (i + 1) / employees.length;
      const extraDurationSeconds = employee.name === "Matheus Silva" ? 1561.8 : (employees.length === 1 ? 0 : 60 * i);
      return {employeeId: employee.id, name: employee.name,
        directDurationSeconds: sharedDurationSeconds - extraDurationSeconds,
        sharedDurationSeconds, extraDurationSeconds};
    });
    return {
      groupNumber: index + 1, status: rejected ? "REJECTED" : "ACCEPTED", acceptable: !rejected,
      employees,
      stops: [origin, ...[...employees].map((employee) => ({...employee, type: "EMPLOYEE" as const, employeeId: employee.id}))],
      totalDurationSeconds: durations[index], totalDistanceMeters: distances[index],
      averageExtraDurationSeconds: averages[index], maxExtraDurationSeconds: maxima[index],
      passengerMetrics,
      violations: rejected ? [{type: "MAX_EXTRA_DURATION", employeeId: employees[3].id, name: "Matheus Silva", actualValue: 1561.8, limit: 900}] : [],
    };
  });
  return {
    groups,
    issues: [{type: "UNROUTABLE_EMPLOYEE", employeeId: "fixture-24",
      employee: {id: "fixture-24", name: "Joelson3", latitude: -8.2, longitude: -35},
      reason: "Unavailable fixture relation", relations: [{fromId: "company", toId: "fixture-24"}]}],
    summary: {totalEmployees: 24, totalGroups: 9, acceptableGroups: 8, rejectedGroups: 1,
      unavailableGroups: 0, unroutableEmployees: 1, averageOccupancy: 23 / 9},
  };
}

export const employeeFixture: Employee = {
  id: "test-employee", name: "Ana", address: "Rua de teste, 10, Recife", phone: "81999990000",
  latitude: -8.1, longitude: -34.9,
};

