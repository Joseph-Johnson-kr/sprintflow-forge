import type { DayMetrics, FlowGridData, Team } from '../types';

export function computeDayMetrics(grid: FlowGridData, team: Team): DayMetrics[] {
  return grid.days.map((day) => {
    const idx = day - 1;
    let devDemand = 0;
    let qaDemand = 0;
    for (const row of grid.rows) {
      const status = row.cells[idx];
      if (status === 'dev') devDemand += 1;
      else if (status === 'qa') qaDemand += 1;
    }
    const override = team.capacityOverrides[day] ?? {};
    const devCapacity = override.devs ?? team.defaultCapacity.devs;
    // When devsAreQAs, QA load is measured against dev capacity (devs cover both roles)
    const qaCapacity = team.devsAreQAs
      ? devCapacity
      : (override.qa ?? team.defaultCapacity.qa);
    const devLoad = devCapacity > 0 ? devDemand / devCapacity : devDemand > 0 ? Infinity : 0;
    // When devsAreQAs, QA load reflects total demand (dev + QA) against dev capacity,
    // since dev work consumes capacity that is no longer available for QA.
    const qaLoad = team.devsAreQAs
      ? (() => {
          const total = devDemand + qaDemand;
          return devCapacity > 0 ? total / devCapacity : total > 0 ? Infinity : 0;
        })()
      : qaCapacity > 0
        ? qaDemand / qaCapacity
        : qaDemand > 0
          ? Infinity
          : 0;
    return { day, devDemand, qaDemand, devCapacity, qaCapacity, devLoad, qaLoad };
  });
}

export function loadColor(load: number): string {
  if (!isFinite(load)) return 'bg-red-600 text-white';
  if (load === 0) return 'bg-slate-100 text-slate-400';
  if (load <= 1.0) return 'bg-emerald-200 text-emerald-900';
  if (load <= 1.25) return 'bg-amber-200 text-amber-900';
  return 'bg-red-300 text-red-900';
}

export function formatLoad(load: number): string {
  if (!isFinite(load)) return '∞';
  return load.toFixed(2);
}
