import type { MemberRole } from '../../types';

export type TShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'Jumbo';

export const TSHIRT_SPRINT_DURATIONS: Record<TShirtSize, number> = {
  XS: 0.5,
  S: 1,
  M: 2,
  L: 3,
  XL: 6,
  Jumbo: 8,
};

export const TSHIRT_SIZE_OPTIONS: TShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'Jumbo'];

export const TSHIRT_LABELS: Record<TShirtSize, string> = {
  XS: 'XS · 5 days',
  S: 'S · 1 sprint',
  M: 'M · 2 sprints',
  L: 'L · 3 sprints',
  XL: 'XL · 6 sprints',
  Jumbo: 'Jumbo · 8 sprints',
};

export type RiskLevel = 'low' | 'medium' | 'high';

export interface Risk {
  id: string;
  description: string;
  level: RiskLevel;
}

export interface Epic {
  id: string;
  title: string;
  issueKey?: string;
  size: TShirtSize;
  devAllocation: number;
  qaAllocation: number;
  risks: Risk[];
  dependencies: string[];
  notes: string;
}

/** An open Epic from the team's Jira backlog, as returned by the getBacklogEpics resolver. */
export interface BacklogEpicOption {
  issueKey: string;
  summary: string;
  /** T-shirt size from the Epic's "T-Shirt Size" Jira field (customfield_10269), when set. */
  suggestedSize?: TShirtSize;
  /** Current values of the Epic's "Planning Version" Jira field (customfield_10212), e.g. "2026Q1". */
  planningVersions: string[];
}

/** A configured Planning Version value (customfield_10212), as returned by getQuarterOptions. */
export interface PlanningVersionOption {
  /** Jira field-option/version id — used for write-back via updateEpicPlanningVersion. */
  id: string;
  /** Raw display value, e.g. "2026Q1". */
  value: string;
  year: number;
  quarter: QuarterName;
}

/** An Epic-issue-type workflow status, as returned by the getEpicStatuses resolver. */
export interface EpicStatusConfig {
  id: string;
  name: string;
}

export type EpicPhase = 'discovery' | 'inProgress' | 'acceptance';

/**
 * For review only — not yet consumed by quarterEngine's forecasting math.
 * Maps each Epic workflow status name to one of the phases below.
 */
export interface EpicCycleTimeSettings {
  discoveryStatuses: string[];
  inProgressStatuses: string[];
  acceptanceStatuses: string[];
  year: number;
  quarter: QuarterName;
}

/** T-shirt size -> statusName -> average whole days spent in that status */
export type EpicDetailedCycleTimes = Partial<Record<TShirtSize, Record<string, number>>>;

export interface MemberAbsence {
  sprintNumber: number;
  days: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: MemberRole;
  absences: MemberAbsence[];
}

/** Minimal shape of a Jira-sourced team member, as returned by the getTeamMembers resolver. */
export interface RosterMember {
  id: string;
  name: string;
  role: MemberRole;
}

export type QuarterName = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export const QUARTER_DEFAULT_SPRINTS: Record<QuarterName, number> = {
  Q1: 8,
  Q2: 6,
  Q3: 6,
  Q4: 6,
};

export const QUARTER_NAME_OPTIONS: QuarterName[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export interface Quarter {
  id: string;
  name: QuarterName;
  year: number;
  sprintCount: number;
  teamId: string;
  members: TeamMember[];
  epics: Epic[];
}

export interface EpicSchedule {
  epic: Epic;
  startSprint: number;
  endSprint: number;
  fits: boolean;
  /**
   * Sprints within [startSprint, endSprint] that actually consumed Dev/QA capacity.
   * Any sprint in that range NOT listed here is a skipped shortfall sprint (the team's
   * total capacity that sprint can't cover this Epic's per-sprint rate, e.g. a holiday
   * or widespread absences) — the Epic pauses through it rather than being pushed later.
   */
  workedSprints: number[];
}

export interface SprintMetrics {
  sprintNumber: number;
  totalCapacityDevDays: number;
  usedCapacityDevDays: number;
  utilizationRatio: number;
  totalCapacityQADays: number;
  usedCapacityQADays: number;
  qaUtilizationRatio: number;
}

export interface QuarterForecast {
  schedules: EpicSchedule[];
  sprintMetrics: SprintMetrics[];
  overflowEpics: Epic[];
}
