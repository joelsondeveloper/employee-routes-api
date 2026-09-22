import { LocationIQRoutingProvider } from "./providers/locationiq-routing.provider.js";

import {
  findFastestRoute,
  evaluateRouteCandidates,
} from "./route-optimizer.service.js";

import { evaluateRoute } from "./route-evaluator.service.js";

import {
  ScoredRouteCandidates,
  findBestScoredRoute,
} from "./route-score.service.js";

const provider = new LocationIQRoutingProvider();

const points = [
  {
    id: "company",
    latitude: -8.3058014,
    longitude: -35.0223791,
  },

  // =========================================================
  // 15 FUNCIONÁRIOS DE TESTE
  // =========================================================

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
    id: "employee-h",
    latitude: -8.3498,
    longitude: -34.9461,
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
  {
    id: "employee-l",
    latitude: -8.2608,
    longitude: -35.0522,
  },
  {
    id: "employee-m",
    latitude: -8.2305,
    longitude: -35.0811,
  },
  {
    id: "employee-n",
    latitude: -8.3094,
    longitude: -34.9728,
  },
  {
    id: "employee-o",
    latitude: -8.3652,
    longitude: -34.9625,
  },
];

// =========================================================
// CONFIGURAÇÃO DO TESTE
// =========================================================

// Espaço entre chamadas ao LocationIQ.
// Isso existe apenas para o script de teste.
const MATRIX_REQUEST_DELAY_MS = 2000;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

// =========================================================
// EXECUÇÃO DE UM CENÁRIO
// =========================================================

async function runScenario(
  title: string,
  employeeIndexes: number[],
) {
  console.log("\n==================================================");
  console.log(title);
  console.log("==================================================");

  const selectedPoints = [
    points[0]!,
    ...employeeIndexes.map((index) => points[index]!),
  ];

  // ---------------------------------------------------------
  // 1. MATRIX
  // ---------------------------------------------------------

  const matrix = await provider.getMatrix(selectedPoints);

  // Dentro da matrix, a empresa sempre ocupa índice 0.
  //
  // Os funcionários passam a ocupar:
  // 1, 2, 3, 4
  //
  // independentemente dos índices originais em `points`.
  const passengerIndexes = employeeIndexes.map(
    (_, index) => index + 1,
  );

  // ---------------------------------------------------------
  // 2. GERA E AVALIA TODAS AS PERMUTAÇÕES
  // ---------------------------------------------------------

  const candidates = evaluateRouteCandidates(
    matrix,
    0,
    passengerIndexes,
  );

  // ---------------------------------------------------------
  // 3. SCORE + CONSTRAINTS
  // ---------------------------------------------------------

  const scoredCandidates =
    ScoredRouteCandidates(candidates);

  // ---------------------------------------------------------
  // 4. ROTA MAIS RÁPIDA
  // ---------------------------------------------------------

  const fastestRoute = findFastestRoute(
    matrix,
    0,
    passengerIndexes,
  );

  const fastestEvaluation = evaluateRoute(
    matrix,
    fastestRoute,
    0,
  );

  // ---------------------------------------------------------
  // 5. MELHOR ROTA POR SCORE
  // ---------------------------------------------------------

  let bestScoredRoute = null;

  try {
    bestScoredRoute =
      findBestScoredRoute(scoredCandidates);
  } catch {
    // Nenhuma das 24 rotas passou pelas constraints.
    bestScoredRoute = null;
  }

  // =========================================================
  // RESULTADOS
  // =========================================================

  console.log("\nTODAS AS ROTAS:");

  console.table(
    scoredCandidates.map(
      ({ candidate, score, validation }) => ({
        route: candidate.route.pointIds
          .slice(1)
          .join(" → "),

        totalMinutes: (
          candidate.route.totalDurationSeconds / 60
        ).toFixed(2),

        distanceKm: (
          candidate.route.totalDistanceMeters / 1000
        ).toFixed(2),

        averageExtra: (
          candidate.evaluation
            .averageExtraDurationSeconds / 60
        ).toFixed(2),

        maxExtra: (
          candidate.evaluation
            .maxExtraDurationSeconds / 60
        ).toFixed(2),

        efficiencyScore:
          score.efficiencyScore.toFixed(2),

        averageDetourScore:
          score.averageDetourScore.toFixed(2),

        maxDetourScore:
          score.maxDetourScore.toFixed(2),

        finalScore:
          score.finalScore.toFixed(2),

        acceptable:
          validation.isAcceptable
            ? "YES"
            : "NO",
      })),
  );

  // =========================================================
  // ROTA MAIS RÁPIDA
  // =========================================================

  console.log("\nROTA MAIS RÁPIDA:");

  console.log({
    route: fastestRoute.pointIds
      .slice(1)
      .join(" → "),

    totalMinutes: (
      fastestRoute.totalDurationSeconds / 60
    ).toFixed(2),

    distanceKm: (
      fastestRoute.totalDistanceMeters / 1000
    ).toFixed(2),

    averageExtraMinutes: (
      fastestEvaluation.averageExtraDurationSeconds / 60
    ).toFixed(2),

    maxExtraMinutes: (
      fastestEvaluation.maxExtraDurationSeconds / 60
    ).toFixed(2),
  });

  // =========================================================
  // MELHOR ROTA POR SCORE
  // =========================================================

  if (bestScoredRoute) {
    console.log("\nMELHOR ROTA POR SCORE:");

    console.log({
      route:
        bestScoredRoute.candidate.route.pointIds
          .slice(1)
          .join(" → "),

      totalMinutes: (
        bestScoredRoute.candidate.route
          .totalDurationSeconds / 60
      ).toFixed(2),

      distanceKm: (
        bestScoredRoute.candidate.route
          .totalDistanceMeters / 1000
      ).toFixed(2),

      averageExtraMinutes: (
        bestScoredRoute.candidate.evaluation
          .averageExtraDurationSeconds / 60
      ).toFixed(2),

      maxExtraMinutes: (
        bestScoredRoute.candidate.evaluation
          .maxExtraDurationSeconds / 60
      ).toFixed(2),

      efficiencyScore:
        bestScoredRoute.score
          .efficiencyScore.toFixed(2),

      averageDetourScore:
        bestScoredRoute.score
          .averageDetourScore.toFixed(2),

      maxDetourScore:
        bestScoredRoute.score
          .maxDetourScore.toFixed(2),

      finalScore:
        bestScoredRoute.score
          .finalScore.toFixed(2),
    });

    // -------------------------------------------------------
    // PASSAGEIROS DA ROTA ESCOLHIDA
    // -------------------------------------------------------

    console.log(
      "\nPASSAGEIROS DA MELHOR ROTA:",
    );

    console.table(
      bestScoredRoute.candidate.evaluation
        .passengerMetrics
        .map((metric) => ({
          passenger: metric.pointId,

          directMinutes: (
            metric.directDurationSeconds / 60
          ).toFixed(2),

          sharedMinutes: (
            metric.sharedDurationSeconds / 60
          ).toFixed(2),

          extraMinutes: (
            metric.extraDurationSeconds / 60
          ).toFixed(2),
        })),
    );
  } else {
    // =======================================================
    // NENHUMA ROTA PASSOU
    // =======================================================

    console.log(
      "\n❌ NENHUMA ROTA ACEITÁVEL ENCONTRADA",
    );

    console.log(
      "Este grupo deve ser enviado para rearranjamento.",
    );

    const bestRejectedCandidate =
      [...scoredCandidates].sort(
        (a, b) =>
          b.score.finalScore -
          a.score.finalScore,
      )[0];

    if (bestRejectedCandidate) {
      console.log(
        "\nMelhor tentativa rejeitada:",
      );

      console.log({
        route:
          bestRejectedCandidate.candidate.route.pointIds
            .slice(1)
            .join(" → "),

        finalScore:
          bestRejectedCandidate.score
            .finalScore.toFixed(2),

        maxExtraMinutes: (
          bestRejectedCandidate.candidate.evaluation
            .maxExtraDurationSeconds / 60
        ).toFixed(2),

        violations:
          bestRejectedCandidate.validation.violations.map(
            (violation) => ({
              passenger: violation.pointId,

              actualMinutes: (
                violation.actualValue / 60
              ).toFixed(2),

              limitMinutes: (
                violation.limit / 60
              ).toFixed(2),

              type: violation.type,
            }),
          ),
      });
    }
  }
}

// =========================================================
// EXECUÇÃO DOS CENÁRIOS
// =========================================================

async function main() {
  // Centro + São Francisco + Garapu + Enseada
  await runScenario(
    "TESTE 1 - A B C D",
    [1, 2, 3, 4],
  );

  await sleep(MATRIX_REQUEST_DELAY_MS);

  // Ponte dos Carvalhos + Pontezinha + Gaibu + Itapuama
  await runScenario(
    "TESTE 2 - E F G H",
    [5, 6, 7, 8],
  );

  await sleep(MATRIX_REQUEST_DELAY_MS);

  // Charneca + Cohab + Torrinha + Malaquias
  await runScenario(
    "TESTE 3 - I J K L",
    [9, 10, 11, 12],
  );

  await sleep(MATRIX_REQUEST_DELAY_MS);

  // Pirapama + Rosário + Suape + Centro
  await runScenario(
    "TESTE 4 - M N O B",
    [13, 14, 15, 2],
  );

  await sleep(MATRIX_REQUEST_DELAY_MS);

  // Grupo propositalmente misturado
  await runScenario(
    "TESTE 5 - A G J O",
    [1, 7, 10, 15],
  );
}

await main();