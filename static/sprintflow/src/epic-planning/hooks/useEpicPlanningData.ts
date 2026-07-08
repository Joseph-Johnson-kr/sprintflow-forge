import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import { useQuarterStore } from '../stores/quarterStore';
import type {
  BacklogEpicOption,
  EpicCycleTimeSettings,
  EpicDetailedCycleTimes,
  EpicStatusConfig,
  Quarter,
  QuarterName,
  RosterMember,
} from '../types/quarter';
import type { MemberRole } from '../../types';

interface TeamMembersResult {
  teamName: string;
  teamId: string | null;
  members: RosterMember[];
}

// Shape of the shared `sprintflow-config:${projectKey}` blob. `memberRoles`,
// `epicCycleTimeSettings`, and `epicDetailedCycleTimes` are read/written here — other
// fields (cycleTimes, capacityOverrides, etc.) are owned by SprintFlow's own app and
// must be preserved untouched on save.
interface SharedConfig {
  memberRoles?: Record<string, MemberRole>;
  epicCycleTimeSettings?: EpicCycleTimeSettings;
  epicDetailedCycleTimes?: EpicDetailedCycleTimes;
  [key: string]: unknown;
}

function currentCalendarQuarter(): QuarterName {
  const month = new Date().getMonth(); // 0-11
  if (month < 3) return 'Q1';
  if (month < 6) return 'Q2';
  if (month < 9) return 'Q3';
  return 'Q4';
}

const DEFAULT_EPIC_CYCLE_TIME_SETTINGS: EpicCycleTimeSettings = {
  discoveryStatuses: [],
  inProgressStatuses: [],
  acceptanceStatuses: [],
  year: new Date().getFullYear(),
  quarter: currentCalendarQuarter(),
};

// invoke() from @forge/bridge returns InvokeResponse<T> — cast through unknown to get T
async function call<T>(fn: string, payload?: Record<string, unknown>): Promise<T> {
  return invoke(fn, payload) as unknown as Promise<T>;
}

export function useEpicPlanningData() {
  const setQuartersForTeam = useQuarterStore((s) => s.setQuartersForTeam);
  const setMemberRoleAcrossQuarters = useQuarterStore((s) => s.setMemberRoleAcrossQuarters);
  const quartersByTeam = useQuarterStore((s) => s.quartersByTeam);

  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [backlogEpics, setBacklogEpics] = useState<BacklogEpicOption[]>([]);
  const [epicStatuses, setEpicStatuses] = useState<EpicStatusConfig[]>([]);
  const [epicCycleTimeSettings, setEpicCycleTimeSettingsState] = useState<EpicCycleTimeSettings>(
    DEFAULT_EPIC_CYCLE_TIME_SETTINGS,
  );
  const [epicDetailedCycleTimes, setEpicDetailedCycleTimes] = useState<
    EpicDetailedCycleTimes | undefined
  >(undefined);
  const [recalculatingEpicCycleTimes, setRecalculatingEpicCycleTimes] = useState(false);

  const projectKeyRef = useRef<string>('');
  const teamIdRef = useRef<string | null>(null);
  const sharedConfigRef = useRef<SharedConfig>({});
  const epicCycleTimeSettingsRef = useRef<EpicCycleTimeSettings>(DEFAULT_EPIC_CYCLE_TIME_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const ctx = await view.getContext();
        const boardId: string =
          ctx.extension?.board?.id ?? ctx.extension?.project?.board?.id ?? '';
        const projectKey: string = ctx.extension?.project?.key ?? '';
        projectKeyRef.current = projectKey;

        const [teamMembersResult, savedQuarters, savedConfig, epicStatusList] = await Promise.all([
          call<TeamMembersResult>('getTeamMembers', { boardId, projectKey }),
          call<Quarter[] | null>('loadQuarters', { projectKey }).catch((err) => {
            console.warn('Epic Planning: loadQuarters failed, continuing with none:', err);
            return null;
          }),
          call<SharedConfig | null>('loadConfig', { projectKey }).catch((err) => {
            console.warn('Epic Planning: loadConfig failed, continuing with defaults:', err);
            return null;
          }),
          call<EpicStatusConfig[]>('getEpicStatuses', { projectKey }).catch((err) => {
            console.warn('Epic Planning: getEpicStatuses failed, phase assignment will be empty:', err);
            return [] as EpicStatusConfig[];
          }),
        ]);

        if (cancelled) return;

        sharedConfigRef.current = savedConfig ?? {};
        const savedRoles = sharedConfigRef.current.memberRoles ?? {};

        const savedEpicCycleTimeSettings =
          sharedConfigRef.current.epicCycleTimeSettings ?? DEFAULT_EPIC_CYCLE_TIME_SETTINGS;
        setEpicCycleTimeSettingsState(savedEpicCycleTimeSettings);
        epicCycleTimeSettingsRef.current = savedEpicCycleTimeSettings;
        setEpicDetailedCycleTimes(sharedConfigRef.current.epicDetailedCycleTimes);
        setEpicStatuses(epicStatusList ?? []);

        const resolvedTeamId = teamMembersResult?.teamId ?? projectKey;
        teamIdRef.current = resolvedTeamId;
        setTeamId(resolvedTeamId);
        setTeamName(teamMembersResult?.teamName || projectKey || 'Team');
        setMembers(
          (teamMembersResult?.members ?? []).map((m) => ({
            ...m,
            role: savedRoles[m.id] ?? m.role,
          })),
        );

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

  // Independent debounced save for the shared config blob (currently just
  // `memberRoles`) — kept separate from the quarters-save timer above so
  // editing a role doesn't reset/interfere with in-flight quarter edits.
  const configSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConfigSaveRef = useRef<{ projectKey: string; config: SharedConfig } | null>(null);

  const flushConfigSave = useRef(() => {
    if (configSaveTimer.current) {
      clearTimeout(configSaveTimer.current);
      configSaveTimer.current = null;
    }
    const pending = pendingConfigSaveRef.current;
    if (!pending) return;
    pendingConfigSaveRef.current = null;
    call('saveConfig', pending).catch((err) =>
      console.error('Epic Planning: failed to save config', err),
    );
  }).current;

  useEffect(() => {
    return () => {
      flushConfigSave();
    };
  }, [flushConfigSave]);

  function queueConfigSave(patch: Partial<SharedConfig>) {
    sharedConfigRef.current = { ...sharedConfigRef.current, ...patch };
    pendingConfigSaveRef.current = {
      projectKey: projectKeyRef.current,
      config: sharedConfigRef.current,
    };
    if (configSaveTimer.current) clearTimeout(configSaveTimer.current);
    configSaveTimer.current = setTimeout(flushConfigSave, 500);
  }

  function updateMemberRole(memberId: string, role: MemberRole) {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));

    const teamId = teamIdRef.current;
    if (teamId) setMemberRoleAcrossQuarters(teamId, memberId, role);

    queueConfigSave({ memberRoles: { ...sharedConfigRef.current.memberRoles, [memberId]: role } });
  }

  // Updates the Epic phase-assignment/quarter-scope settings. This data is purely for review —
  // it is never fed into quarterEngine's forecast math.
  const updateEpicCycleTimeSettings = useCallback((settings: EpicCycleTimeSettings) => {
    setEpicCycleTimeSettingsState(settings);
    epicCycleTimeSettingsRef.current = settings;
    queueConfigSave({ epicCycleTimeSettings: settings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recalculateEpicCycleTimes = useCallback(async () => {
    setRecalculatingEpicCycleTimes(true);
    try {
      const { year, quarter } = epicCycleTimeSettingsRef.current;
      const fresh = await call<EpicDetailedCycleTimes | null>('getEpicCycleTimes', {
        projectKey: projectKeyRef.current,
        teamId: teamIdRef.current,
        year,
        quarter,
      });
      if (fresh) {
        setEpicDetailedCycleTimes(fresh);
        queueConfigSave({ epicDetailedCycleTimes: fresh });
      } else {
        console.warn('Epic Planning: no cycle time data returned — check team, status names, and quarter');
      }
    } catch (err) {
      console.error('Epic Planning: failed to recalculate epic cycle times', err);
    } finally {
      setRecalculatingEpicCycleTimes(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loading,
    teamId,
    teamName,
    members,
    backlogEpics,
    updateMemberRole,
    epicStatuses,
    epicCycleTimeSettings,
    updateEpicCycleTimeSettings,
    epicDetailedCycleTimes,
    recalculateEpicCycleTimes,
    recalculatingEpicCycleTimes,
  };
}
