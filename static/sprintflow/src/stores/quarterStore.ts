import { create } from 'zustand';
import type {
  Epic,
  Quarter,
  QuarterName,
  Risk,
  RiskLevel,
  TeamMember,
} from '../types/quarter';
import { QUARTER_DEFAULT_SPRINTS } from '../types/quarter';
import type { TeamMemberConfig } from '../types';

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeDefaultEpic(): Epic {
  return {
    id: uuid(),
    title: 'New Epic',
    size: 'M',
    devAllocation: 1,
    risks: [],
    dependencies: [],
    notes: '',
  };
}

interface QuarterState {
  quartersByTeam: Record<string, Quarter[]>;
  selectedQuarterId: string | null;

  getQuarters: (teamId: string) => Quarter[];
  selectQuarter: (id: string | null) => void;
  addQuarter: (teamId: string, name: QuarterName, year: number) => string;
  removeQuarter: (teamId: string, quarterId: string) => void;
  setSprintCount: (teamId: string, quarterId: string, count: number) => void;

  syncMembersFromTeam: (
    teamId: string,
    quarterId: string,
    teamMembers: TeamMemberConfig[],
  ) => void;
  setAbsence: (
    teamId: string,
    quarterId: string,
    memberId: string,
    sprintNumber: number,
    days: number,
  ) => void;

  importQuarters: (newTeamId: string, quarters: Quarter[]) => void;

  addEpic: (teamId: string, quarterId: string) => void;
  updateEpic: (
    teamId: string,
    quarterId: string,
    epicId: string,
    patch: Partial<Pick<Epic, 'title' | 'size' | 'devAllocation' | 'notes' | 'dependencies'>>,
  ) => void;
  removeEpic: (teamId: string, quarterId: string, epicId: string) => void;
  moveEpicUp: (teamId: string, quarterId: string, epicId: string) => void;
  moveEpicDown: (teamId: string, quarterId: string, epicId: string) => void;

  addRisk: (teamId: string, quarterId: string, epicId: string) => void;
  updateRisk: (
    teamId: string,
    quarterId: string,
    epicId: string,
    riskId: string,
    patch: Partial<Pick<Risk, 'description' | 'level'>>,
  ) => void;
  removeRisk: (
    teamId: string,
    quarterId: string,
    epicId: string,
    riskId: string,
  ) => void;
}

function patchQuarter(
  state: QuarterState,
  teamId: string,
  quarterId: string,
  fn: (q: Quarter) => Quarter,
): Partial<QuarterState> {
  const quarters = state.quartersByTeam[teamId] ?? [];
  return {
    quartersByTeam: {
      ...state.quartersByTeam,
      [teamId]: quarters.map((q) => (q.id === quarterId ? fn(q) : q)),
    },
  };
}

function patchEpic(q: Quarter, epicId: string, fn: (e: Epic) => Epic): Quarter {
  return { ...q, epics: q.epics.map((e) => (e.id === epicId ? fn(e) : e)) };
}

function patchMember(
  q: Quarter,
  memberId: string,
  fn: (m: TeamMember) => TeamMember,
): Quarter {
  return {
    ...q,
    members: q.members.map((m) => (m.id === memberId ? fn(m) : m)),
  };
}

export const useQuarterStore = create<QuarterState>()((set, get) => ({
      quartersByTeam: {},
      selectedQuarterId: null,

      getQuarters: (teamId) => get().quartersByTeam[teamId] ?? [],

      selectQuarter: (id) => set({ selectedQuarterId: id }),

      addQuarter: (teamId, name, year) => {
        const quarter: Quarter = {
          id: uuid(),
          name,
          year,
          sprintCount: QUARTER_DEFAULT_SPRINTS[name],
          teamId,
          members: [],
          epics: [],
        };
        set((s) => ({
          quartersByTeam: {
            ...s.quartersByTeam,
            [teamId]: [...(s.quartersByTeam[teamId] ?? []), quarter],
          },
          selectedQuarterId: quarter.id,
        }));
        return quarter.id;
      },

      removeQuarter: (teamId, quarterId) =>
        set((s) => {
          const quarters = (s.quartersByTeam[teamId] ?? []).filter(
            (q) => q.id !== quarterId,
          );
          const selectedQuarterId =
            s.selectedQuarterId === quarterId
              ? (quarters[0]?.id ?? null)
              : s.selectedQuarterId;
          return {
            quartersByTeam: { ...s.quartersByTeam, [teamId]: quarters },
            selectedQuarterId,
          };
        }),

      setSprintCount: (teamId, quarterId, count) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) => ({
            ...q,
            sprintCount: Math.max(1, Math.floor(count)),
          })),
        ),

      syncMembersFromTeam: (teamId, quarterId, teamMembers) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) => {
            const synced: TeamMember[] = teamMembers.map((tm) => {
              const existing = q.members.find(
                (m) => m.id === tm.id || m.name === tm.name,
              );
              return existing
                ? { ...existing, id: tm.id, name: tm.name }
                : { id: tm.id, name: tm.name, absences: [] };
            });
            return { ...q, members: synced };
          }),
        ),

      setAbsence: (teamId, quarterId, memberId, sprintNumber, days) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) =>
            patchMember(q, memberId, (m) => {
              const absences = m.absences.filter(
                (a) => a.sprintNumber !== sprintNumber,
              );
              if (days > 0) absences.push({ sprintNumber, days });
              return { ...m, absences };
            }),
          ),
        ),

      importQuarters: (newTeamId, quarters) => {
        const reboundQuarters = quarters.map((q) => ({
          ...q,
          id: uuid(),
          teamId: newTeamId,
        }));
        set((s) => ({
          quartersByTeam: {
            ...s.quartersByTeam,
            [newTeamId]: reboundQuarters,
          },
          selectedQuarterId: reboundQuarters[0]?.id ?? s.selectedQuarterId,
        }));
      },

      addEpic: (teamId, quarterId) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) => ({
            ...q,
            epics: [...q.epics, makeDefaultEpic()],
          })),
        ),

      updateEpic: (teamId, quarterId, epicId, patch) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) =>
            patchEpic(q, epicId, (e) => ({ ...e, ...patch })),
          ),
        ),

      removeEpic: (teamId, quarterId, epicId) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) => ({
            ...q,
            epics: q.epics
              .filter((e) => e.id !== epicId)
              .map((e) => ({
                ...e,
                dependencies: e.dependencies.filter((d) => d !== epicId),
              })),
          })),
        ),

      moveEpicUp: (teamId, quarterId, epicId) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) => {
            const idx = q.epics.findIndex((e) => e.id === epicId);
            if (idx <= 0) return q;
            const epics = [...q.epics];
            [epics[idx - 1], epics[idx]] = [epics[idx], epics[idx - 1]];
            return { ...q, epics };
          }),
        ),

      moveEpicDown: (teamId, quarterId, epicId) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) => {
            const idx = q.epics.findIndex((e) => e.id === epicId);
            if (idx < 0 || idx >= q.epics.length - 1) return q;
            const epics = [...q.epics];
            [epics[idx], epics[idx + 1]] = [epics[idx + 1], epics[idx]];
            return { ...q, epics };
          }),
        ),

      addRisk: (teamId, quarterId, epicId) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) =>
            patchEpic(q, epicId, (e) => ({
              ...e,
              risks: [
                ...e.risks,
                { id: uuid(), description: '', level: 'medium' satisfies RiskLevel },
              ],
            })),
          ),
        ),

      updateRisk: (teamId, quarterId, epicId, riskId, patch) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) =>
            patchEpic(q, epicId, (e) => ({
              ...e,
              risks: e.risks.map((r) =>
                r.id === riskId ? { ...r, ...patch } : r,
              ),
            })),
          ),
        ),

      removeRisk: (teamId, quarterId, epicId, riskId) =>
        set((s) =>
          patchQuarter(s, teamId, quarterId, (q) =>
            patchEpic(q, epicId, (e) => ({
              ...e,
              risks: e.risks.filter((r) => r.id !== riskId),
            })),
          ),
        ),
}));

export function getSelectedQuarter(
  state: QuarterState,
  teamId: string,
): Quarter | null {
  if (!state.selectedQuarterId) return null;
  const quarters = state.quartersByTeam[teamId] ?? [];
  return quarters.find((q) => q.id === state.selectedQuarterId) ?? null;
}
