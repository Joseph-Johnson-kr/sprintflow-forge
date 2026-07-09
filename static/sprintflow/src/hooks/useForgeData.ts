import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import { useTeamStore } from '../stores/teamStore';
import { DEFAULT_CYCLE_TIMES, deriveDefaultCapacity, makeId } from '../utils/defaults';
import type {
  BoardStatusConfig,
  CycleTimes,
  CycleTimeSettings,
  DetailedCycleTimes,
  MemberRole,
  SprintOption,
  Story,
  Team,
  TeamMemberConfig,
} from '../types';

interface TeamMembersResult {
  teamName: string;
  teamId: string | null;
  members: TeamMemberConfig[];
}

interface SavedConfig {
  devsAreQAs?: boolean;
  capacityOverrides?: Record<number, { devs?: number; qa?: number }>;
  cycleTimes?: CycleTimes;
  detailedCycleTimes?: DetailedCycleTimes;
  cycleTimeSettings?: CycleTimeSettings;
  storyOverrides?: Record<string, Partial<Story>>;
  memberRoles?: Record<string, MemberRole>;
  selectedSprintId?: number;
}

const DEFAULT_CYCLE_TIME_SETTINGS: CycleTimeSettings = {
  devStatuses: ['In Progress', 'Ready for Review'],
  qaStatuses: ['Ready for Test', 'Testing'],
  daysBack: 60,
};

function deriveCycleTimes(detail: DetailedCycleTimes, settings: CycleTimeSettings): CycleTimes {
  const result: CycleTimes = {};
  for (const [spStr, statusMap] of Object.entries(detail)) {
    const sp = Number(spStr);
    const dev = Math.round(settings.devStatuses.reduce((sum, s) => sum + (statusMap[s] ?? 0), 0));
    const qa = Math.round(settings.qaStatuses.reduce((sum, s) => sum + (statusMap[s] ?? 0), 0));
    if (dev > 0 || qa > 0) result[sp] = { dev, qa };
  }
  return result;
}

// invoke() from @forge/bridge returns InvokeResponse<T> — cast through unknown to get T
async function call<T>(fn: string, payload?: Record<string, unknown>): Promise<T> {
  return invoke(fn, payload) as unknown as Promise<T>;
}

export function useForgeData() {
  const setTeamState = useTeamStore((s) => s.setTeamState);
  const setBacklog = useTeamStore((s) => s.setBacklog);
  const setSprintLength = useTeamStore((s) => s.setSprintLength);
  const setSprintStartDay = useTeamStore((s) => s.setSprintStartDay);
  const setCycleTimes = useTeamStore((s) => s.setCycleTimes);
  const setDetailedCycleTimes = useTeamStore((s) => s.setDetailedCycleTimes);
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);

  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState('');
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [sprintLoading, setSprintLoading] = useState(false);
  const [boardStatuses, setBoardStatuses] = useState<BoardStatusConfig[]>([]);
  const [cycleTimeSettings, setCycleTimeSettingsState] = useState<CycleTimeSettings>(DEFAULT_CYCLE_TIME_SETTINGS);
  const [recalculating, setRecalculating] = useState(false);

  // Refs so callbacks always have the latest values without stale closures
  const storyOverridesRef = useRef<Record<string, Partial<Story>>>({});
  const projectKeyRef = useRef<string>('');
  const boardIdRef = useRef<string>('');
  const teamNameRef = useRef<string>('');
  const teamIdRef = useRef<string | null>(null);
  const cycleTimeSettingsRef = useRef<CycleTimeSettings>(DEFAULT_CYCLE_TIME_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const ctx = await view.getContext();
        const boardId: string =
          ctx.extension?.board?.id ?? ctx.extension?.project?.board?.id ?? '';
        const pKey: string = ctx.extension?.project?.key ?? '';

        if (cancelled) return;
        setProjectKey(pKey);
        projectKeyRef.current = pKey;
        boardIdRef.current = boardId;

        // Load saved config (fault-tolerant)
        let config: SavedConfig = {};
        try {
          const savedConfig = await call<SavedConfig | null>('loadConfig', { projectKey: pKey });
          config = savedConfig ?? {};
        } catch (err) {
          console.warn('SprintFlow: loadConfig failed, continuing with defaults:', err);
        }

        // Migrate old single-string cycleTimeSettings shape to arrays
        const rawSettings = config.cycleTimeSettings as unknown as Record<string, unknown> | undefined;
        const settings: CycleTimeSettings =
          rawSettings && Array.isArray(rawSettings.devStatuses)
            ? (rawSettings as unknown as CycleTimeSettings)
            : DEFAULT_CYCLE_TIME_SETTINGS;
        setCycleTimeSettingsState(settings);
        cycleTimeSettingsRef.current = settings;

        // Fetch sprint list, team members, and board statuses in parallel
        // getBoardStatuses is fault-tolerant — app loads with empty status list if resolver is unavailable
        const [sprintList, teamMembersResult, boardStatusList] = await Promise.all([
          call<SprintOption[]>('getSprintList', { boardId, projectKey: pKey }),
          call<TeamMembersResult>('getTeamMembers', { boardId, projectKey: pKey }),
          call<BoardStatusConfig[]>('getBoardStatuses', { boardId, projectKey: pKey }).catch((err) => {
            console.warn('SprintFlow: getBoardStatuses failed, board status toggles will be empty:', err);
            return [] as BoardStatusConfig[];
          }),
        ]);

        if (cancelled) return;

        setBoardStatuses(boardStatusList ?? []);

        // Pick default sprint: saved → first future → first active
        const savedId = config.selectedSprintId;
        const defaultSprint =
          (savedId != null && sprintList.find((s) => s.id === savedId)) ||
          sprintList.find((s) => s.state === 'future') ||
          sprintList.find((s) => s.state === 'active') ||
          null;

        setSprints(sprintList);
        setSelectedSprintId(defaultSprint?.id ?? null);

        const fetchedTeamName = teamMembersResult?.teamName ?? '';
        const fetchedTeamId = teamMembersResult?.teamId ?? null;
        teamNameRef.current = fetchedTeamName;
        teamIdRef.current = fetchedTeamId;

        // Fetch issues for the selected sprint
        const backlogIssues = defaultSprint
          ? await call<Story[]>('getSprintIssues', {
              sprintId: defaultSprint.id,
              boardId,
              projectKey: pKey,
            })
          : [];

        if (cancelled) return;

        // Auto-fetch detailed cycle times if none saved
        let detailedCycleTimes: DetailedCycleTimes | null = config.detailedCycleTimes ?? null;
        if (!detailedCycleTimes && fetchedTeamId) {
          try {
            detailedCycleTimes = await call<DetailedCycleTimes | null>('getCycleTimes', {
              projectKey: pKey,
              teamId: fetchedTeamId,
              daysBack: settings.daysBack,
            });
          } catch (err) {
            console.warn('SprintFlow: auto cycle time fetch failed:', err);
          }
        }

        if (cancelled) return;

        // Resolve cycle times: saved flat (may include manual overrides) → derived from
        // detailed → defaults. Saved values take priority so a manual edit in the Flow
        // grid estimates table survives reloads instead of being silently re-derived.
        const cycleTimes: CycleTimes =
          config.cycleTimes ??
          (detailedCycleTimes ? deriveCycleTimes(detailedCycleTimes, settings) : null) ??
          DEFAULT_CYCLE_TIMES;

        // Merge saved story overrides
        const storyOverrides = config.storyOverrides ?? {};
        storyOverridesRef.current = storyOverrides;
        const backlog: Story[] = (backlogIssues ?? []).map((s) => ({
          ...s,
          ...(storyOverrides[s.issueKey] ?? {}),
        }));

        // Merge saved member roles
        const savedRoles = config.memberRoles ?? {};
        const members: TeamMemberConfig[] = (teamMembersResult?.members ?? []).map((m) => ({
          ...m,
          role: savedRoles[m.id] ?? m.role,
        }));

        const defaultCapacity = deriveDefaultCapacity(members);

        const name = fetchedTeamName || pKey || 'Team';
        setTeamName(name);

        const teamId = makeId();
        const team: Team = {
          id: teamId,
          name,
          cycleTimes,
          detailedCycleTimes: detailedCycleTimes ?? undefined,
          defaultCapacity,
          sprintLength: defaultSprint?.sprintLength ?? 10,
          sprintStartDay: defaultSprint?.sprintStartDay ?? 1,
          devsAreQAs: config.devsAreQAs ?? false,
          members,
          backlog,
          capacityOverrides: config.capacityOverrides ?? {},
        };

        setTeamState([team], teamId);
      } catch (err) {
        console.error('SprintFlow: failed to load Jira data', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [setTeamState]);

  // Sprint change
  const selectSprint = useCallback(
    async (sprintId: number) => {
      const sprint = sprints.find((s) => s.id === sprintId);
      if (!sprint || !selectedTeamId) return;

      setSelectedSprintId(sprintId);
      setSprintLoading(true);
      try {
        const freshIssues = await call<Story[]>('getSprintIssues', {
          sprintId,
          boardId: boardIdRef.current,
          projectKey: projectKeyRef.current,
        });
        const storyOverrides = storyOverridesRef.current;
        const backlog: Story[] = (freshIssues ?? []).map((s) => ({
          ...s,
          ...(storyOverrides[s.issueKey] ?? {}),
        }));
        setBacklog(selectedTeamId, backlog);
        setSprintLength(selectedTeamId, sprint.sprintLength);
        setSprintStartDay(selectedTeamId, sprint.sprintStartDay);
      } catch (err) {
        console.error('SprintFlow: failed to load sprint issues', err);
      } finally {
        setSprintLoading(false);
      }
    },
    [sprints, selectedTeamId, setBacklog, setSprintLength, setSprintStartDay],
  );

  // Update cycle time settings and immediately re-derive cycleTimes if we have detailed data
  const updateCycleTimeSettings = useCallback(
    (settings: CycleTimeSettings) => {
      setCycleTimeSettingsState(settings);
      cycleTimeSettingsRef.current = settings;

      // Re-derive from existing detailed data immediately (no Jira call)
      if (!selectedTeamId) return;
      const team = teams.find((t) => t.id === selectedTeamId);
      if (team?.detailedCycleTimes) {
        setCycleTimes(selectedTeamId, deriveCycleTimes(team.detailedCycleTimes, settings));
      }
    },
    [selectedTeamId, teams, setCycleTimes],
  );

  // Re-derive cycleTimes when a phase toggle changes (called from ConfigView)
  const applyPhaseSettings = useCallback(
    (settings: CycleTimeSettings) => {
      updateCycleTimeSettings(settings);
    },
    [updateCycleTimeSettings],
  );

  // Fetch fresh detailed cycle times from Jira
  const recalculateCycleTimes = useCallback(async () => {
    if (!selectedTeamId) return;
    setRecalculating(true);
    try {
      if (!teamIdRef.current) {
        console.warn('SprintFlow: no team ID available — cannot recalculate cycle times');
        return;
      }
      const fresh = await call<DetailedCycleTimes | null>('getCycleTimes', {
        projectKey: projectKeyRef.current,
        teamId: teamIdRef.current,
        daysBack: cycleTimeSettingsRef.current.daysBack,
      });
      if (fresh) {
        setDetailedCycleTimes(selectedTeamId, fresh);
        setCycleTimes(selectedTeamId, deriveCycleTimes(fresh, cycleTimeSettingsRef.current));
      } else {
        console.warn('SprintFlow: no cycle time data returned — check team ID, status names, and date range');
      }
    } catch (err) {
      console.error('SprintFlow: failed to recalculate cycle times', err);
    } finally {
      setRecalculating(false);
    }
  }, [selectedTeamId, setDetailedCycleTimes, setCycleTimes]);

  // Debounced auto-save — flushed immediately on unmount so closing the panel
  // shortly after an edit doesn't silently drop the pending save.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ projectKey: string; config: SavedConfig } | null>(null);

  const flushSave = useRef(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    call('saveConfig', pending).catch((err) =>
      console.error('SprintFlow: failed to save config', err),
    );
  }).current;

  useEffect(() => {
    if (loading || !projectKey || !selectedTeamId) return;
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team) return;

    const storyOverrides: Record<string, Partial<Story>> = {};
    for (const s of team.backlog) {
      const { issueKey, startDay, rollover, override, overrideCells, dependencies } = s;
      if (
        startDay !== 1 ||
        rollover ||
        override ||
        overrideCells.length > 0 ||
        dependencies.length > 0
      ) {
        storyOverrides[issueKey] = { startDay, rollover, override, overrideCells, dependencies };
      }
    }
    storyOverridesRef.current = storyOverrides;

    const memberRoles: Record<string, MemberRole> = {};
    for (const m of team.members) {
      memberRoles[m.id] = m.role;
    }

    const config: SavedConfig = {
      devsAreQAs: team.devsAreQAs,
      capacityOverrides: team.capacityOverrides,
      cycleTimes: team.cycleTimes,
      detailedCycleTimes: team.detailedCycleTimes,
      cycleTimeSettings: cycleTimeSettingsRef.current,
      storyOverrides,
      memberRoles,
      selectedSprintId: selectedSprintId ?? undefined,
    };

    pendingSaveRef.current = { projectKey, config };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 500);
  }, [loading, projectKey, selectedTeamId, teams, selectedSprintId, flushSave]);

  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  return {
    loading,
    teamName,
    sprints,
    selectedSprintId,
    sprintLoading,
    selectSprint,
    boardStatuses,
    cycleTimeSettings,
    updateCycleTimeSettings,
    applyPhaseSettings,
    recalculateCycleTimes,
    recalculating,
  };
}
