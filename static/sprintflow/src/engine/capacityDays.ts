import type { Team } from '../types';

/** Raw (unreserved) dev capacity for a given sprint day. 0 means nobody can work that day (holiday). */
export function devCapacityForDay(team: Team, day: number): number {
  return team.capacityOverrides[day]?.devs ?? team.defaultCapacity.devs;
}

/** Raw (unreserved) QA capacity for a given sprint day — shares the dev pool when devsAreQAs. */
export function qaCapacityForDay(team: Team, day: number): number {
  if (team.devsAreQAs) return devCapacityForDay(team, day);
  return team.capacityOverrides[day]?.qa ?? team.defaultCapacity.qa;
}

/**
 * True only when this specific day has an explicit capacity override of 0 —
 * e.g. a holiday. Deliberately does NOT trigger off `defaultCapacity` being 0,
 * since that's the "team hasn't configured capacity yet" state, not a
 * single-day exception, and every day would otherwise be flagged.
 */
export function isDevHoliday(team: Team, day: number): boolean {
  return team.capacityOverrides[day]?.devs === 0;
}

export function isQaHoliday(team: Team, day: number): boolean {
  if (team.devsAreQAs) return isDevHoliday(team, day);
  return team.capacityOverrides[day]?.qa === 0;
}
