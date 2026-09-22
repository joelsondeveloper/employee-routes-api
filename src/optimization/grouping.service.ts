import type {
  EmployeeGeography,
} from "../employees/employee-geography.service.js";

import type {
  RoutingProvider,
} from "../routing/routing.types.js";

import type {
  GroupingPoint,
  CandidateCompatibilityScore,
} from "./group-compatibility.types.js";

import type {
  CandidateGroup,
} from "./grouping.types.js";

import {
  GROUPING_CONFIG,
} from "./grouping.config.js";

import {
  evaluateCandidateForGroup,
} from "./group-candidate-evaluator.service.js";


interface GroupEvaluation {
  group: CandidateGroup;
  compatibility: CandidateCompatibilityScore;
}


function sortByDistance(
  employees: EmployeeGeography[],
): EmployeeGeography[] {
  return [...employees].sort(
    (a, b) =>
      a.distanceFromCompany -
      b.distanceFromCompany,
  );
}


function toGroupingPoint(
  employee: EmployeeGeography,
): GroupingPoint {
  return {
    id: employee.employee.id,
    latitude: employee.employee.latitude,
    longitude: employee.employee.longitude,
  };
}


function groupToGroupingPoints(
  group: CandidateGroup,
): GroupingPoint[] {
  return group.employees.map(toGroupingPoint);
}


async function evaluateEmployeeAgainstGroup(
  origin: GroupingPoint,
  employee: EmployeeGeography,
  group: CandidateGroup,
  routingProvider: RoutingProvider,
): Promise<GroupEvaluation> {
  const candidate =
    toGroupingPoint(employee);

  const groupPoints =
    groupToGroupingPoints(group);

  const compatibility =
    await evaluateCandidateForGroup(
      origin,
      candidate,
      groupPoints,
      routingProvider,
    );

  return {
    group,
    compatibility,
  };
}


function findBestGroupEvaluation(
  evaluations: GroupEvaluation[],
): GroupEvaluation | null {
  if (evaluations.length === 0) {
    return null;
  }

  let bestEvaluation =
    evaluations[0]!;

  for (
    let i = 1;
    i < evaluations.length;
    i++
  ) {
    const evaluation =
      evaluations[i]!;

    if (
      evaluation.compatibility.finalScore >
      bestEvaluation.compatibility.finalScore
    ) {
      bestEvaluation = evaluation;
    }
  }

  return bestEvaluation;
}


export async function createCandidateGroups(
  origin: GroupingPoint,
  employees: EmployeeGeography[],
  routingProvider: RoutingProvider,
): Promise<CandidateGroup[]> {
  const sortedEmployees =
    sortByDistance(employees);

  const groups: CandidateGroup[] = [];

  for (const employee of sortedEmployees) {
    /*
     * Não existe grupo ainda.
     * O primeiro funcionário cria o primeiro grupo.
     */
    if (groups.length === 0) {
      groups.push({
        employees: [employee],
      });

      continue;
    }

    /*
     * Só avaliamos grupos que ainda possuem
     * espaço para outro passageiro.
     */
    const availableGroups =
      groups.filter(
        (group) =>
          group.employees.length <
          GROUPING_CONFIG.maxPassengers,
      );

    /*
     * Todos os grupos estão cheios.
     * Não existe decisão para tomar:
     * cria um novo grupo.
     */
    if (availableGroups.length === 0) {
      groups.push({
        employees: [employee],
      });

      continue;
    }

    const evaluations: GroupEvaluation[] = [];

    /*
     * O funcionário é avaliado contra TODOS
     * os grupos disponíveis.
     *
     * Aqui entram:
     *
     * directionScore
     * proximityScore
     * distanceScore
     * roadScore
     *
     * e finalmente:
     *
     * finalScore
     */
    for (const group of availableGroups) {
      const evaluation =
        await evaluateEmployeeAgainstGroup(
          origin,
          employee,
          group,
          routingProvider,
        );

      if (!evaluation.compatibility.routeAvailable) {
        console.debug("ROUTE_UNAVAILABLE", {candidateId: employee.employee.id,
          groupNumber: groups.indexOf(group) + 1, relations: evaluation.compatibility.unavailableRelations});
        continue;
      }
      evaluations.push(evaluation);
    }

    /*
     * Descobre qual grupo obteve
     * o maior finalScore.
     */
    const bestEvaluation =
      findBestGroupEvaluation(evaluations);

    /*
     * Segurança. Em condições normais isso
     * não deveria acontecer porque já sabemos
     * que existe pelo menos um grupo disponível.
     */
    if (!bestEvaluation) {
      groups.push({
        employees: [employee],
      });

      continue;
    }

    /*
     * Mesmo sendo o melhor grupo disponível,
     * ele ainda precisa atingir a compatibilidade
     * mínima.
     */
    if (
      bestEvaluation.compatibility.finalScore <
      GROUPING_CONFIG.minimumCompatibilityScore
    ) {
      groups.push({
        employees: [employee],
      });

      continue;
    }

    /*
     * Temos um grupo vencedor e ele atingiu
     * a compatibilidade mínima.
     */
    bestEvaluation.group.employees.push(
      employee,
    );
  }

  return groups;
}