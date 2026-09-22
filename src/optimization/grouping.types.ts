import type { EmployeeGeography } from "../employees/employee-geography.service.js";

import type {
  GroupingPoint,
  GroupCompatibilityScore,
} from "./group-compatibility.types.js";

export interface EmployeeGroup {
  id: string;
  members: GroupingPoint[];
}

export interface GroupCandidateEvaluation {
  groupId: string;
  compatibility: GroupCompatibilityScore;
}

export interface GroupingResult {
  groups: EmployeeGroup[];
}

export interface CandidateGroup {
    employees: EmployeeGeography[];
}

