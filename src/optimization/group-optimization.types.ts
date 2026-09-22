import type {
  ScoredRouteCandidate,
} from "../routing/routing.types.js";

export interface AcceptedGroupOptimization {
  status: "ACCEPTED";
  employeeIds: string[];
  bestRoute: ScoredRouteCandidate;
}

export interface RearrangeGroupOptimization {
  status: "REARRANGE";
  employeeIds: string[];
  reason: "NO_ACCEPTABLE_ROUTE";
}

export type GroupOptimizationResult =
  | AcceptedGroupOptimization
  | RearrangeGroupOptimization;