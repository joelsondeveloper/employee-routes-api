import type {
  GroupingPoint,
} from "./group-compatibility.types.js";

import {
  LocationIQRoutingProvider,
} from "../routing/providers/locationiq-routing.provider.js";

import {
  evaluateCandidateForGroup,
} from "./group-candidate-evaluator.service.js";

const points = [
  { id: "company", latitude: -8.3058014, longitude: -35.0223791 },

  { id: "employee-a", latitude: -8.2985031, longitude: -35.036529 },
  { id: "employee-b", latitude: -8.285917, longitude: -35.0374083 },
  { id: "employee-c", latitude: -8.288198, longitude: -35.034804 },
  { id: "employee-d", latitude: -8.3309844, longitude: -34.9507633 },

  { id: "employee-e", latitude: -8.2755, longitude: -35.0182 },
  { id: "employee-f", latitude: -8.2928, longitude: -34.9876 },
  { id: "employee-g", latitude: -8.3374, longitude: -34.9472 },

  { id: "employee-i", latitude: -8.2471, longitude: -35.0318 },
  { id: "employee-j", latitude: -8.2789, longitude: -35.0453 },
  { id: "employee-k", latitude: -8.2697, longitude: -35.0401 },
] as const satisfies readonly GroupingPoint[];

const [
  company,
  employeeA,
  employeeB,
  employeeC,
  employeeD,
  employeeE,
  employeeF,
  employeeG,
  employeeI,
  employeeJ,
  employeeK,
] = points;

if (
  !company ||
  !employeeA ||
  !employeeB ||
  !employeeC ||
  !employeeD ||
  !employeeE ||
  !employeeF ||
  !employeeG ||
  !employeeI ||
  !employeeJ ||
  !employeeK
) {
  throw new Error("Missing test points.");
}

const provider = new LocationIQRoutingProvider();

async function testGroup(
  name: string,
  candidate: GroupingPoint,
  group: GroupingPoint[],
) {
  const result = await evaluateCandidateForGroup(
    company,
    candidate,
    group,
    provider,
  );

  console.log(`\n${name}`);

  console.table({
    directionScore: result.directionScore.toFixed(2),
    proximityScore: result.proximityScore.toFixed(2),
    distanceScore: result.distanceScore.toFixed(2),
    roadScore: result.roadScore.toFixed(2),
    finalScore: result.finalScore.toFixed(2),
  });
}

async function main() {
  console.log("\n======================================");
  console.log("GROUP + ROAD COMPATIBILITY");
  console.log("======================================");

  await testGroup(
    "D → [A, B, C]",
    employeeD,
    [employeeA, employeeB, employeeC],
  );

  await new Promise((resolve) =>
    setTimeout(resolve, 2000),
  );

  await testGroup(
    "D → [E, F, G]",
    employeeD,
    [employeeE, employeeF, employeeG],
  );

  await new Promise((resolve) =>
    setTimeout(resolve, 2000),
  );

  await testGroup(
    "D → [I, J, K]",
    employeeD,
    [employeeI, employeeJ, employeeK],
  );
}

main().catch((error) => { console.error(error); process.exitCode = 1; });