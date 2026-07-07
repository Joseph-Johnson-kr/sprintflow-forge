import type {
  Epic,
  EpicSchedule,
  Quarter,
  QuarterForecast,
  SprintMetrics,
} from '../types/quarter';
import { TSHIRT_SPRINT_DURATIONS } from '../types/quarter';

const DEFAULT_SPRINT_LENGTH_DAYS = 10;

export function computeSprintCapacityDevDays(
  quarter: Quarter,
  sprintLengthDays = DEFAULT_SPRINT_LENGTH_DAYS,
): number[] {
  return Array.from({ length: quarter.sprintCount }, (_, i) => {
    const sprintNumber = i + 1;
    return quarter.members.reduce((total, member) => {
      const absence = member.absences.find((a) => a.sprintNumber === sprintNumber);
      const daysOut = absence?.days ?? 0;
      return total + Math.max(0, sprintLengthDays - daysOut);
    }, 0);
  });
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

export function buildQuarterForecast(
  quarter: Quarter,
  sprintLengthDays = DEFAULT_SPRINT_LENGTH_DAYS,
): QuarterForecast {
  const totalCapacity = computeSprintCapacityDevDays(quarter, sprintLengthDays);
  const remainingCapacity = [...totalCapacity];
  const usedCapacity = Array<number>(quarter.sprintCount).fill(0);

  const sorted = topologicalSort(quarter.epics);
  const rawSchedules = new Map<string, EpicSchedule>();
  const epicEndSprint: Record<string, number> = {};

  for (const epic of sorted) {
    const durationSprints = Math.ceil(TSHIRT_SPRINT_DURATIONS[epic.size]);
    const devDaysPerSprint =
      epic.size === 'XS'
        ? epic.devAllocation * (sprintLengthDays / 2)
        : epic.devAllocation * sprintLengthDays;

    const minStart = epic.dependencies.reduce((max, depId) => {
      const end = epicEndSprint[depId];
      return end !== undefined ? Math.max(max, end + 1) : max;
    }, 1);

    let startSprint = minStart;
    let found = false;

    while (startSprint + durationSprints - 1 <= quarter.sprintCount) {
      const endSprint = startSprint + durationSprints - 1;
      let fits = true;
      for (let s = startSprint; s <= endSprint; s++) {
        if (remainingCapacity[s - 1] < devDaysPerSprint) {
          fits = false;
          break;
        }
      }
      if (fits) {
        found = true;
        break;
      }
      startSprint++;
    }

    if (found) {
      const endSprint = startSprint + durationSprints - 1;
      for (let s = startSprint; s <= endSprint; s++) {
        remainingCapacity[s - 1] -= devDaysPerSprint;
        usedCapacity[s - 1] += devDaysPerSprint;
      }
      rawSchedules.set(epic.id, { epic, startSprint, endSprint, fits: true });
      epicEndSprint[epic.id] = endSprint;
    } else {
      rawSchedules.set(epic.id, { epic, startSprint: -1, endSprint: -1, fits: false });
    }
  }

  // Restore user-defined ordering
  const schedules = quarter.epics.map((e) => rawSchedules.get(e.id)!);

  const sprintMetrics: SprintMetrics[] = Array.from(
    { length: quarter.sprintCount },
    (_, i) => ({
      sprintNumber: i + 1,
      totalCapacityDevDays: totalCapacity[i],
      usedCapacityDevDays: usedCapacity[i],
      utilizationRatio:
        totalCapacity[i] > 0 ? usedCapacity[i] / totalCapacity[i] : 0,
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
