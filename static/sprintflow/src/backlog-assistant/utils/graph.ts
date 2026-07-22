import type { BAEdge, BAIssue, DependencyCandidate, ObjectiveGroups, PQItem, RankOverride } from '../types';

export interface TypeColorSet {
  bg: string;
  border: string;
  font: string;
}

export const TYPE_COLOR: Record<string, TypeColorSet> = {
  Epic: { bg: '#f3e8ff', border: '#7c3aed', font: '#3b0764' },
  Objective: { bg: '#fef9c3', border: '#ca8a04', font: '#713f12' },
  Story: { bg: '#dcfce7', border: '#16a34a', font: '#14532d' },
  Task: { bg: '#dbeafe', border: '#2563eb', font: '#1e3a8a' },
  Spike: { bg: '#fff7ed', border: '#d97706', font: '#7c2d12' },
  Risk: { bg: '#ffedd5', border: '#ea580c', font: '#7c2d12' },
  Bug: { bg: '#fee2e2', border: '#dc2626', font: '#7f1d1d' },
  Subtask: { bg: '#f1f5f9', border: '#64748b', font: '#374151' },
  'Sub-task': { bg: '#f1f5f9', border: '#64748b', font: '#374151' },
};

export const DEFAULT_COLOR: TypeColorSet = { bg: '#eff6ff', border: '#3b82f6', font: '#1e3a8a' };

export function typeColor(type: string): TypeColorSet {
  return TYPE_COLOR[type] || DEFAULT_COLOR;
}

const STATUS_MAP: Array<[string, string]> = [
  ['blocked', '#dc2626'],
  ['in progress', '#2563eb'],
  ['in development', '#2563eb'],
  ['ready for review', '#7c3aed'],
  ['in review', '#7c3aed'],
  ['done', '#059669'],
  ['closed', '#059669'],
  ['cancelled', '#374151'],
  ['canceled', '#374151'],
];

export function statusColor(status: string): string {
  const s = (status || '').toLowerCase();
  for (const [needle, color] of STATUS_MAP) {
    if (s.includes(needle)) return color;
  }
  return '#475569';
}

export const PQ_DONE_STATUSES = new Set([
  'Done',
  'Closed',
  'Resolved',
  'Released',
  "Won't Do",
  'Cancelled',
  'Canceled',
]);

export function isDoneStatus(status: string): boolean {
  return PQ_DONE_STATUSES.has(status);
}

export function pqRawPriority(priority: string): string {
  const stripped = (priority || '').replace(/^\d+\s*[-–]\s*/, '').trim();
  const lower = stripped.toLowerCase();
  if (lower === 'critical') return 'Critical';
  if (lower === 'high') return 'High';
  if (lower === 'medium') return 'Medium';
  if (lower === 'low') return 'Low';
  return stripped;
}

export function priorityChevron(priority: string, type: string): string {
  if (type === 'Objective') return '';
  const raw = pqRawPriority(priority).toLowerCase();
  if (raw === 'critical') return '^^^';
  if (raw === 'high') return '^^';
  if (raw === 'medium') return '^';
  if (raw === 'low') return 'v';
  return '';
}

export function trunc(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function rebuildObjectiveGroups(
  issues: Record<string, BAIssue>,
  edges: BAEdge[],
): ObjectiveGroups {
  const groups: ObjectiveGroups = {};
  const assigned = new Set<string>();
  const relates = edges.filter((e) => e.type === 'relates');

  for (const issue of Object.values(issues)) {
    if (issue.type !== 'Objective') continue;
    if (!groups[issue.key]) groups[issue.key] = [];
  }

  for (const edge of relates) {
    const fromIssue = issues[edge.from];
    const toIssue = issues[edge.to];
    if (!fromIssue || !toIssue) continue;
    const fromIsObj = fromIssue.type === 'Objective';
    const toIsObj = toIssue.type === 'Objective';
    if (fromIsObj === toIsObj) continue;
    const objKey = fromIsObj ? fromIssue.key : toIssue.key;
    const childKey = fromIsObj ? toIssue.key : fromIssue.key;
    if (assigned.has(childKey)) continue;
    if (!groups[objKey]) groups[objKey] = [];
    groups[objKey].push(childKey);
    assigned.add(childKey);
  }

  return groups;
}

export function visibleGroupMembers(
  objKey: string,
  objectiveGroups: ObjectiveGroups,
  collapsedObjectives: Set<string>,
): string[] {
  if (collapsedObjectives.has(objKey)) return [objKey];
  return [objKey, ...(objectiveGroups[objKey] || [])];
}

export function getDependencyChain(
  nodeId: string,
  issues: Record<string, BAIssue>,
  edges: BAEdge[],
  objectiveGroups: ObjectiveGroups,
): Set<string> {
  const chain = new Set<string>();
  const issue = issues[nodeId];
  if (!issue) return chain;

  if (issue.type === 'Objective') {
    chain.add(nodeId);
    for (const child of objectiveGroups[nodeId] || []) chain.add(child);
    return chain;
  }

  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== 'blocks') continue;
    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    adjacency.get(e.from)!.push(e.to);
  }

  const queue = [nodeId];
  chain.add(nodeId);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) || []) {
      if (!chain.has(next)) {
        chain.add(next);
        queue.push(next);
      }
    }
  }
  return chain;
}

export interface PQComputeInput {
  issues: Record<string, BAIssue>;
  edges: BAEdge[];
}

export function computePriorityQueueItems({ issues, edges }: PQComputeInput): PQItem[] {
  // e.from outside the fetched issue set is an external blocker — its done-status is unknown,
  // so it's treated as not-done rather than silently dropping the edge (and the local blocked
  // item's "Blocked by" entry) the way `issues[e.from] &&` alone would.
  const blocksEdges = edges.filter(
    (e) => e.type === 'blocks' && (!issues[e.from] || !isDoneStatus(issues[e.from].status)),
  );

  const unblocksMap = new Map<string, Set<string>>();
  const blockedByMap = new Map<string, string[]>();
  for (const e of blocksEdges) {
    if (!unblocksMap.has(e.from)) unblocksMap.set(e.from, new Set());
    unblocksMap.get(e.from)!.add(e.to);
    if (!blockedByMap.has(e.to)) blockedByMap.set(e.to, []);
    blockedByMap.get(e.to)!.push(e.from);
  }

  const items: PQItem[] = [];
  for (const issue of Object.values(issues)) {
    if (issue.type === 'Objective' || isDoneStatus(issue.status)) continue;
    const directUnblocksKeys = Array.from(unblocksMap.get(issue.key) || []);

    const visited = new Set<string>([issue.key]);
    const queue = [...directUnblocksKeys];
    while (queue.length) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const next of unblocksMap.get(cur) || []) {
        if (!visited.has(next)) queue.push(next);
      }
    }
    const unblocksCount = visited.size - 1;

    items.push({
      ...issue,
      rawPriority: pqRawPriority(issue.priority),
      directUnblocksKeys,
      unblocksCount,
      blockedByKeys: blockedByMap.get(issue.key) || [],
    });
  }

  items.sort((a, b) => b.unblocksCount - a.unblocksCount);
  return items;
}

export function pqExplanation(item: PQItem): string {
  const direct = item.directUnblocksKeys.length;
  const indirect = item.unblocksCount - direct;
  const blockedCount = item.blockedByKeys.length;

  let unblocksPart: string;
  if (item.unblocksCount === 0) {
    unblocksPart = 'unblocks nothing';
  } else if (indirect > 0) {
    unblocksPart = `unblocks ${item.unblocksCount} work item${item.unblocksCount === 1 ? '' : 's'} (${direct} directly, ${indirect} more through the dependency chain)`;
  } else {
    unblocksPart = `unblocks ${item.unblocksCount} work item${item.unblocksCount === 1 ? '' : 's'} (${direct} directly)`;
  }

  let sentence = `This item has ${item.rawPriority || 'no'} priority and ${unblocksPart}.`;
  if (blockedCount > 0) {
    sentence += ` It is currently blocked by ${blockedCount} other item${blockedCount === 1 ? '' : 's'} and cannot be started until ${blockedCount === 1 ? 'it is' : 'those are'} completed.`;
  }
  return sentence;
}

export const PQ_GROUPS: Array<{ key: string; dot: string }> = [
  { key: 'Critical', dot: '#b91c1c' },
  { key: 'High', dot: '#ea580c' },
  { key: 'Medium', dot: '#d97706' },
  { key: 'Low', dot: '#94a3b8' },
];

export const TYPE_TC: Record<string, { bg: string; border: string; text: string }> = {
  Story: { bg: '#dcfce7', border: '#16a34a', text: '#14532d' },
  Task: { bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a' },
  Bug: { bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d' },
  Spike: { bg: '#fff7ed', border: '#d97706', text: '#7c2d12' },
  Risk: { bg: '#ffedd5', border: '#ea580c', text: '#7c2d12' },
  Epic: { bg: '#f3e8ff', border: '#7c3aed', text: '#3b0764' },
};

export const PQ_TYPE_ORDER = ['Story', 'Task', 'Bug', 'Spike', 'Risk', 'Epic'];

interface PriorityIconConfig {
  char: string;
  count: number;
  cls: string;
}

const PQ_ICON_CFG: Record<string, PriorityIconConfig> = {
  Critical: { char: '^', count: 3, cls: 'text-red-700' },
  High: { char: '^', count: 2, cls: 'text-orange-600' },
  Medium: { char: '^', count: 1, cls: 'text-amber-600' },
  Low: { char: 'v', count: 1, cls: 'text-slate-400' },
};

export function pqPriorityIcon(rawPriority: string): PriorityIconConfig | null {
  return PQ_ICON_CFG[rawPriority] || null;
}

export interface VisNodeData {
  id: string;
  label: string;
  shape: 'box';
  color: { background: string; border: string; highlight: { background: string; border: string }; hover: { background: string; border: string } };
  font: { color: string; size: number; face: string; multi: boolean };
  borderWidth: number;
  shadow: { enabled: boolean; color: string; size: number; x: number; y: number };
  widthConstraint: { maximum: number };
  hidden?: boolean;
  title?: HTMLElement;
  shapeProperties?: { borderDashes: number[] };
}

export function buildTooltip(issue: BAIssue, override?: RankOverride): HTMLElement {
  const el = document.createElement('div');
  const summaryEl = document.createElement('div');
  summaryEl.textContent = issue.summary || issue.key;
  summaryEl.style.fontWeight = '600';
  summaryEl.style.marginBottom = '4px';
  el.appendChild(summaryEl);

  if (issue.type !== 'Objective') {
    const priorityEl = document.createElement('div');
    priorityEl.textContent = `Priority: ${issue.priority || 'None'}`;
    el.appendChild(priorityEl);

    if (override) {
      const overrideEl = document.createElement('div');
      overrideEl.textContent = `★ Rank override: ${override.reason}`;
      overrideEl.style.color = '#d97706';
      overrideEl.style.marginTop = '4px';
      el.appendChild(overrideEl);
    }
  }
  return el;
}

export function makeVisNode(
  issue: BAIssue,
  rankOverrides: Record<string, RankOverride>,
  newIssueKeys: Set<string>,
): VisNodeData {
  const override = rankOverrides[issue.key];
  const isNew = newIssueKeys.has(issue.key);
  const c = typeColor(issue.type);
  const chevron = priorityChevron(issue.priority, issue.type);
  const overridePrefix = override ? '★ ' : '';
  const newPrefix = isNew ? '… ' : '';
  const label = `${overridePrefix}${newPrefix}${issue.key}${chevron ? '  ' + chevron : ''}\n${trunc(issue.summary, 34)}`;

  const border = override ? '#d97706' : c.border;
  const borderWidth = override ? 4 : isNew ? 3 : 2;
  const shadow = override
    ? { enabled: true, color: 'rgba(217,119,6,0.30)', size: 8, x: 0, y: 0 }
    : isNew
      ? { enabled: true, color: 'rgba(6,182,212,0.40)', size: 10, x: 0, y: 0 }
      : { enabled: true, color: 'rgba(0,0,0,0.12)', size: 4, x: 0, y: 0 };

  return {
    id: issue.key,
    label,
    shape: 'box',
    color: {
      background: c.bg,
      border,
      highlight: { background: c.bg, border },
      hover: { background: c.bg, border },
    },
    font: { color: c.font, size: 11, face: 'monospace', multi: false },
    borderWidth,
    shadow,
    widthConstraint: { maximum: 200 },
    title: buildTooltip(issue, override),
  };
}

export function buildExternalTooltip(candidate: DependencyCandidate): HTMLElement {
  const el = document.createElement('div');
  const summaryEl = document.createElement('div');
  summaryEl.textContent = candidate.summary || candidate.issueKey;
  summaryEl.style.fontWeight = '600';
  summaryEl.style.marginBottom = '4px';
  el.appendChild(summaryEl);

  const projectEl = document.createElement('div');
  projectEl.textContent = `Outside this backlog${candidate.projectKey ? ` — project ${candidate.projectKey}` : ''}`;
  projectEl.style.color = '#64748b';
  el.appendChild(projectEl);

  return el;
}

// A "ghost" node representing an issue referenced by a dependency edge but outside the
// currently-loaded project/team batch — read-only, distinct dashed styling, no context menu.
export function makeExternalVisNode(candidate: DependencyCandidate): VisNodeData {
  const projectPrefix = candidate.projectKey ? `[${candidate.projectKey}] ` : '';
  const label = `${candidate.issueKey} ↗\n${trunc(`${projectPrefix}${candidate.summary}`, 34)}`;

  return {
    id: candidate.issueKey,
    label,
    shape: 'box',
    color: {
      background: '#f8fafc',
      border: '#94a3b8',
      highlight: { background: '#f8fafc', border: '#64748b' },
      hover: { background: '#f8fafc', border: '#64748b' },
    },
    font: { color: '#64748b', size: 11, face: 'monospace', multi: false },
    borderWidth: 2,
    shadow: { enabled: false, color: 'rgba(0,0,0,0)', size: 0, x: 0, y: 0 },
    widthConstraint: { maximum: 200 },
    title: buildExternalTooltip(candidate),
    shapeProperties: { borderDashes: [4, 3] },
  };
}

export interface VisEdgeData {
  id: string;
  from: string;
  to: string;
  arrows: { to: { enabled: boolean; scaleFactor: number } };
  color: { color: string; highlight: string; hover: string };
  smooth: { type: 'continuous' };
  title: string;
}

export function makeVisEdge(edge: BAEdge): VisEdgeData {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    arrows: { to: { enabled: true, scaleFactor: 0.7 } },
    color: { color: '#ef4444', highlight: '#f59e0b', hover: '#f59e0b' },
    smooth: { type: 'continuous' },
    title: `blocks: ${edge.from} → ${edge.to}`,
  };
}

const DIM_BG = '#f1f5f9';
const DIM_BORDER = '#e2e8f0';
const DIM_FONT = '#b8c1cc';

export function makeDimmedNode(nodeId: string): Partial<VisNodeData> & { id: string } {
  return {
    id: nodeId,
    color: {
      background: DIM_BG,
      border: DIM_BORDER,
      highlight: { background: DIM_BG, border: DIM_BORDER },
      hover: { background: DIM_BG, border: DIM_BORDER },
    },
    font: { color: DIM_FONT, size: 11, face: 'monospace', multi: false },
    borderWidth: 1,
    shadow: { enabled: false, color: 'rgba(0,0,0,0)', size: 0, x: 0, y: 0 },
  };
}

export function makeDimmedEdge(edgeId: string): { id: string; color: { color: string; highlight: string; hover: string }; width: number } {
  return { id: edgeId, color: { color: DIM_BORDER, highlight: DIM_BORDER, hover: DIM_BORDER }, width: 0.5 };
}
