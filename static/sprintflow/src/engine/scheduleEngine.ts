import type { Story, Team } from '../types';
import { devCapacityForDay, isDevHoliday, isQaHoliday, qaCapacityForDay } from './capacityDays';

export interface AutoScheduleResult {
  startDays: Record<string, number>;
  overflow: string[];
}

function topologicalSort(stories: Story[]): Story[] {
  const storyMap = new Map(stories.map((s) => [s.issueKey, s]));
  const visited = new Set<string>();
  const result: Story[] = [];

  function visit(story: Story) {
    if (visited.has(story.issueKey)) return;
    visited.add(story.issueKey);
    for (const depKey of story.dependencies) {
      const dep = storyMap.get(depKey);
      if (dep) visit(dep);
    }
    result.push(story);
  }

  for (const story of stories) visit(story);
  return result;
}

interface PhaseWalk {
  days: number[];
  nextDay: number;
}

/**
 * Walks forward from `from`, claiming one unit/day from `remaining` for each
 * of `unitsNeeded` days. A day with an explicit 0-capacity override (a
 * holiday) is skipped transparently — it doesn't block or count toward the
 * phase, so a story can start before a holiday and resume after it instead
 * of having its whole start pushed past it. A day where capacity is merely
 * already claimed by other stories (contention) fails the whole attempt, same
 * as before, so the story falls back to a later `start`.
 */
function walkPhase(
  from: number,
  unitsNeeded: number,
  isHoliday: (day: number) => boolean,
  remaining: number[],
  sprintLength: number,
): PhaseWalk | null {
  const days: number[] = [];
  let day = from;
  while (days.length < unitsNeeded) {
    if (day > sprintLength) return null;
    if (isHoliday(day)) {
      day++;
      continue;
    }
    if (remaining[day - 1] < 1) return null;
    days.push(day);
    day++;
  }
  return { days, nextDay: day };
}

/**
 * Places non-override stories in the earliest day-window where dev/QA capacity
 * has room, gated by each story's explicit dependencies — the same
 * topological-sort + earliest-fitting-window search Epic Planning's
 * quarterEngine.ts uses for Epics, applied at the day/story granularity.
 */
export function computeAutoSchedule(team: Team): AutoScheduleResult {
  const sprintLength = team.sprintLength;
  const remainingDev: number[] = [];
  const remainingQA: number[] = [];
  for (let d = 1; d <= sprintLength; d++) {
    remainingDev.push(devCapacityForDay(team, d));
    remainingQA.push(qaCapacityForDay(team, d));
  }
  // When devsAreQAs, dev and QA phases draw from the same pool — share the array.
  const qaPool = team.devsAreQAs ? remainingDev : remainingQA;
  const devHoliday = (d: number) => isDevHoliday(team, d);
  const qaHoliday = (d: number) => isQaHoliday(team, d);

  const schedulable = team.backlog.filter((s) => !s.override);
  const sorted = topologicalSort(schedulable);

  const doneDay: Record<string, number> = {};
  const startDays: Record<string, number> = {};
  const overflow: string[] = [];

  for (const story of sorted) {
    const cycle = team.cycleTimes[story.storyPoints];
    if (!cycle) {
      overflow.push(story.issueKey);
      continue;
    }
    const devDays = cycle.dev ?? 0;
    const qaDays = cycle.qa ?? 0;

    if (devDays === 0 && qaDays === 0) {
      startDays[story.issueKey] = 1;
      doneDay[story.issueKey] = 0;
      continue;
    }

    const minStart = story.dependencies.reduce((max, depKey) => {
      const end = doneDay[depKey];
      return end !== undefined ? Math.max(max, end + 1) : max;
    }, 1);

    let start = minStart;
    let placedDev: PhaseWalk | null = null;
    let placedQA: PhaseWalk | null = null;

    while (start <= sprintLength) {
      placedDev =
        devDays > 0
          ? walkPhase(start, devDays, devHoliday, remainingDev, sprintLength)
          : { days: [], nextDay: start };
      placedQA =
        placedDev && qaDays > 0
          ? walkPhase(placedDev.nextDay, qaDays, qaHoliday, qaPool, sprintLength)
          : placedDev
            ? { days: [], nextDay: placedDev.nextDay }
            : null;

      if (placedDev && placedQA) break;
      placedDev = null;
      placedQA = null;
      start++;
    }

    if (!placedDev || !placedQA) {
      overflow.push(story.issueKey);
      continue;
    }

    for (const d of placedDev.days) remainingDev[d - 1] -= 1;
    for (const d of placedQA.days) qaPool[d - 1] -= 1;

    const actualStart = placedDev.days[0] ?? placedQA.days[0] ?? start;
    const lastDay =
      placedQA.days[placedQA.days.length - 1] ??
      placedDev.days[placedDev.days.length - 1] ??
      actualStart - 1;

    startDays[story.issueKey] = actualStart;
    doneDay[story.issueKey] = lastDay;
  }

  return { startDays, overflow };
}
