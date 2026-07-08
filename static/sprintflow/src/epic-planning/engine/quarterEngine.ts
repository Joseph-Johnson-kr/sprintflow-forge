import type {
  Epic,
  EpicSchedule,
  Quarter,
  QuarterForecast,
  SprintMetrics,
} from '../types/quarter';
import { TSHIRT_SPRINT_DURATIONS } from '../types/quarter';
import type { MemberRole } from '../../types';

const DEFAULT_SPRINT_LENGTH_DAYS = 10;

const DEV_ROLES = new Set<MemberRole>(['dev', 'both']);
const QA_ROLES = new Set<MemberRole>(['qa', 'both']);

function computeSprintCapacityForRoles(
  quarter: Quarter,
  roles: Set<MemberRole>,
  sprintLengthDays: number,
): number[] {
  return Array.from({ length: quarter.sprintCount }, (_, i) => {
    const sprintNumber = i + 1;
    return quarter.members
      .filter((member) => roles.has(member.role))
      .reduce((total, member) => {
        const absence = member.absences.find((a) => a.sprintNumber === sprintNumber);
        const daysOut = absence?.days ?? 0;
        return total + Math.max(0, sprintLengthDays - daysOut);
      }, 0);
  });
}

export function computeSprintCapacityDevDays(
  quarter: Quarter,
  sprintLengthDays = DEFAULT_SPRINT_LENGTH_DAYS,
): number[] {
  return computeSprintCapacityForRoles(quarter, DEV_ROLES, sprintLengthDays);
}

export function computeSprintCapacityQADays(
  quarter: Quarter,
  sprintLengthDays = DEFAULT_SPRINT_LENGTH_DAYS,
): number[] {
  return computeSprintCapacityForRoles(quarter, QA_ROLES, sprintLengthDays);
}

function topologicalSort(epics: Epic[]): Epic[] {
  const epicMap = new Map(epics.map((e) => [e.id, e]));
  const visited = new Set<string>();
  const result: Epic[] = [];

  function visit(epic: Epic) {
    if (visited.has(epic.id)) return;
    visited.add(epic.id);
    for (const depId of epic.dependencies) {
      const dep = epicMap.get(depId);
      if (dep) visit(dep);
    }
    result.push(epic);
  }

  for (const epic of epics) visit(epic);
  return result;
}

function unfitSchedule(epic: Epic): EpicSchedule {
  return {
    epic,
    startSprint: -1,
    endSprint: -1,
    fits: false,
    workedSprints: [],
  };
}

/**
 * True when the team's total capacity that sprint — before any other Epic's
 * claim on it — isn't even enough to cover a full sprint of THIS Epic's rate.
 * That's a team-wide shortfall (absences, a holiday sprint, understaffing),
 * not competition with other work, so it's treated as a pause rather than
 * something that should push the Epic's whole start later.
 */
function isCapacityShortfallSprint(
  totalDevCapacity: number,
  totalQACapacity: number,
  devDaysPerSprint: number,
  qaDaysPerSprint: number,
): boolean {
  return totalDevCapacity < devDaysPerSprint || totalQACapacity < qaDaysPerSprint;
}

interface EpicWindowWalk {
  workedSprints: number[];
}

/**
 * Walks forward sprint-by-sprint from `start`, claiming `durationSprints` worth of
 * actual working sprints. A sprint whose total team capacity can't cover this
 * Epic's rate at all (see isCapacityShortfallSprint) is skipped transparently and
 * doesn't count toward the duration, so an Epic can start before it and resume
 * after instead of having its whole start pushed past it. A sprint where the team
 * *would* have enough capacity but it's already claimed by other Epics (genuine
 * contention) fails the whole attempt, so the caller falls back to a later `start`.
 */
function walkEpicWindow(
  start: number,
  durationSprints: number,
  devDaysPerSprint: number,
  qaDaysPerSprint: number,
  totalDevCapacity: number[],
  totalQACapacity: number[],
  remainingDevCapacity: number[],
  remainingQACapacity: number[],
  sprintCount: number,
): EpicWindowWalk | null {
  const workedSprints: number[] = [];
  let s = start;
  while (workedSprints.length < durationSprints) {
    if (s > sprintCount) return null;
    const idx = s - 1;
    if (
      isCapacityShortfallSprint(totalDevCapacity[idx], totalQACapacity[idx], devDaysPerSprint, qaDaysPerSprint)
    ) {
      s++;
      continue;
    }
    if (remainingDevCapacity[idx] < devDaysPerSprint || remainingQACapacity[idx] < qaDaysPerSprint) {
      return null;
    }
    workedSprints.push(s);
    s++;
  }
  return { workedSprints };
}

/**
 * T-shirt size is the Epic's total sprint span. Dev and QA allocations don't
 * extend that span — they're separate capacity pools that both have to have
 * enough room across the same window for the Epic to "fit". An Epic isn't
 * schedulable in a window unless the team has enough Dev hours AND enough QA
 * hours available in it, so a "done" date reflects QA having had room to test,
 * not just Dev having had room to build.
 */
export function buildQuarterForecast(
  quarter: Quarter,
  sprintLengthDays = DEFAULT_SPRINT_LENGTH_DAYS,
): QuarterForecast {
  const totalDevCapacity = computeSprintCapacityDevDays(quarter, sprintLengthDays);
  const totalQACapacity = computeSprintCapacityQADays(quarter, sprintLengthDays);
  const remainingDevCapacity = [...totalDevCapacity];
  const remainingQACapacity = [...totalQACapacity];
  const usedDevCapacity = Array<number>(quarter.sprintCount).fill(0);
  const usedQACapacity = Array<number>(quarter.sprintCount).fill(0);

  const sorted = topologicalSort(quarter.epics);
  const rawSchedules = new Map<string, EpicSchedule>();
  const epicDoneSprint: Record<string, number> = {};

  for (const epic of sorted) {
    const durationSprints = Math.ceil(TSHIRT_SPRINT_DURATIONS[epic.size]);
    const devDaysPerSprint =
      epic.size === 'XS'
        ? epic.devAllocation * (sprintLengthDays / 2)
        : epic.devAllocation * sprintLengthDays;
    const qaDaysPerSprint =
      epic.size === 'XS'
        ? epic.qaAllocation * (sprintLengthDays / 2)
        : epic.qaAllocation * sprintLengthDays;

    const minStart = epic.dependencies.reduce((max, depId) => {
      const end = epicDoneSprint[depId];
      return end !== undefined ? Math.max(max, end + 1) : max;
    }, 1);

    // Earliest window with enough remaining Dev+QA capacity in every *worked* sprint —
    // sprints where the team's total capacity can't cover this Epic's rate at all are
    // skipped rather than blocking the whole window (see walkEpicWindow).
    let start = minStart;
    let walk: EpicWindowWalk | null = null;
    while (start <= quarter.sprintCount) {
      walk = walkEpicWindow(
        start,
        durationSprints,
        devDaysPerSprint,
        qaDaysPerSprint,
        totalDevCapacity,
        totalQACapacity,
        remainingDevCapacity,
        remainingQACapacity,
        quarter.sprintCount,
      );
      if (walk) break;
      start++;
    }

    if (!walk) {
      rawSchedules.set(epic.id, unfitSchedule(epic));
      continue;
    }

    for (const s of walk.workedSprints) {
      remainingDevCapacity[s - 1] -= devDaysPerSprint;
      usedDevCapacity[s - 1] += devDaysPerSprint;
      remainingQACapacity[s - 1] -= qaDaysPerSprint;
      usedQACapacity[s - 1] += qaDaysPerSprint;
    }

    const workedSprints = walk.workedSprints;
    const epicStart = workedSprints[0];
    const end = workedSprints[workedSprints.length - 1];

    rawSchedules.set(epic.id, {
      epic,
      startSprint: epicStart,
      endSprint: end,
      fits: true,
      workedSprints,
    });
    epicDoneSprint[epic.id] = end;
  }

  // Restore user-defined ordering
  const schedules = quarter.epics.map((e) => rawSchedules.get(e.id)!);

  const sprintMetrics: SprintMetrics[] = Array.from(
    { length: quarter.sprintCount },
    (_, i) => ({
      sprintNumber: i + 1,
      totalCapacityDevDays: totalDevCapacity[i],
      usedCapacityDevDays: usedDevCapacity[i],
      utilizationRatio:
        totalDevCapacity[i] > 0 ? usedDevCapacity[i] / totalDevCapacity[i] : 0,
      totalCapacityQADays: totalQACapacity[i],
      usedCapacityQADays: usedQACapacity[i],
      qaUtilizationRatio:
        totalQACapacity[i] > 0 ? usedQACapacity[i] / totalQACapacity[i] : 0,
    }),
  );

  const overflowEpics = schedules.filter((s) => !s.fits).map((s) => s.epic);

  return { schedules, sprintMetrics, overflowEpics };
}

export function utilizationColor(ratio: number): string {
  if (ratio === 0) return 'bg-slate-100 text-slate-400';
  if (ratio <= 0.8) return 'bg-emerald-200 text-emerald-900';
  if (ratio <= 1.0) return 'bg-amber-200 text-amber-900';
  return 'bg-red-300 text-red-900';
}

export function formatUtilization(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
