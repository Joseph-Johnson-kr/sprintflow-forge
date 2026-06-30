import { useState } from 'react';
import type { Quarter, QuarterName } from '../types/quarter';
import { QUARTER_DEFAULT_SPRINTS, QUARTER_NAME_OPTIONS } from '../types/quarter';
import { useQuarterStore } from '../stores/quarterStore';

interface Props {
  teamId: string;
  quarters: Quarter[];
  selected: Quarter | null;
}

export default function QuarterConfig({ teamId, quarters, selected }: Props) {
  const addQuarter = useQuarterStore((s) => s.addQuarter);
  const removeQuarter = useQuarterStore((s) => s.removeQuarter);
  const selectQuarter = useQuarterStore((s) => s.selectQuarter);
  const setSprintCount = useQuarterStore((s) => s.setSprintCount);

  const [addingName, setAddingName] = useState<QuarterName>('Q3');
  const [addingYear, setAddingYear] = useState<number>(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState(false);

  function handleAdd() {
    addQuarter(teamId, addingName, addingYear);
    setShowAdd(false);
  }

  function handleDelete() {
    if (!selected) return;
    if (window.confirm(`Delete ${selected.name} ${selected.year}? This cannot be undone.`)) {
      removeQuarter(teamId, selected.id);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {quarters.length > 0 && (
        <select
          value={selected?.id ?? ''}
          onChange={(e) => selectQuarter(e.target.value)}
          className="text-sm border border-slate-300 rounded px-2 py-1.5 bg-white"
        >
          {quarters.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name} {q.year}
            </option>
          ))}
        </select>
      )}

      {selected && (
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

      {showAdd ? (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-3 py-2">
          <select
            value={addingName}
            onChange={(e) => setAddingName(e.target.value as QuarterName)}
            className="text-sm border border-slate-300 rounded px-2 py-1"
          >
            {QUARTER_NAME_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} (default {QUARTER_DEFAULT_SPRINTS[n]} sprints)
              </option>
            ))}
          </select>
          <input
            type="number"
            value={addingYear}
            onChange={(e) => setAddingYear(Number(e.target.value))}
            className="w-20 text-sm border border-slate-300 rounded px-2 py-1 text-center"
            placeholder="Year"
          />
          <button
            onClick={handleAdd}
            className="text-sm px-3 py-1 rounded bg-slate-900 text-white hover:bg-slate-700"
          >
            Add
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="text-sm px-2 py-1 rounded hover:bg-slate-200 text-slate-600"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-700"
        >
          + Add Quarter
        </button>
      )}

      {selected && (
        <button
          onClick={handleDelete}
          className="text-sm px-2 py-1.5 rounded hover:bg-red-50 text-red-600 border border-red-200"
        >
          Delete Quarter
        </button>
      )}
    </div>
  );
}
