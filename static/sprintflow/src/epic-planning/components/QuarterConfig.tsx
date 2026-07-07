import { useEffect, useState } from 'react';
import type { Quarter } from '../types/quarter';
import { QUARTER_NAME_OPTIONS } from '../types/quarter';
import { useQuarterStore } from '../stores/quarterStore';

interface Props {
  teamId: string;
  quarters: Quarter[];
  selected: Quarter | null;
  isAllView: boolean;
  onAllViewChange: (v: boolean) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];
const ALL_VALUE = '__all__';

export default function QuarterConfig({
  teamId,
  quarters,
  selected,
  isAllView,
  onAllViewChange,
}: Props) {
  const selectYear = useQuarterStore((s) => s.selectYear);
  const selectQuarter = useQuarterStore((s) => s.selectQuarter);
  const resetQuarter = useQuarterStore((s) => s.resetQuarter);
  const setSprintCount = useQuarterStore((s) => s.setSprintCount);

  const [selectedYear, setSelectedYear] = useState(
    () => selected?.year ?? quarters[0]?.year ?? CURRENT_YEAR,
  );

  useEffect(() => {
    const quartersForYear = quarters.filter((q) => q.year === selectedYear);
    if (quartersForYear.length < QUARTER_NAME_OPTIONS.length) {
      selectYear(teamId, selectedYear);
      return;
    }
    if (!selected || selected.year !== selectedYear) {
      const preferredName = selected?.name;
      const next =
        quartersForYear.find((q) => q.name === preferredName) ?? quartersForYear[0];
      if (next) selectQuarter(next.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, selectedYear, quarters, selected]);

  const quartersForYear = quarters
    .filter((q) => q.year === selectedYear)
    .sort(
      (a, b) => QUARTER_NAME_OPTIONS.indexOf(a.name) - QUARTER_NAME_OPTIONS.indexOf(b.name),
    );

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

      {quartersForYear.length > 0 && (
        <select
          value={isAllView ? ALL_VALUE : (selected?.id ?? '')}
          onChange={(e) => {
            const value = e.target.value;
            if (value === ALL_VALUE) {
              onAllViewChange(true);
            } else {
              onAllViewChange(false);
              selectQuarter(value);
            }
          }}
          className="text-sm border border-slate-300 rounded px-2 py-1.5 bg-white"
        >
          {quartersForYear.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
          <option value={ALL_VALUE}>All</option>
        </select>
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
