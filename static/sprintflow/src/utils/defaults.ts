import type { CycleTimes, Team } from '../types';

export const DEFAULT_CYCLE_TIMES: CycleTimes = {
  1: { dev: 1, qa: 1 },
  2: { dev: 2, qa: 1 },
  3: { dev: 3, qa: 1 },
  5: { dev: 4, qa: 2 },
  8: { dev: 6, qa: 3 },
  13: { dev: 9, qa: 4 },
};

export const DEFAULT_SPRINT_LENGTH = 10;

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeDefaultTeam(name = 'New Team'): Team {
  return {
    id: makeId(),
    name,
    cycleTimes: { ...DEFAULT_CYCLE_TIMES },
    defaultCapacity: { devs: 0, qa: 0 },
    sprintLength: DEFAULT_SPRINT_LENGTH,
    sprintStartDay: 1, // Monday
    devsAreQAs: false,
    members: [],
    backlog: [],
    capacityOverrides: {},
  };
}
