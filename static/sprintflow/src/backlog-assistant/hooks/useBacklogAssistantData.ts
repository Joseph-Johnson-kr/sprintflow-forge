import { useCallback, useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import type { BAEdge, BAIssue, DependencyCandidate, RankOverride, SprintIssue, SprintOption } from '../types';
import { useBacklogAssistantStore } from '../stores/backlogAssistantStore';

interface RawSession {
  nodePositions?: Record<string, { x: number; y: number }>;
  rankOverrides?: Record<string, RankOverride>;
  collapsedObjectives?: string[];
  knownIssueKeys?: string[];
}

interface BacklogAssistantDataResult {
  issues: BAIssue[];
  edges: BAEdge[];
  externalIssues: DependencyCandidate[];
  truncated: boolean;
}

// invoke() from @forge/bridge returns InvokeResponse<T> — cast through unknown to get T
async function call<T>(fn: string, payload?: Record<string, unknown>): Promise<T> {
  return invoke(fn, payload) as unknown as Promise<T>;
}

export function useBacklogAssistantData() {
  const hydrateFromLiveData = useBacklogAssistantStore((s) => s.hydrateFromLiveData);
  const applySessionData = useBacklogAssistantStore((s) => s.applySessionData);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [projectKey, setProjectKey] = useState('');
  const [boardId, setBoardId] = useState('');
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [knownIssueKeys, setKnownIssueKeys] = useState<string[]>([]);
  const [initialPositions, setInitialPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const ctx = await view.getContext();
        const board: string = ctx.extension?.board?.id ?? ctx.extension?.project?.board?.id ?? '';
        const project: string = ctx.extension?.project?.key ?? '';
        setBoardId(board);
        setProjectKey(project);

        // Resolve the board's Team field value so the fetch can scope to this team's backlog,
        // not the whole (multi-team) Jira project — mirrors Epic Planning's teamId resolution.
        const teamMembersResult = await call<{ teamId?: string } | null>('getTeamMembers', {
          boardId: board,
          projectKey: project,
        }).catch(() => null);
        const teamId = teamMembersResult?.teamId ?? project;

        const [data, session, sprintList] = await Promise.all([
          call<BacklogAssistantDataResult>('getBacklogAssistantData', { projectKey: project, teamId }),
          call<RawSession | null>('loadBacklogAssistantSession', { projectKey: project }).catch((err) => {
            console.warn('Backlog Assistant: loadBacklogAssistantSession failed, continuing with none:', err);
            return null;
          }),
          call<SprintOption[]>('getSprintList', { boardId: board, projectKey: project }).catch((err) => {
            console.warn('Backlog Assistant: getSprintList failed, sprint dropdown will be empty:', err);
            return [] as SprintOption[];
          }),
        ]);

        if (cancelled) return;

        const issuesRecord: Record<string, BAIssue> = {};
        for (const issue of data.issues ?? []) issuesRecord[issue.key] = issue;
        const currentKeys = Object.keys(issuesRecord);

        const externalIssuesRecord: Record<string, DependencyCandidate> = {};
        for (const candidate of data.externalIssues ?? []) externalIssuesRecord[candidate.issueKey] = candidate;

        const isFirstLoad = session == null;
        const previouslyKnown = new Set(session?.knownIssueKeys ?? []);
        const newIssueKeys = isFirstLoad
          ? new Set<string>()
          : new Set(currentKeys.filter((k) => !previouslyKnown.has(k)));

        hydrateFromLiveData(issuesRecord, data.edges ?? [], newIssueKeys, externalIssuesRecord);
        applySessionData({
          rankOverrides: session?.rankOverrides ?? {},
          collapsedObjectives: session?.collapsedObjectives ?? [],
        });

        setInitialPositions(session?.nodePositions ?? {});
        setTruncated(Boolean(data.truncated));
        setSprints(sprintList ?? []);
        setKnownIssueKeys(currentKeys);

        // Re-baseline knownIssueKeys to the current backlog so it stays bounded and the
        // "new" highlight only ever reflects issues added since the last time this loaded.
        call('saveBacklogAssistantSession', {
          projectKey: project,
          session: {
            nodePositions: session?.nodePositions ?? {},
            rankOverrides: session?.rankOverrides ?? {},
            collapsedObjectives: session?.collapsedObjectives ?? [],
            knownIssueKeys: currentKeys,
          },
        }).catch((err) => console.error('Backlog Assistant: failed to persist known issue keys', err));
      } catch (err) {
        console.error('Backlog Assistant: failed to load Jira data', err);
        if (!cancelled) setError('Failed to load backlog data from Jira.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromLiveData, applySessionData, reloadTick]);

  const fetchSprintIssues = useCallback(
    (sprintId: number) =>
      call<SprintIssue[]>('getSprintIssues', { sprintId, boardId, projectKey }),
    [boardId, projectKey],
  );

  const retry = useCallback(() => setReloadTick((t) => t + 1), []);

  return {
    loading,
    error,
    truncated,
    projectKey,
    boardId,
    sprints,
    knownIssueKeys,
    initialPositions,
    fetchSprintIssues,
    retry,
  };
}
