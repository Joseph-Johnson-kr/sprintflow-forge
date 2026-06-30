import { useState } from 'react';
import type { Team } from '../types';
import CsvUpload from './CsvUpload';
import BacklogTable from './BacklogTable';
import FlowGrid from './FlowGrid';

interface Props {
  team: Team;
}

export default function SprintView({ team }: Props) {
  const [backlogOpen, setBacklogOpen] = useState(true);

  const missingCycleTimes = team.backlog.filter(
    (s) => !team.cycleTimes[s.storyPoints],
  );
  const hasZeroCapacity =
    team.defaultCapacity.devs === 0 && team.defaultCapacity.qa === 0;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{team.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {team.backlog.length} stor{team.backlog.length === 1 ? 'y' : 'ies'} ·{' '}
          {team.sprintLength}-day sprint · {team.defaultCapacity.devs} dev /{' '}
          {team.defaultCapacity.qa} QA default
        </p>
      </header>

      {hasZeroCapacity && (
        <div className="p-3 rounded border border-amber-300 bg-amber-50 text-sm text-amber-900">
          Default capacity is 0 for both Dev and QA. Set capacity in Config to see meaningful
          load ratios.
        </div>
      )}

      {missingCycleTimes.length > 0 && (
        <div className="p-3 rounded border border-amber-300 bg-amber-50 text-sm text-amber-900">
          {missingCycleTimes.length} stor
          {missingCycleTimes.length === 1 ? 'y has' : 'ies have'} story-point values without
          configured cycle times (
          {Array.from(new Set(missingCycleTimes.map((s) => s.storyPoints))).join(', ')}
          ). Add them in Config.
        </div>
      )}

      <section className="border border-slate-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setBacklogOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Backlog</h2>
            <p className="text-xs text-slate-500">
              {team.backlog.length} stor{team.backlog.length === 1 ? 'y' : 'ies'} · upload CSV or adjust start days
            </p>
          </div>
          <span className="text-slate-400 text-sm">{backlogOpen ? '▲' : '▼'}</span>
        </button>
        {backlogOpen && (
          <div className="px-4 pb-4 pt-3">
            <CsvUpload team={team} />
            <div className="mt-4">
              <BacklogTable team={team} />
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">
          Flow grid
        </h2>
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
          <Legend label="Dev" cls="bg-blue-200 text-blue-900" />
          <Legend label="QA" cls="bg-purple-200 text-purple-900" />
          <Legend label="Done" cls="bg-emerald-50 text-emerald-700 border border-emerald-200" />
          <Legend label="Unknown SP" cls="bg-red-100 text-red-700" />
          <span className="ml-4">Load:</span>
          <Legend label="≤1.0" cls="bg-emerald-200 text-emerald-900" />
          <Legend label="≤1.25" cls="bg-amber-200 text-amber-900" />
          <Legend label=">1.25" cls="bg-red-300 text-red-900" />
        </div>
        <FlowGrid team={team} />
      </section>
    </div>
  );
}

function Legend({ label, cls }: { label: string; cls: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-4 h-4 rounded ${cls}`} />
      <span>{label}</span>
    </span>
  );
}
