import { create } from 'zustand';
import type { CycleTime, CycleTimes, DailyCapacity, DetailedCycleTimes, MemberRole, Story, Team, TeamMemberConfig } from '../types';
import { deriveDefaultCapacity, makeId } from '../utils/defaults';

interface TeamState {
  teams: Team[];
  selectedTeamId: string | null;

  setTeamState: (teams: Team[], selectedTeamId: string | null) => void;
  selectTeam: (id: string) => void;
  addTeam: (name?: string) => string;
  removeTeam: (id: string) => void;
  renameTeam: (id: string, name: string) => void;

  setCycleTime: (teamId: string, sp: number, value: CycleTime) => void;
  setCycleTimes: (teamId: string, cycleTimes: CycleTimes) => void;
  setDetailedCycleTimes: (teamId: string, data: DetailedCycleTimes) => void;
  removeCycleTime: (teamId: string, sp: number) => void;
  setDefaultCapacity: (teamId: string, capacity: DailyCapacity) => void;
  setSprintLength: (teamId: string, length: number) => void;
  setSprintStartDay: (teamId: string, day: number) => void;
  setDevsAreQAs: (teamId: string, value: boolean) => void;
  updateMemberRole: (teamId: string, memberId: string, role: MemberRole) => void;
  setCapacityOverride: (
    teamId: string,
    day: number,
    capacity: Partial<DailyCapacity> | null,
  ) => void;

  setBacklog: (teamId: string, backlog: Story[]) => void;
  updateStory: (teamId: string, issueKey: string, patch: Partial<Story>) => void;
  applyStartDays: (teamId: string, startDays: Record<string, number>) => void;
  setRollover: (teamId: string, issueKey: string, value: boolean) => void;
  removeStory: (teamId: string, issueKey: string) => void;
  clearBacklog: (teamId: string) => void;
  moveStoryUp: (teamId: string, issueKey: string) => void;
  moveStoryDown: (teamId: string, issueKey: string) => void;
}

function updateTeam(teams: Team[], id: string, patch: (t: Team) => Team): Team[] {
  return teams.map((t) => (t.id === id ? patch(t) : t));
}

export const useTeamStore = create<TeamState>()((set) => ({
  teams: [],
  selectedTeamId: null,

  setTeamState: (teams, selectedTeamId) => set({ teams, selectedTeamId }),

  selectTeam: (id) => set({ selectedTeamId: id }),

  addTeam: (name = 'New Team') => {
    const id = makeId();
    const team: Team = {
      id,
      name,
      cycleTimes: {},
      defaultCapacity: { devs: 0, qa: 0 },
      sprintLength: 10,
      sprintStartDay: 1,
      devsAreQAs: false,
      members: [],
      backlog: [],
      capacityOverrides: {},
    };
    set((s) => ({
      teams: [...s.teams, team],
      selectedTeamId: s.selectedTeamId ?? id,
    }));
    return id;
  },

  removeTeam: (id) =>
    set((s) => {
      const teams = s.teams.filter((t) => t.id !== id);
      const selectedTeamId =
        s.selectedTeamId === id ? (teams[0]?.id ?? null) : s.selectedTeamId;
      return { teams, selectedTeamId };
    }),

  renameTeam: (id, name) =>
    set((s) => ({ teams: updateTeam(s.teams, id, (t) => ({ ...t, name })) })),

  setCycleTime: (teamId, sp, value) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({
        ...t,
        cycleTimes: { ...t.cycleTimes, [sp]: value },
      })),
    })),

  setCycleTimes: (teamId, cycleTimes) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({ ...t, cycleTimes })),
    })),

  setDetailedCycleTimes: (teamId, detailedCycleTimes) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({ ...t, detailedCycleTimes })),
    })),

  removeCycleTime: (teamId, sp) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => {
        const next = { ...t.cycleTimes };
        delete next[sp];
        return { ...t, cycleTimes: next };
      }),
    })),

  setDefaultCapacity: (teamId, capacity) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({ ...t, defaultCapacity: capacity })),
    })),

  setSprintLength: (teamId, length) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({
        ...t,
        sprintLength: Math.max(1, Math.floor(length)),
      })),
    })),

  setSprintStartDay: (teamId, day) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({ ...t, sprintStartDay: day })),
    })),

  setDevsAreQAs: (teamId, value) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({ ...t, devsAreQAs: value })),
    })),

  updateMemberRole: (teamId, memberId, role) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => {
        const members = t.members.map((m): TeamMemberConfig =>
          m.id === memberId ? { ...m, role } : m,
        );
        return { ...t, members, defaultCapacity: deriveDefaultCapacity(members) };
      }),
    })),

  setCapacityOverride: (teamId, day, capacity) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => {
        const next = { ...t.capacityOverrides };
        if (!capacity) delete next[day];
        else next[day] = capacity;
        return { ...t, capacityOverrides: next };
      }),
    })),

  setBacklog: (teamId, backlog) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({ ...t, backlog })),
    })),

  updateStory: (teamId, issueKey, patch) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({
        ...t,
        backlog: t.backlog.map((st) =>
          st.issueKey === issueKey ? { ...st, ...patch } : st,
        ),
      })),
    })),

  applyStartDays: (teamId, startDays) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({
        ...t,
        backlog: t.backlog.map((st) =>
          startDays[st.issueKey] !== undefined
            ? { ...st, startDay: startDays[st.issueKey] }
            : st,
        ),
      })),
    })),

  setRollover: (teamId, issueKey, value) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => {
        const backlog = t.backlog.map((st) =>
          st.issueKey === issueKey ? { ...st, rollover: value } : st,
        );
        if (!value) return { ...t, backlog };

        const idx = backlog.findIndex((st) => st.issueKey === issueKey);
        if (idx < 0) return { ...t, backlog };
        const [story] = backlog.splice(idx, 1);
        const insertAt = backlog.findIndex((st) => !st.rollover);
        backlog.splice(insertAt < 0 ? backlog.length : insertAt, 0, story);
        return { ...t, backlog };
      }),
    })),

  removeStory: (teamId, issueKey) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({
        ...t,
        backlog: t.backlog.filter((st) => st.issueKey !== issueKey),
      })),
    })),

  clearBacklog: (teamId) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => ({ ...t, backlog: [] })),
    })),

  moveStoryUp: (teamId, issueKey) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => {
        const idx = t.backlog.findIndex((st) => st.issueKey === issueKey);
        if (idx <= 0) return t;
        const backlog = [...t.backlog];
        [backlog[idx - 1], backlog[idx]] = [backlog[idx], backlog[idx - 1]];
        return { ...t, backlog };
      }),
    })),

  moveStoryDown: (teamId, issueKey) =>
    set((s) => ({
      teams: updateTeam(s.teams, teamId, (t) => {
        const idx = t.backlog.findIndex((st) => st.issueKey === issueKey);
        if (idx < 0 || idx >= t.backlog.length - 1) return t;
        const backlog = [...t.backlog];
        [backlog[idx], backlog[idx + 1]] = [backlog[idx + 1], backlog[idx]];
        return { ...t, backlog };
      }),
    })),
}));

export function getSelectedTeam(state: TeamState): Team | null {
  if (!state.selectedTeamId) return null;
  return state.teams.find((t) => t.id === state.selectedTeamId) ?? null;
}
