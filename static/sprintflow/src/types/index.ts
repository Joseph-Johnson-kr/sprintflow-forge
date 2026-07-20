export interface CycleTime {
  dev: number;
  qa: number;
}

export type CycleTimes = Record<number, CycleTime>;

/** SP → statusName → average whole days spent in that status */
export type DetailedCycleTimes = Record<number, Record<string, number>>;

export interface BoardStatusConfig {
  id: string;
  name: string;
}

export interface DailyCapacity {
  devs: number;
  qa: number;
}

export type MemberRole = 'dev' | 'qa' | 'both';

export interface TeamMemberConfig {
  id: string;
  name: string;
  role: MemberRole;
}

export interface Story {
  issueKey: string;
  summary: string;
  storyPoints: number;
  startDay: number;
  rollover: boolean;
  override: boolean;
  overrideCells: StoryStatus[];
  dependencies: string[];
  /** Issue keys of Stories/Bugs/Spikes/Epics that Jira's "Blocks" issue links say block this Story. */
  blockedByIssueKeys: string[];
}

/** A Jira issue (any project/team) found via dependency search or resolved from a raw issue key. */
export interface DependencyCandidate {
  issueKey: string;
  summary: string;
  projectKey?: string;
  teamName?: string | null;
  /** Epic T-shirt size, when the candidate is an Epic and the field is set. */
  suggestedSize?: string;
  /** Values of the Epic "Planning Version" field, when the candidate is an Epic. */
  planningVersions: string[];
  /** Story points, when the candidate is a Story/Bug/Spike with that field set. */
  storyPoints?: number;
  /** Sprint name(s) the candidate is/was assigned to; the last entry is its current sprint. */
  sprintNames: string[];
}

export interface Team {
  id: string;
  name: string;
  cycleTimes: CycleTimes;
  detailedCycleTimes?: DetailedCycleTimes;
  defaultCapacity: DailyCapacity;
  sprintLength: number;
  /** 1 = Monday … 5 = Friday */
  sprintStartDay: number;
  /** When true, devs cover QA; qaCapacity is derived from devCapacity in metrics */
  devsAreQAs: boolean;
  members: TeamMemberConfig[];
  backlog: Story[];
  capacityOverrides: Record<number, Partial<DailyCapacity>>;
}

export type StoryStatus = 'idle' | 'dev' | 'qa' | 'done' | 'unknown';

export interface FlowRow {
  story: Story;
  cells: StoryStatus[];
  devEnd: number;
  qaEnd: number;
  hasCycleTime: boolean;
}

export interface FlowGridData {
  days: number[];
  rows: FlowRow[];
}

export interface DayMetrics {
  day: number;
  devDemand: number;
  qaDemand: number;
  devCapacity: number;
  qaCapacity: number;
  devLoad: number;
  qaLoad: number;
}

export type View = 'home' | 'config' | 'sprint';

export interface CycleTimeSettings {
  devStatuses: string[];
  qaStatuses: string[];
  daysBack: number;
}

export interface SprintOption {
  id: number;
  name: string;
  state: 'active' | 'future';
  sprintLength: number;
  sprintStartDay: number;
}
