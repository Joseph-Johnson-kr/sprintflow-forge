import { useEffect, useRef, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import { useQuarterStore } from '../stores/quarterStore';
import type { BacklogEpicOption, Quarter, RosterMember } from '../types/quarter';

interface TeamMembersResult {
  teamName: string;
  teamId: string | null;
  members: RosterMember[];
}

// invoke() from @forge/bridge returns InvokeResponse<T> — cast through unknown to get T
async function call<T>(fn: string, payload?: Record<string, unknown>): Promise<T> {
  return invoke(fn, payload) as unknown as Promise<T>;
}

export function useEpicPlanningData() {
  const setQuartersForTeam = useQuarterStore((s) => s.setQuartersForTeam);
  const quartersByTeam = useQuarterStore((s) => s.quartersByTeam);

  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [backlogEpics, setBacklogEpics] = useState<BacklogEpicOption[]>([]);

  const projectKeyRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const ctx = await view.getContext();
        const boardId: string =
          ctx.extension?.board?.id ?? ctx.extension?.project?.board?.id ?? '';
        const projectKey: string = ctx.extension?.project?.key ?? '';
        projectKeyRef.current = projectKey;

        const [teamMembersResult, savedQuarters] = await Promise.all([
          call<TeamMembersResult>('getTeamMembers', { boardId, projectKey }),
          call<Quarter[] | null>('loadQuarters', { projectKey }).catch((err) => {
            console.warn('Epic Planning: loadQuarters failed, continuing with none:', err);
            return null;
          }),
        ]);

        if (cancelled) return;

        const resolvedTeamId = teamMembersResult?.teamId ?? projectKey;
        setTeamId(resolvedTeamId);
        setTeamName(teamMembersResult?.teamName || projectKey || 'Team');
        setMembers(teamMembersResult?.members ?? []);

        if (savedQuarters && savedQuarters.length > 0) {
          setQuartersForTeam(resolvedTeamId, savedQuarters);
        }

        const epics = await call<BacklogEpicOption[]>('getBacklogEpics', {
          projectKey,
          teamId: resolvedTeamId,
        }).catch((err) => {
          console.warn('Epic Planning: getBacklogEpics failed, dropdown will be empty:', err);
          return [];
        });
        if (!cancelled) setBacklogEpics(epics ?? []);
      } catch (err) {
        console.error('Epic Planning: failed to load Jira data', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [setQuartersForTeam]);

  // Debounced auto-save — flushed immediately on unmount so closing the panel
  // shortly after an edit doesn't silently drop the pending save.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ projectKey: string; quarters: Quarter[] } | null>(null);

  const flushSave = useRef(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    call('saveQuarters', pending).catch((err) =>
      console.error('Epic Planning: failed to save quarters', err),
    );
  }).current;

  useEffect(() => {
    if (loading || !teamId) return;
    const quarters = quartersByTeam[teamId];
    if (!quarters) return;

    pendingSaveRef.current = { projectKey: projectKeyRef.current, quarters };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 500);
  }, [loading, teamId, quartersByTeam, flushSave]);

  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  return { loading, teamId, teamName, members, backlogEpics };
}
