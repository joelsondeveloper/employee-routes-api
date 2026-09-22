import type {
  GroupingPoint,
} from "./group-compatibility.types.js";

import {
  evaluateCandidateForGroup,
} from "./group-candidate-evaluator.service.js";

import {
  LocationIQRoutingProvider,
} from "../routing/providers/locationiq-routing.provider.js";


const points: GroupingPoint[] = [
  {
    id: "company",
    latitude: -8.3058014,
    longitude: -35.0223791,
  },

  {
    id: "employee-a",
    latitude: -8.2985031,
    longitude: -35.036529,
  },
  {
    id: "employee-b",
    latitude: -8.285917,
    longitude: -35.0374083,
  },
  {
    id: "employee-c",
    latitude: -8.288198,
    longitude: -35.034804,
  },
  {
    id: "employee-d",
    latitude: -8.3309844,
    longitude: -34.9507633,
  },

  {
    id: "employee-e",
    latitude: -8.2755,
    longitude: -35.0182,
  },
  {
    id: "employee-f",
    latitude: -8.2928,
    longitude: -34.9876,
  },
  {
    id: "employee-g",
    latitude: -8.3374,
    longitude: -34.9472,
  },

  {
    id: "employee-i",
    latitude: -8.2471,
    longitude: -35.0318,
  },
  {
    id: "employee-j",
    latitude: -8.2789,
    longitude: -35.0453,
  },
  {
    id: "employee-k",
    latitude: -8.2697,
    longitude: -35.0401,
  },
];

const company = points[0]!;
const employeeA = points[1]!;
const employeeB = points[2]!;
const employeeC = points[3]!;
const employeeD = points[4]!;
const employeeE = points[5]!;
const employeeF = points[6]!;
const employeeG = points[7]!;
const employeeI = points[8]!;
const employeeJ = points[9]!;
const employeeK = points[10]!;

const provider = new LocationIQRoutingProvider();


function sleep(milliseconds: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds),
  );
}


async function testCandidate(
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

  return result;
}


async function main() {
  console.log(
    "\n========================================",
  );
  console.log(
    "GROUP CANDIDATE EVALUATOR TEST",
  );
  console.log(
    "========================================",
  );

  const abcResult = await testCandidate(
    "D → [A, B, C]",
    employeeD,
    [
      employeeA,
      employeeB,
      employeeC,
    ],
  );

  await sleep(2000);

  const efgResult = await testCandidate(
    "D → [E, F, G]",
    employeeD,
    [
      employeeE,
      employeeF,
      employeeG,
    ],
  );

  await sleep(2000);

  const ijkResult = await testCandidate(
    "D → [I, J, K]",
    employeeD,
    [
      employeeI,
      employeeJ,
      employeeK,
    ],
  );

  const results = [
    {
      group: "ABC",
      finalScore: abcResult.finalScore,
    },
    {
      group: "EFG",
      finalScore: efgResult.finalScore,
    },
    {
      group: "IJK",
      finalScore: ijkResult.finalScore,
    },
  ];

  results.sort(
    (a, b) =>
      b.finalScore - a.finalScore,
  );

  console.log(
    "\n========================================",
  );
  console.log("FINAL RANKING");
  console.log(
    "========================================",
  );

  console.table(
    results.map((result) => ({
      group: result.group,
      finalScore:
        result.finalScore.toFixed(2),
    })),
  );

  console.log(
    `\nBest group for D: ${results[0]!.group}`,
  );
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});