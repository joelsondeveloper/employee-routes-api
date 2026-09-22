import {
  calculateRoadCompatibility,
} from "./road-compatibility.service.js";

interface RoadTestCase {
  name: string;
  averageExtraMinutes: number;
  maxExtraMinutes: number;
  expected: "ACCEPTED" | "REJECTED";
}

const testCases: RoadTestCase[] = [
  {
    name: "A B C D",
    averageExtraMinutes: 4.56,
    maxExtraMinutes: 13.16,
    expected: "ACCEPTED",
  },
  {
    name: "E F G H",
    averageExtraMinutes: 14.25,
    maxExtraMinutes: 30.22,
    expected: "REJECTED",
  },
  {
    name: "I J K L",
    averageExtraMinutes: 7.21,
    maxExtraMinutes: 14.32,
    expected: "ACCEPTED",
  },
  {
    name: "M N O B",
    averageExtraMinutes: 20.76,
    maxExtraMinutes: 38.70,
    expected: "REJECTED",
  },
  {
    name: "A G J O",
    averageExtraMinutes: 13.81,
    maxExtraMinutes: 33.64,
    expected: "REJECTED",
  },
];

console.log("\n==========================================");
console.log("ROAD COMPATIBILITY TEST");
console.log("==========================================\n");

for (const testCase of testCases) {
  const result = calculateRoadCompatibility(
    testCase.averageExtraMinutes * 60,
    testCase.maxExtraMinutes * 60,
  );

  console.log({
    group: testCase.name,
    expected: testCase.expected,

    averageExtraMinutes:
      testCase.averageExtraMinutes.toFixed(2),

    maxExtraMinutes:
      testCase.maxExtraMinutes.toFixed(2),

    averageDetourScore:
      result.averageDetourScore.toFixed(2),

    maxDetourScore:
      result.maxDetourScore.toFixed(2),

    roadScore:
      result.roadScore.toFixed(2),
  });
}