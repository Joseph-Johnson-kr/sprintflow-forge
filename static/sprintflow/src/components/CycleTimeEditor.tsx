import { useState } from 'react';
import type { Team } from '../types';
import { useTeamStore } from '../stores/teamStore';

interface Props {
  team: Team;
}

export default function CycleTimeEditor({ team }: Props) {
  const setCycleTime = useTeamStore((s) => s.setCycleTime);
  const removeCycleTime = useTeamStore((s) => s.removeCycleTime);
  const [newSp, setNewSp] = useState('');

  const sortedKeys = Object.keys(team.cycleTimes)
    .map(Number)
    .sort((a, b) => a - b);

  function addRow() {
    const sp = Number(newSp);
    if (!sp || sp <= 0 || team.cycleTimes[sp]) return;
    setCycleTime(team.id, sp, { dev: 1, qa: 1 });
    setNewSp('');
  }

  return (
    <div className="border border-slate-200 rounded bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Story Points</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Dev days</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">QA days</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Total</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sortedKeys.map((sp) => {
            const ct = team.cycleTimes[sp];
            return (
              <tr key={sp} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium">{sp}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    value={ct.dev}
                    onChange={(e) =>
                      setCycleTime(team.id, sp, { ...ct, dev: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-20 px-2 py-1 border border-slate-300 rounded"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    value={ct.qa}
                    onChange={(e) =>
                      setCycleTime(team.id, sp, { ...ct, qa: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-20 px-2 py-1 border border-slate-300 rounded"
                  />
                </td>
                <td className="px-3 py-2 text-slate-500">{ct.dev + ct.qa}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => removeCycleTime(team.id, sp)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="bg-slate-50">
            <td className="px-3 py-2">
              <input
                type="number"
                min={1}
                placeholder="SP"
                value={newSp}
                onChange={(e) => setNewSp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRow()}
                className="w-20 px-2 py-1 border border-slate-300 rounded"
              />
            </td>
            <td colSpan={3} className="px-3 py-2 text-xs text-slate-500">
              Add a story-point bucket
            </td>
            <td className="px-3 py-2 text-right">
              <button
                onClick={addRow}
                className="text-xs px-2 py-1 rounded bg-slate-900 text-white hover:bg-slate-700"
              >
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
