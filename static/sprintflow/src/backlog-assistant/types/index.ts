export type { DependencyCandidate } from '../../types';

export interface BAIssue {
  key: string;
  summary: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  storyPoints: string;
  sprint: string;
  parentKey: string;
  parentSummary: string;
  epicName: string;
}

export type BAEdgeType = 'blocks' | 'relates';

export interface BAEdge {
  id: string;
  from: string;
  to: string;
  type: BAEdgeType;
}

export interface RankOverride {
  reason: string;
}

export type ObjectiveGroups = Record<string, string[]>;

export interface PQItem extends BAIssue {
  rawPriority: string;
  directUnblocksKeys: string[];
  unblocksCount: number;
  blockedByKeys: string[];
}

export interface SessionData {
  nodePositions: Record<string, { x: number; y: number }>;
  collapsedObjectives: string[];
  rankOverrides: Record<string, RankOverride>;
}

export interface GraphApi {
  removeEdge(id: string): BAEdge | null;
  reverseEdge(id: string): BAEdge | null;
  undoRemoveEdge(edge: BAEdge): void;
  addToObjective(childKey: string, objKey: string): void;
  removeFromObjective(childKey: string, objKey: string): void;
  setAddingEdge(on: boolean): void;
  collapseObjective(objKey: string): void;
  expandObjective(objKey: string): void;
  toggleObjective(objKey: string): void;
  collapseAll(): void;
  expandAll(): void;
  fit(): void;
  zoomIn(): void;
  zoomOut(): void;
  focusNode(key: string): void;
  applyRankOverride(key: string, reason: string): void;
  removeRankOverride(key: string): void;
  getPositions(): Record<string, { x: number; y: number }>;
  applySessionPositions(positions: Record<string, { x: number; y: number }>): void;
  setHoverNode(key: string | null): void;
}

// Shape returned by the `getSprintIssues` resolver (shared with SprintFlow's own board view).
export interface SprintIssue {
  issueKey: string;
  summary: string;
  type?: string;
}

export interface SprintOption {
  id: number;
  name: string;
  state: string;
}
