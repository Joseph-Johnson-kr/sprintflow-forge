import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CycleTime, DailyCapacity, MemberRole, Story, Team, TeamMemberConfig } from '../types';
import { makeDefaultTeam, makeId } from '../utils/defaults';

function deriveCapacity(members: TeamMemberConfig[]): DailyCapacity {
  return {
    devs: members.filter((m) => m.role === 'dev' || m.role === 'both').length,
    qa: members.filter((m) => m.role === 'qa' || m.role === 'both').length,
  };
}

interface TeamState {
  teams: Team[];
  selectedTeamId: string | null;

  selectTeam: (id: string) => void;
  addTeam: (name?: string) => string;
  removeTeam: (id: string) => void;
  renameTeam: (id: string, name: string) => void;

  addTeamMember: (teamId: string, name: string, role: MemberRole) => void;
  removeTeamMember: (teamId: string, memberId: string) => void;
  updateTeamMember: (
    teamId: string,
    memberId: string,
    patch: Partial<Pick<TeamMemberConfig, 'name' | 'role'>>,
  ) => void;

  setCycleTime: (teamId: string, sp: number, value: CycleTime) => void;
  removeCycleTime: (teamId: string, sp: number) => void;
  setDefaultCapacity: (teamId: string, capacity: DailyCapacity) => void;
  setSprintLength: (teamId: string, length: number) => void;
  setSprintStartDay: (teamId: string, day: number) => void;
  setDevsAreQAs: (teamId: string, value: boolean) => void;
  setCapacityOverride: (
    teamId: string,
    day: number,
    capacity: Partial<DailyCapacity> | null,
  ) => void;

  importTeam: (team: Team) => string;

  setBacklog: (teamId: string, backlog: Story[]) => void;
  updateStory: (teamId: string, issueKey: string, patch: Partial<Story>) => void;
  removeStory: (teamId: string, issueKey: string) => void;
  clearBacklog: (teamId: string) => void;
  moveStoryUp: (teamId: string, issueKey: string) => void;
  moveStoryDown: (teamId: string, issueKey: string) => void;
}

function updateTeam(teams: Team[], id: string, patch: (t: Team) => Team): Team[] {
  return teams.map((t) => (t.id === id ? patch(t) : t));
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set) => ({
      teams: [],
      selectedTeamId: null,

      selectTeam: (id) => set({ selectedTeamId: id }),

      addTeam: (name = 'New Team') => {
        const team = makeDefaultTeam(name);
        set((s) => ({
          teams: [...s.teams, team],
          selectedTeamId: s.selectedTeamId ?? team.id,
        }));
        return team.id;
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

      addTeamMember: (teamId, name, role) =>
        set((s) => ({
          teams: updateTeam(s.teams, teamId, (t) => {
            const members = [...(t.members ?? []), { id: makeId(), name, role }];
            return { ...t, members, defaultCapacity: deriveCapacity(members) };
          }),
        })),

      removeTeamMember: (teamId, memberId) =>
        set((s) => ({
          teams: updateTeam(s.teams, teamId, (t) => {
            const members = (t.members ?? []).filter((m) => m.id !== memberId);
            return { ...t, members, defaultCapacity: deriveCapacity(members) };
          }),
        })),

      updateTeamMember: (teamId, memberId, patch) =>
        set((s) => ({
          teams: updateTeam(s.teams, teamId, (t) => {
            const members = (t.members ?? []).map((m) =>
              m.id === memberId ? { ...m, ...patch } : m,
            );
            return { ...t, members, defaultCapacity: deriveCapacity(members) };
          }),
        })),

      setCycleTime: (teamId, sp, value) =>
        set((s) => ({
          teams: updateTeam(s.teams, teamId, (t) => ({
            ...t,
            cycleTimes: { ...t.cycleTimes, [sp]: value },
          })),
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

      setCapacityOverride: (teamId, day, capacity) =>
        set((s) => ({
          teams: updateTeam(s.teams, teamId, (t) => {
            const next = { ...t.capacityOverrides };
            if (!capacity) delete next[day];
            else next[day] = capacity;
            return { ...t, capacityOverrides: next };
          }),
        })),

      importTeam: (team) => {
        const newId = makeId();
        const imported: Team = { ...team, id: newId };
        set((s) => ({ teams: [...s.teams, imported], selectedTeamId: newId }));
        return newId;
      },

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
    }),
    {
      name: 'sprintflow-teams',
      version: 2,
      migrate(persistedState: unknown, version: number) {
        const state = persistedState as { teams?: Record<string, unknown>[] };
        if (version < 2 && state.teams) {
          for (const team of state.teams) {
            if (!('members' in team)) {
              (team as Record<string, unknown>).members = [];
            }
          }
        }
        return state as unknown as TeamState;
      },
    },
  ),
);

export function getSelectedTeam(state: TeamState): Team | null {
  if (!state.selectedTeamId) return null;
  return state.teams.find((t) => t.id === state.selectedTeamId) ?? null;
}
