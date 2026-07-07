import { useState } from 'react';
import type { Epic, EpicSchedule, Quarter, TeamMember } from '../types/quarter';
import { QUARTER_NAME_OPTIONS, TSHIRT_SPRINT_DURATIONS } from '../types/quarter';
import { buildQuarterForecast, formatUtilization, utilizationColor } from '../engine/quarterEngine';

interface Props {
  quarters: Quarter[];
}

type GridView = 'epics' | 'members' | 'both';

const SIZE_COLORS: Record<string, string> = {
  XS: 'bg-violet-200 text-violet-900',
  S: 'bg-sky-200 text-sky-900',
  M: 'bg-indigo-200 text-indigo-900',
  L: 'bg-blue-300 text-blue-900',
  XL: 'bg-blue-500 text-white',
};

const VIEW_LABELS: Record<GridView, string> = {
  epics: 'Epics',
  members: 'Members',
  both: 'Both',
};

function memberAbsenceDays(member: TeamMember, sprintNumber: number): number {
  return member.absences.find((a) => a.sprintNumber === sprintNumber)?.days ?? 0;
}

function memberAvailabilityCell(days: number): { cls: string; label: string } {
  if (days === 0) return { cls: 'bg-slate-50 text-slate-300', label: '—' };
  if (days >= 10) return { cls: 'bg-red-200 text-red-900', label: 'OUT' };
  return { cls: 'bg-amber-100 text-amber-800', label: `${days}d` };
}

interface QuarterBlock {
  quarter: Quarter;
  sprints: number[];
  schedulesByEpicId: Map<string, EpicSchedule>;
  sprintMetrics: ReturnType<typeof buildQuarterForecast>['sprintMetrics'];
  overflowEpics: Epic[];
}

interface EpicRow {
  key: string;
  title: string;
  perQuarter: Map<string, { epic: Epic; schedule: EpicSchedule }>;
}

interface MemberRow {
  key: string;
  name: string;
  perQuarter: Map<string, TeamMember>;
}

export default function AllQuartersView({ quarters }: Props) {
  const [gridView, setGridView] = useState<GridView>('epics');

  const sorted = [...quarters].sort(
    (a, b) => QUARTER_NAME_OPTIONS.indexOf(a.name) - QUARTER_NAME_OPTIONS.indexOf(b.name),
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-slate-400 italic py-4">No quarters to display.</p>;
  }

  const blocks: QuarterBlock[] = sorted.map((quarter) => {
    const forecast = buildQuarterForecast(quarter);
    return {
      quarter,
      sprints: Array.from({ length: quarter.sprintCount }, (_, i) => i + 1),
      schedulesByEpicId: new Map(forecast.schedules.map((s) => [s.epic.id, s])),
      sprintMetrics: forecast.sprintMetrics,
      overflowEpics: forecast.overflowEpics,
    };
  });

  const epicRows: EpicRow[] = [];
  const epicRowByKey = new Map<string, EpicRow>();
  for (const block of blocks) {
    for (const epic of block.quarter.epics) {
      const schedule = block.schedulesByEpicId.get(epic.id)!;
      const key = epic.issueKey ? `key:${epic.issueKey}` : `q:${block.quarter.id}:${epic.id}`;
      let row = epicRowByKey.get(key);
      if (!row) {
        row = { key, title: epic.title, perQuarter: new Map() };
        epicRowByKey.set(key, row);
        epicRows.push(row);
      }
      row.perQuarter.set(block.quarter.id, { epic, schedule });
    }
  }

  const memberRows: MemberRow[] = [];
  const memberRowByKey = new Map<string, MemberRow>();
  for (const block of blocks) {
    for (const member of block.quarter.members) {
      let row = memberRowByKey.get(member.id);
      if (!row) {
        row = { key: member.id, name: member.name, perQuarter: new Map() };
        memberRowByKey.set(member.id, row);
        memberRows.push(row);
      }
      row.perQuarter.set(block.quarter.id, member);
    }
  }

  const overflowEntries = blocks.flatMap((block) =>
    block.overflowEpics.map((epic) => ({ epic, quarter: block.quarter })),
  );

  const showEpics = gridView === 'epics' || gridView === 'both';
  const showMembers = gridView === 'members' || gridView === 'both';

  const totalSprintCols = blocks.reduce((sum, b) => sum + b.sprints.length, 0);
  const colSpanFull = 1 + totalSprintCols;

  return (
    <div>
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
              <th className="text-left text-xs font-semibold text-slate-500 py-2 pr-4 min-w-[220px] align-bottom" rowSpan={2}>
                {gridView === 'members' ? 'Member' : 'Epic'}
              </th>
              {blocks.map((block, i) => (
                <th
                  key={block.quarter.id}
                  colSpan={block.sprints.length}
                  className={`text-center text-xs font-semibold text-slate-600 py-2 px-1 bg-slate-50 ${
                    i > 0 ? 'border-l-2 border-slate-300' : ''
                  }`}
                >
                  {block.quarter.name} {block.quarter.year} · {block.sprints.length} sprint
                  {block.sprints.length !== 1 ? 's' : ''}
                </th>
              ))}
            </tr>
            <tr>
              {blocks.map((block) =>
                block.sprints.map((s, si) => (
                  <th
                    key={`${block.quarter.id}-${s}`}
                    className={`text-center text-xs font-semibold text-slate-500 py-2 px-1 min-w-[56px] ${
                      si === 0 ? 'border-l-2 border-slate-300' : ''
                    }`}
                  >
                    S{s}
                  </th>
                )),
              )}
            </tr>
          </thead>

          <tbody>
            {/* ── Epic rows ────────────────────────────────────────── */}
            {showEpics && epicRows.length === 0 && (
              <tr>
                <td colSpan={colSpanFull} className="py-6 text-sm text-slate-400 italic text-center">
                  No Epics added yet across these quarters.
                </td>
              </tr>
            )}

            {showEpics &&
              epicRows.map((row) => {
                const hasHighRisk = Array.from(row.perQuarter.values()).some(({ epic }) =>
                  epic.risks.some((r) => r.level === 'high'),
                );
                return (
                  <tr key={row.key} className="border-t border-slate-100">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[180px]">{row.title}</span>
                        {hasHighRisk && (
                          <span className="text-[10px] text-red-500 font-bold" title="High risk">
                            !
                          </span>
                        )}
                      </div>
                    </td>
                    {blocks.map((block) =>
                      block.sprints.map((s, si) => {
                        const entry = row.perQuarter.get(block.quarter.id);
                        const borderCls = si === 0 ? 'border-l-2 border-slate-300' : '';
                        const cellKey = `${block.quarter.id}-${s}`;

                        if (!entry) {
                          return (
                            <td key={cellKey} className={`px-1 py-2 ${borderCls}`}>
                              <div className="h-8 rounded bg-slate-50" />
                            </td>
                          );
                        }

                        const { epic, schedule } = entry;
                        const { startSprint, endSprint, fits } = schedule;
                        const durationSprints = Math.ceil(TSHIRT_SPRINT_DURATIONS[epic.size]);
                        const isActive = fits && s >= startSprint && s <= endSprint;
                        const isXsPartial = epic.size === 'XS' && isActive;
                        const isFirstOfBlock = s === block.sprints[0];

                        let cellClass = 'bg-slate-50 text-slate-300';
                        let cellContent: React.ReactNode = null;

                        if (!fits) {
                          cellClass = 'bg-red-50';
                          if (isFirstOfBlock) {
                            cellContent = (
                              <span
                                className="text-[9px] font-bold text-red-600"
                                title="Doesn't fit in this quarter"
                              >
                                OVF
                              </span>
                            );
                          }
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
                          <td key={cellKey} className={`px-1 py-2 ${borderCls}`}>
                            <div
                              className={`h-8 rounded flex items-center justify-center ${cellClass}`}
                              title={`${epic.title} — ${block.quarter.name} ${block.quarter.year}`}
                            >
                              {cellContent}
                            </div>
                          </td>
                        );
                      }),
                    )}
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
            {showMembers && memberRows.length === 0 && (
              <tr>
                <td
                  colSpan={colSpanFull}
                  className="py-6 text-sm text-slate-400 italic text-center border-t border-slate-100"
                >
                  No team members added yet across these quarters.
                </td>
              </tr>
            )}

            {showMembers &&
              memberRows.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="py-2 pr-4 text-sm text-slate-700 font-medium">{row.name}</td>
                  {blocks.map((block) =>
                    block.sprints.map((s, si) => {
                      const member = row.perQuarter.get(block.quarter.id);
                      const borderCls = si === 0 ? 'border-l-2 border-slate-300' : '';
                      const cellKey = `${block.quarter.id}-${s}`;

                      if (!member) {
                        return (
                          <td key={cellKey} className={`px-1 py-2 ${borderCls}`}>
                            <div className="h-8 rounded bg-slate-50" />
                          </td>
                        );
                      }

                      const days = memberAbsenceDays(member, s);
                      const { cls, label } = memberAvailabilityCell(days);
                      return (
                        <td key={cellKey} className={`px-1 py-2 ${borderCls}`}>
                          <div
                            className={`h-8 rounded flex items-center justify-center text-xs font-medium ${cls}`}
                            title={
                              days === 0
                                ? `${member.name} fully available in ${block.quarter.name} ${block.quarter.year} Sprint ${s}`
                                : days >= 10
                                ? `${member.name} fully absent in ${block.quarter.name} ${block.quarter.year} Sprint ${s}`
                                : `${member.name} absent ${days} day${days > 1 ? 's' : ''} in ${block.quarter.name} ${block.quarter.year} Sprint ${s}`
                            }
                          >
                            {label}
                          </div>
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}

            {/* ── Capacity metric rows ──────────────────────────────── */}
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td className="py-1.5 pr-4 text-xs font-semibold text-slate-500">
                Avail Dev-Days / Sprint
              </td>
              {blocks.map((block) =>
                block.sprintMetrics.map((m, si) => (
                  <td
                    key={`${block.quarter.id}-${m.sprintNumber}`}
                    className={`px-1 py-1.5 text-center text-xs text-slate-600 ${
                      si === 0 ? 'border-l-2 border-slate-300' : ''
                    }`}
                  >
                    {m.totalCapacityDevDays > 0 ? `${m.totalCapacityDevDays}d` : '—'}
                  </td>
                )),
              )}
            </tr>

            <tr className="bg-slate-50">
              <td className="py-1.5 pr-4 text-xs font-semibold text-slate-500">
                Used Dev-Days / Sprint
              </td>
              {blocks.map((block) =>
                block.sprintMetrics.map((m, si) => (
                  <td
                    key={`${block.quarter.id}-${m.sprintNumber}`}
                    className={`px-1 py-1.5 text-center text-xs text-slate-600 ${
                      si === 0 ? 'border-l-2 border-slate-300' : ''
                    }`}
                  >
                    {m.usedCapacityDevDays > 0 ? `${m.usedCapacityDevDays}d` : '—'}
                  </td>
                )),
              )}
            </tr>

            <tr className="bg-slate-50">
              <td className="py-1.5 pr-4 text-xs font-semibold text-slate-500">Utilization</td>
              {blocks.map((block) =>
                block.sprintMetrics.map((m, si) => (
                  <td
                    key={`${block.quarter.id}-${m.sprintNumber}`}
                    className={`px-1 py-1.5 ${si === 0 ? 'border-l-2 border-slate-300' : ''}`}
                  >
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
                )),
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Overflow / fit banners — only relevant when Epics are visible */}
      {showEpics && overflowEntries.length > 0 && (
        <div className="mt-4 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800">
          <span className="font-semibold">
            {overflowEntries.length} Epic{overflowEntries.length > 1 ? 's' : ''}{' '}
            {overflowEntries.length > 1 ? "don't" : "doesn't"} fit:
          </span>{' '}
          {overflowEntries
            .map(({ epic, quarter }) => `${epic.title} (${quarter.name} ${quarter.year})`)
            .join(', ')}
          . Consider reducing scope, increasing team capacity, or deferring to next quarter.
        </div>
      )}

      {showEpics && overflowEntries.length === 0 && epicRows.length > 0 && (
        <div className="mt-4 p-3 rounded border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          All {epicRows.length} Epic{epicRows.length > 1 ? 's' : ''} fit within their quarters'
          capacity.
        </div>
      )}
    </div>
  );
}
