import type { RouteScore, RouteCandidate, ScoredRouteCandidate } from "./routing.types.js";
import { validateRoute } from "./route-constraints.service.js";

import { ROUTE_SCORE_CONFIG } from "./route-score.config.js";

export function normalizeLowerIsBetter(value: number, bestValue: number, worstValue: number): number {
    if (bestValue === worstValue) {
        return 100;
    }
    return (
        ((worstValue - value) / (worstValue - bestValue)) * 100
    )
}

export function ScoredRouteCandidates(candidates: RouteCandidate[]): ScoredRouteCandidate[] {

    if (candidates.length === 0) {
        return [];
    }

    const durations = candidates.map((candidate) => candidate.route.totalDurationSeconds,);

    const averageDetours = candidates.map((candidate) => candidate.evaluation.averageExtraDurationSeconds,);

    const maxDetours = candidates.map((candidate) => candidate.evaluation.maxExtraDurationSeconds,);

    const bestDuration = Math.min(...durations);
    const worstDuration = Math.max(...durations);

    const bestAverageDetour = Math.min(...averageDetours);
    const worstAverageDetour = Math.max(...averageDetours);

    const bestMaxDetour = Math.min(...maxDetours);
    const worstMaxDetour = Math.max(...maxDetours);

    return candidates.map((candidate) => {
    const efficiencyScore =
      normalizeLowerIsBetter(
        candidate.route.totalDurationSeconds,
        bestDuration,
        worstDuration,
      );

      const averageDetourScore =
        normalizeLowerIsBetter(
          candidate.evaluation.averageExtraDurationSeconds,
          bestAverageDetour,
          worstAverageDetour,
        );

      const maxDetourScore =
        normalizeLowerIsBetter(
          candidate.evaluation.maxExtraDurationSeconds,
          bestMaxDetour,
          worstMaxDetour,
        );

        const finalScore =
          efficiencyScore * ROUTE_SCORE_CONFIG.efficiencyWeight +
          averageDetourScore * ROUTE_SCORE_CONFIG.averageDetourWeight +
          maxDetourScore * ROUTE_SCORE_CONFIG.maxDetourWeight;

          const validation = validateRoute(candidate.evaluation);

        return {
            candidate,
            score: {
                efficiencyScore,
                averageDetourScore,
                maxDetourScore,
                finalScore,
            },
            validation
        };
    });
}

export function findBestScoredRoute(
  candidates: ScoredRouteCandidate[],
): ScoredRouteCandidate {
  if (candidates.length === 0) {
    throw new Error(
      "At least one scored route candidate is required.",
    );
  }

  const acceptableCandidates = candidates.filter((candidate) => candidate.validation.isAcceptable);

  if (acceptableCandidates.length === 0) {
    throw new Error(
      "At least one acceptable scored route candidate is required.",
    );
  }

  return findBestScoredAttempt(acceptableCandidates);
}

/** Highest relative score within one group, including rejected routes. */
export function findBestScoredAttempt(candidates: ScoredRouteCandidate[]): ScoredRouteCandidate {
  if (candidates.length === 0) {
    throw new Error("At least one scored route candidate is required.");
  }
  let bestCandidate = candidates[0]!;

  for (const candidate of candidates) {
    if (
      candidate.score.finalScore >
      bestCandidate.score.finalScore
    ) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}