import { create } from 'zustand';
import { invoke } from '@forge/bridge';
import type { BAEdge, BAIssue, DependencyCandidate, GraphApi, ObjectiveGroups, RankOverride } from '../types';
import { rebuildObjectiveGroups } from '../utils/graph';

async function call<T>(fn: string, payload?: Record<string, unknown>): Promise<T> {
  return invoke(fn, payload) as unknown as Promise<T>;
}

function syncBlocksLink(blockedKey: string, blockerKey: string, mode: 'add' | 'remove') {
  call('updateDependencyLink', { blockedIssueKey: blockedKey, blockerIssueKey: blockerKey, mode }).catch(
    (err) => console.error('Backlog Assistant: failed to sync dependency link to Jira', err),
  );
}

function syncRelatesLink(keyA: string, keyB: string, mode: 'add' | 'remove') {
  call('updateRelatesLink', { issueKeyA: keyA, issueKeyB: keyB, mode }).catch((err) =>
    console.error('Backlog Assistant: failed to sync relates link to Jira', err),
  );
}

function syncEdge(edge: BAEdge, mode: 'add' | 'remove') {
  if (edge.type === 'blocks') syncBlocksLink(edge.to, edge.from, mode);
  else syncRelatesLink(edge.from, edge.to, mode);
}

function edgeId(type: BAEdge['type'], from: string, to: string): string {
  return `${type}:${from}->${to}`;
}

function findEdgeBetween(edges: BAEdge[], type: BAEdge['type'], a: string, b: string): BAEdge | undefined {
  return edges.find(
    (e) => e.type === type && ((e.from === a && e.to === b) || (e.from === b && e.to === a)),
  );
}

interface BacklogAssistantState {
  issues: Record<string, BAIssue>;
  edges: BAEdge[];
  // Minimal info for issues referenced by an edge but outside the fetched project/team batch —
  // purely additive display data, never included in capacity/scoring math.
  externalIssues: Record<string, DependencyCandidate>;
  objectiveGroups: ObjectiveGroups;
  collapsedObjectives: Set<string>;
  rankOverrides: Record<string, RankOverride>;
  newIssueKeys: Set<string>;

  selectedNode: string | null;
  addingEdge: boolean;
  autosaveTick: number;
  graphApi: GraphApi | null;
  rankOverrideTarget: string | null;
  undoToast: BAEdge | null;

  hydrateFromLiveData: (
    issues: Record<string, BAIssue>,
    edges: BAEdge[],
    newIssueKeys: Set<string>,
    externalIssues: Record<string, DependencyCandidate>,
  ) => void;

  setSelectedNode: (key: string | null) => void;
  setAddingEdge: (on: boolean) => void;
  setGraphApi: (api: GraphApi | null) => void;
  touchAutosave: () => void;
  setRankOverrideTarget: (key: string | null) => void;
  dismissUndoToast: () => void;

  addUserEdge: (from: string, to: string) => BAEdge | null;
  removeEdge: (id: string) => BAEdge | null;
  reverseEdge: (id: string) => BAEdge | null;
  undoRemoveEdge: (edge: BAEdge) => void;

  addToObjective: (childKey: string, objKey: string) => void;
  removeFromObjective: (childKey: string, objKey: string) => void;

  collapseObjective: (objKey: string) => void;
  expandObjective: (objKey: string) => void;
  toggleObjective: (objKey: string) => void;
  collapseAllObjectives: () => void;
  expandAllObjectives: () => void;

  setRankOverride: (key: string, reason: string) => void;
  removeRankOverride: (key: string) => void;

  applySessionData: (data: {
    rankOverrides: Record<string, RankOverride>;
    collapsedObjectives: string[];
  }) => void;
}

export const useBacklogAssistantStore = create<BacklogAssistantState>((set, get) => ({
  issues: {},
  edges: [],
  externalIssues: {},
  objectiveGroups: {},
  collapsedObjectives: new Set(),
  rankOverrides: {},
  newIssueKeys: new Set(),

  selectedNode: null,
  addingEdge: false,
  autosaveTick: 0,
  graphApi: null,
  rankOverrideTarget: null,
  undoToast: null,

  hydrateFromLiveData: (issues, edges, newIssueKeys, externalIssues) => {
    const objectiveGroups = rebuildObjectiveGroups(issues, edges);
    set({
      issues,
      edges,
      externalIssues,
      objectiveGroups,
      newIssueKeys,
      collapsedObjectives: new Set(),
      rankOverrides: {},
      selectedNode: null,
      addingEdge: false,
      undoToast: null,
    });
  },

  setSelectedNode: (key) => set({ selectedNode: key }),
  setAddingEdge: (on) => set({ addingEdge: on }),
  setGraphApi: (api) => set({ graphApi: api }),
  touchAutosave: () => set((s) => ({ autosaveTick: s.autosaveTick + 1 })),
  setRankOverrideTarget: (key) => set({ rankOverrideTarget: key }),
  dismissUndoToast: () => set({ undoToast: null }),

  addUserEdge: (from, to) => {
    const state = get();
    if (!from || !to || from === to) return null;
    const fromIssue = state.issues[from];
    const toIssue = state.issues[to];
    if (!fromIssue || !toIssue) return null;
    if (fromIssue.type === 'Objective' || toIssue.type === 'Objective') return null;
    if (state.edges.some((e) => e.type === 'blocks' && e.from === from && e.to === to)) return null;

    const edge: BAEdge = { id: edgeId('blocks', from, to), from, to, type: 'blocks' };
    set((s) => ({ edges: [...s.edges, edge], autosaveTick: s.autosaveTick + 1 }));
    syncEdge(edge, 'add');
    return edge;
  },

  removeEdge: (id) => {
    const edge = get().edges.find((e) => e.id === id);
    if (!edge) return null;
    set((s) => {
      const edges = s.edges.filter((e) => e.id !== id);
      return {
        edges,
        objectiveGroups: rebuildObjectiveGroups(s.issues, edges),
        autosaveTick: s.autosaveTick + 1,
        undoToast: edge,
      };
    });
    syncEdge(edge, 'remove');
    return edge;
  },

  reverseEdge: (id) => {
    const edge = get().edges.find((e) => e.id === id);
    if (!edge) return null;
    const reversed: BAEdge = { id: edgeId(edge.type, edge.to, edge.from), from: edge.to, to: edge.from, type: edge.type };

    set((s) => {
      const edges = [...s.edges.filter((e) => e.id !== id), reversed];
      return { edges, objectiveGroups: rebuildObjectiveGroups(s.issues, edges), autosaveTick: s.autosaveTick + 1 };
    });

    call<{ ok: boolean }>(
      edge.type === 'blocks' ? 'updateDependencyLink' : 'updateRelatesLink',
      edge.type === 'blocks'
        ? { blockedIssueKey: edge.to, blockerIssueKey: edge.from, mode: 'remove' }
        : { issueKeyA: edge.from, issueKeyB: edge.to, mode: 'remove' },
    )
      .then(() =>
        call<{ ok: boolean }>(
          reversed.type === 'blocks' ? 'updateDependencyLink' : 'updateRelatesLink',
          reversed.type === 'blocks'
            ? { blockedIssueKey: reversed.to, blockerIssueKey: reversed.from, mode: 'add' }
            : { issueKeyA: reversed.from, issueKeyB: reversed.to, mode: 'add' },
        ),
      )
      .catch((err) => {
        console.error('Backlog Assistant: failed to reverse dependency link in Jira, reverting', err);
        set((s) => {
          const edges = [...s.edges.filter((e) => e.id !== reversed.id), edge];
          return { edges, objectiveGroups: rebuildObjectiveGroups(s.issues, edges) };
        });
      });

    return reversed;
  },

  undoRemoveEdge: (edge) => {
    set((s) => {
      if (s.edges.some((e) => e.id === edge.id)) return {};
      const edges = [...s.edges, edge];
      return {
        edges,
        objectiveGroups: rebuildObjectiveGroups(s.issues, edges),
        autosaveTick: s.autosaveTick + 1,
        undoToast: null,
      };
    });
    syncEdge(edge, 'add');
  },

  addToObjective: (childKey, objKey) => {
    const state = get();
    if (findEdgeBetween(state.edges, 'relates', objKey, childKey)) return;
    const edge: BAEdge = { id: edgeId('relates', objKey, childKey), from: objKey, to: childKey, type: 'relates' };
    set((s) => {
      const edges = [...s.edges, edge];
      return { edges, objectiveGroups: rebuildObjectiveGroups(s.issues, edges), autosaveTick: s.autosaveTick + 1 };
    });
    syncEdge(edge, 'add');
  },

  removeFromObjective: (childKey, objKey) => {
    const state = get();
    const edge = findEdgeBetween(state.edges, 'relates', objKey, childKey);
    if (!edge) return;
    set((s) => {
      const edges = s.edges.filter((e) => e.id !== edge.id);
      return { edges, objectiveGroups: rebuildObjectiveGroups(s.issues, edges), autosaveTick: s.autosaveTick + 1 };
    });
    syncEdge(edge, 'remove');
  },

  collapseObjective: (objKey) =>
    set((s) => ({ collapsedObjectives: new Set(s.collapsedObjectives).add(objKey) })),
  expandObjective: (objKey) =>
    set((s) => {
      const collapsedObjectives = new Set(s.collapsedObjectives);
      collapsedObjectives.delete(objKey);
      return { collapsedObjectives };
    }),
  toggleObjective: (objKey) =>
    set((s) => {
      const collapsedObjectives = new Set(s.collapsedObjectives);
      if (collapsedObjectives.has(objKey)) collapsedObjectives.delete(objKey);
      else collapsedObjectives.add(objKey);
      return { collapsedObjectives };
    }),
  collapseAllObjectives: () =>
    set((s) => ({ collapsedObjectives: new Set(Object.keys(s.objectiveGroups)) })),
  expandAllObjectives: () => set({ collapsedObjectives: new Set() }),

  setRankOverride: (key, reason) =>
    set((s) => ({
      rankOverrides: { ...s.rankOverrides, [key]: { reason } },
      autosaveTick: s.autosaveTick + 1,
    })),
  removeRankOverride: (key) =>
    set((s) => {
      const rankOverrides = { ...s.rankOverrides };
      delete rankOverrides[key];
      return { rankOverrides, autosaveTick: s.autosaveTick + 1 };
    }),

  applySessionData: (data) => {
    set((s) => ({
      rankOverrides: data.rankOverrides ?? {},
      collapsedObjectives: new Set(
        (data.collapsedObjectives ?? []).filter((k) => s.objectiveGroups[k] !== undefined),
      ),
    }));
  },
}));
