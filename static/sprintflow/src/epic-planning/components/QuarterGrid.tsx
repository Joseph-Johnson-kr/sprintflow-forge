import { useState } from 'react';
import type { Quarter, TeamMember } from '../types/quarter';
import { TSHIRT_SPRINT_DURATIONS } from '../types/quarter';
import {
  buildQuarterForecast,
  formatUtilization,
  utilizationColor,
} from '../engine/quarterEngine';

interface Props {
  quarter: Quarter;
}

type GridView = 'epics' | 'members' | 'both';

const SIZE_COLORS: Record<string, string> = {
  XS: 'bg-violet-200 text-violet-900',
  S: 'bg-sky-200 text-sky-900',
  M: 'bg-indigo-200 text-indigo-900',
  L: 'bg-blue-300 text-blue-900',
  XL: 'bg-blue-500 text-white',
  Jumbo: 'bg-slate-700 text-white',
};

function memberAbsenceDays(member: TeamMember, sprintNumber: number): number {
  return member.absences.find((a) => a.sprintNumber === sprintNumber)?.days ?? 0;
}

function memberAvailabilityCell(days: number): { cls: string; label: string } {
  if (days === 0) return { cls: 'bg-slate-50 text-slate-300', label: '—' };
  if (days >= 10) return { cls: 'bg-red-200 text-red-900', label: 'OUT' };
  return { cls: 'bg-amber-100 text-amber-800', label: `${days}d` };
}

const VIEW_LABELS: Record<GridView, string> = {
  epics: 'Epics',
  members: 'Members',
  both: 'Both',
};

export default function QuarterGrid({ quarter }: Props) {
  const [gridView, setGridView] = useState<GridView>('epics');

  const forecast = buildQuarterForecast(quarter);
  const { schedules, sprintMetrics, overflowEpics } = forecast;
  const sprints = Array.from({ length: quarter.sprintCount }, (_, i) => i + 1);

  const showEpics = gridView === 'epics' || gridView === 'both';
  const showMembers = gridView === 'members' || gridView === 'both';

  const colSpanFull = 3 + quarter.sprintCount;

  return (
    <div>
      {/* View toggle */}
      <div className="flex justify-end mb-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
          {(Object.keys(VIEW_LABELS) as GridView[]).map((v, i) => (
            <button
              key={v}
              onClick={() => setGridView(v)}
              className={`px-3 py-1.5 transition-colors ${
                i > 0 ? 'border-l border-slate-200' : ''
              } ${
                gridView === v
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-slate-500 py-2 pr-4 min-w-[220px]">
                {gridView === 'members' ? 'Member' : 'Epic'}
              </th>
              <th className="text-left text-xs font-semibold text-slate-500 py-2 pr-3 w-16">
                {gridView === 'members' ? 'Avail' : 'Size'}
              </th>
              <th className="text-left text-xs font-semibold text-slate-500 py-2 pr-3 w-12">
                Devs
              </th>
              {sprints.map((s) => (
                <th
                  key={s}
                  className="text-center text-xs font-semibold text-slate-500 py-2 px-1 min-w-[56px]"
                >
                  S{s}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* ── Epic rows ────────────────────────────────────────── */}
            {showEpics && quarter.epics.length === 0 && (
              <tr>
                <td
                  colSpan={colSpanFull}
                  className="py-6 text-sm text-slate-400 italic text-center"
                >
                  No Epics added yet — add them in the Epics section above.
                </td>
              </tr>
            )}

            {showEpics &&
              schedules.map(({ epic, startSprint, endSprint, fits }) => {
                const durationSprints = Math.ceil(TSHIRT_SPRINT_DURATIONS[epic.size]);
                return (
                  <tr
                    key={epic.id}
                    className={`border-t border-slate-100 ${!fits ? 'bg-red-50' : ''}`}
                  >
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1.5">
                        {!fits && (
                          <span
                            className="text-[10px] font-bold text-red-600 bg-red-100 border border-red-200 rounded px-1"
                            title="Doesn't fit in this quarter"
                          >
                            OVERFLOW
                          </span>
                        )}
                        <span className={`truncate max-w-[180px] ${!fits ? 'text-red-700' : ''}`}>
                          {epic.title}
                        </span>
                        {epic.risks.some((r) => r.level === 'high') && (
                          <span className="text-[10px] text-red-500 font-bold" title="High risk">
                            !
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 pr-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${SIZE_COLORS[epic.size]}`}>
                        {epic.size}
                      </span>
                    </td>

                    <td className="py-2 pr-3 text-center text-xs text-slate-600">
                      {epic.devAllocation}
                    </td>

                    {sprints.map((s) => {
                      const isActive = fits && s >= startSprint && s <= endSprint;
                      const isXsPartial = epic.size === 'XS' && isActive;
                      let cellClass = 'bg-slate-50 text-slate-300';
                      let cellContent: React.ReactNode = null;

                      if (!fits) {
                        cellClass = 'bg-red-50';
                      } else if (isActive) {
                        cellClass = SIZE_COLORS[epic.size];
                        const isFirst = s === startSprint;
                        const isLast = s === endSprint;
                        cellContent = isFirst ? (
                          <span className="text-[10px] font-bold">
                            {isXsPartial ? '½' : epic.size}
                            {durationSprints > 1 && !isLast ? ' ›' : ''}
                          </span>
                        ) : isLast ? (
                          <span className="text-[10px]">‹ end</span>
                        ) : (
                          <span className="text-[10px] opacity-60">···</span>
                        );
                      }

                      return (
                        <td key={s} className="px-1 py-2">
                          <div className={`h-8 rounded flex items-center justify-center ${cellClass}`}>
                            {cellContent}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

            {/* ── Section separator (Both view only) ───────────────── */}
            {gridView === 'both' && (
              <tr className="border-t-2 border-slate-200">
                <td
                  colSpan={colSpanFull}
                  className="py-1 px-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50"
                >
                  &nbsp;&nbsp;Team Availability
                </td>
              </tr>
            )}

            {/* ── Member rows ───────────────────────────────────────── */}
            {showMembers && quarter.members.length === 0 && (
              <tr>
                <td
                  colSpan={colSpanFull}
                  className="py-6 text-sm text-slate-400 italic text-center border-t border-slate-100"
                >
                  No team members added yet — add them in the Team Capacity section above.
                </td>
              </tr>
            )}

            {showMembers &&
              quarter.members.map((member) => {
                const totalAvail = sprints.reduce(
                  (sum, s) => sum + Math.max(0, 10 - memberAbsenceDays(member, s)),
                  0,
                );
                return (
                  <tr key={member.id} className="border-t border-slate-100">
                    {/* Name */}
                    <td className="py-2 pr-4 text-sm text-slate-700 font-medium">
                      {member.name}
                    </td>

                    {/* Total available days — occupies the Size column */}
                    <td className="py-2 pr-3">
                      <span className="text-xs text-slate-500 font-medium">{totalAvail}d</span>
                    </td>

                    {/* Devs column — blank for members */}
                    <td className="py-2 pr-3" />

                    {/* Per-sprint availability cells */}
                    {sprints.map((s) => {
                      const days = memberAbsenceDays(member, s);
                      const { cls, label } = memberAvailabilityCell(days);
                      return (
                        <td key={s} className="px-1 py-2">
                          <div
                            className={`h-8 rounded flex items-center justify-center text-xs font-medium ${cls}`}
                            title={
                              days === 0
                                ? `${member.name} fully available in Sprint ${s}`
                                : days >= 10
                                ? `${member.name} fully absent in Sprint ${s}`
                                : `${member.name} absent ${days} day${days > 1 ? 's' : ''} in Sprint ${s}`
                            }
                          >
                            {label}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

            {/* ── Capacity metric rows ──────────────────────────────── */}
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td colSpan={3} className="py-1.5 pr-4 text-xs font-semibold text-slate-500">
                Avail Dev-Days / Sprint
              </td>
              {sprintMetrics.map((m) => (
                <td key={m.sprintNumber} className="px-1 py-1.5 text-center text-xs text-slate-600">
                  {m.totalCapacityDevDays > 0 ? `${m.totalCapacityDevDays}d` : '—'}
                </td>
              ))}
            </tr>

            <tr className="bg-slate-50">
              <td colSpan={3} className="py-1.5 pr-4 text-xs font-semibold text-slate-500">
                Used Dev-Days / Sprint
              </td>
              {sprintMetrics.map((m) => (
                <td key={m.sprintNumber} className="px-1 py-1.5 text-center text-xs text-slate-600">
                  {m.usedCapacityDevDays > 0 ? `${m.usedCapacityDevDays}d` : '—'}
                </td>
              ))}
            </tr>

            <tr className="bg-slate-50">
              <td colSpan={3} className="py-1.5 pr-4 text-xs font-semibold text-slate-500">
                Utilization
              </td>
              {sprintMetrics.map((m) => (
                <td key={m.sprintNumber} className="px-1 py-1.5">
                  {m.totalCapacityDevDays > 0 ? (
                    <div
                      className={`h-6 rounded flex items-center justify-center text-xs font-medium ${utilizationColor(m.utilizationRatio)}`}
                    >
                      {formatUtilization(m.utilizationRatio)}
                    </div>
                  ) : (
                    <div className="h-6 flex items-center justify-center text-xs text-slate-300">
                      —
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Overflow / fit banners — only relevant when Epics are visible */}
      {showEpics && overflowEpics.length > 0 && (
        <div className="mt-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
          <span className="font-semibold">
            {overflowEpics.length} Epic{overflowEpics.length > 1 ? 's' : ''}{' '}
            {overflowEpics.length > 1 ? "don't" : "doesn't"} fit in{' '}
            {quarter.name} {quarter.year}:
          </span>{' '}
          {overflowEpics.map((e) => e.title).join(', ')}. Consider reducing scope, increasing
          team capacity, or deferring to next quarter.
        </div>
      )}

      {showEpics && overflowEpics.length === 0 && quarter.epics.length > 0 && (
        <div className="mt-4 p-3 rounded border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          All {quarter.epics.length} Epic{quarter.epics.length > 1 ? 's' : ''} fit within{' '}
          {quarter.name} {quarter.year} capacity.
        </div>
      )}
    </div>
  );
}
