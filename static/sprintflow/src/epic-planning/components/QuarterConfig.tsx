import { useEffect, useState } from 'react';
import type { PlanningVersionOption, Quarter } from '../types/quarter';
import { QUARTER_NAME_OPTIONS } from '../types/quarter';
import { useQuarterStore } from '../stores/quarterStore';

interface Props {
  teamId: string;
  quarters: Quarter[];
  selected: Quarter | null;
  quarterOptions: PlanningVersionOption[];
  isAllView: boolean;
  onAllViewChange: (v: boolean) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];
const ALL_VALUE = '__all__';

function currentCalendarQuarter(): string {
  const month = new Date().getMonth();
  if (month < 3) return 'Q1';
  if (month < 6) return 'Q2';
  if (month < 9) return 'Q3';
  return 'Q4';
}

export default function QuarterConfig({
  teamId,
  quarters,
  selected,
  quarterOptions,
  isAllView,
  onAllViewChange,
}: Props) {
  const selectQuarterOption = useQuarterStore((s) => s.selectQuarterOption);
  const resetQuarter = useQuarterStore((s) => s.resetQuarter);
  const setSprintCount = useQuarterStore((s) => s.setSprintCount);

  const [selectedYear, setSelectedYear] = useState(
    () => selected?.year ?? quarters[0]?.year ?? CURRENT_YEAR,
  );

  const optionsForYear = quarterOptions
    .filter((o) => o.year === selectedYear)
    .sort((a, b) => QUARTER_NAME_OPTIONS.indexOf(a.quarter) - QUARTER_NAME_OPTIONS.indexOf(b.quarter));

  useEffect(() => {
    if (optionsForYear.length === 0) return;
    if (selected && selected.year === selectedYear) return;
    const thisQuarter = currentCalendarQuarter();
    const preferred =
      optionsForYear.find((o) => o.quarter === thisQuarter) ?? optionsForYear[0];
    selectQuarterOption(teamId, preferred.year, preferred.quarter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, selectedYear, optionsForYear, selected]);

  function handleReset() {
    if (!selected) return;
    if (
      window.confirm(
        `Reset ${selected.name} ${selected.year}? This clears its Epics, sprint count, and member absences. This cannot be undone.`,
      )
    ) {
      resetQuarter(teamId, selected.id);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={selectedYear}
        onChange={(e) => setSelectedYear(Number(e.target.value))}
        className="text-sm border border-slate-300 rounded px-2 py-1.5 bg-white"
      >
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {optionsForYear.length > 0 ? (
        <select
          value={
            isAllView
              ? ALL_VALUE
              : selected && selected.year === selectedYear
              ? `${selected.year}${selected.name}`
              : ''
          }
          onChange={(e) => {
            const value = e.target.value;
            if (value === ALL_VALUE) {
              onAllViewChange(true);
            } else {
              const option = optionsForYear.find((o) => o.value === value);
              if (option) {
                onAllViewChange(false);
                selectQuarterOption(teamId, option.year, option.quarter);
              }
            }
          }}
          className="text-sm border border-slate-300 rounded px-2 py-1.5 bg-white"
        >
          {optionsForYear.map((o) => (
            <option key={o.value} value={o.value}>
              {o.quarter}
            </option>
          ))}
          <option value={ALL_VALUE}>All</option>
        </select>
      ) : (
        <span className="text-sm text-slate-400 italic">
          No Planning Versions found in Jira for {selectedYear}
        </span>
      )}

      {!isAllView && selected && (
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">Sprints:</label>
          <input
            type="number"
            min={1}
            max={20}
            value={selected.sprintCount}
            onChange={(e) => setSprintCount(teamId, selected.id, Number(e.target.value))}
            className="w-16 text-sm border border-slate-300 rounded px-2 py-1.5 text-center"
          />
          <span className="text-xs text-slate-400">
            (Q1 default: 8 · Q2–Q4 default: 6)
          </span>
        </div>
      )}

      {!isAllView && selected && (
        <button
          onClick={handleReset}
          className="text-sm px-2 py-1.5 rounded hover:bg-red-50 text-red-600 border border-red-200"
        >
          Reset Quarter
        </button>
      )}
    </div>
  );
}
