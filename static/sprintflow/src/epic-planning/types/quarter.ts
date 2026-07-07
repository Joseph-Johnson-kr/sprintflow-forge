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
}

export interface MemberAbsence {
  sprintNumber: number;
  days: number;
}

export interface TeamMember {
  id: string;
  name: string;
  absences: MemberAbsence[];
}

/** Minimal shape of a Jira-sourced team member, as returned by the getTeamMembers resolver. */
export interface RosterMember {
  id: string;
  name: string;
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
}

export interface SprintMetrics {
  sprintNumber: number;
  totalCapacityDevDays: number;
  usedCapacityDevDays: number;
  utilizationRatio: number;
}

export interface QuarterForecast {
  schedules: EpicSchedule[];
  sprintMetrics: SprintMetrics[];
  overflowEpics: Epic[];
}
