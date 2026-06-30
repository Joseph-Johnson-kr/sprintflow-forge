import { useEffect, useState } from 'react';
import type { Team } from '../types';
import { useQuarterStore, getSelectedQuarter } from '../stores/quarterStore';
import QuarterConfig from './QuarterConfig';
import MemberCapacity from './MemberCapacity';
import OKRTable from './OKRTable';
import QuarterGrid from './QuarterGrid';

interface Props {
  team: Team;
}

type Section = 'members' | 'epics' | 'forecast';

export default function QuarterView({ team }: Props) {
  const quartersByTeam = useQuarterStore((s) => s.quartersByTeam);
  const selectedQuarterId = useQuarterStore((s) => s.selectedQuarterId);
  const selectQuarter = useQuarterStore((s) => s.selectQuarter);
  const syncMembersFromTeam = useQuarterStore((s) => s.syncMembersFromTeam);

  const quarters = quartersByTeam[team.id] ?? [];
  const selected = getSelectedQuarter(
    { quartersByTeam, selectedQuarterId } as Parameters<typeof getSelectedQuarter>[0],
    team.id,
  );

  const [open, setOpen] = useState<Record<Section, boolean>>({
    members: true,
    epics: true,
    forecast: true,
  });

  function toggle(section: Section) {
    setOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  // Auto-select the first quarter for this team if none selected or selected belongs to another team
  useEffect(() => {
    if (quarters.length > 0 && (!selectedQuarterId || !quarters.find((q) => q.id === selectedQuarterId))) {
      selectQuarter(quarters[0].id);
    }
  }, [team.id, quarters.length]);

  // Sync team members into the selected quarter whenever team.members or the quarter changes
  useEffect(() => {
    if (selected && team.members && team.members.length > 0) {
      syncMembersFromTeam(team.id, selected.id, team.members);
    }
  }, [selected?.id, team.members]);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Quarter Forecast</h2>
          <p className="text-sm text-slate-500 mt-0.5">{team.name}</p>
        </div>
      </div>

      {/* Quarter selector */}
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <QuarterConfig teamId={team.id} quarters={quarters} selected={selected ?? null} />
      </div>

      {!selected ? (
        <div className="text-sm text-slate-400 italic py-8 text-center">
          Add a quarter above to start planning.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Team Member Capacity */}
          <section className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle('members')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Team Capacity</h3>
                <p className="text-xs text-slate-500">
                  {(selected.members ?? []).length} member{(selected.members ?? []).length !== 1 ? 's' : ''} ·
                  enter days absent per sprint
                </p>
              </div>
              <span className="text-slate-400 text-sm">{open.members ? '▲' : '▼'}</span>
            </button>
            {open.members && (
              <div className="px-4 pb-4 pt-3">
                <MemberCapacity teamId={team.id} quarter={selected} />
              </div>
            )}
          </section>

          {/* Epic Table */}
          <section className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle('epics')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Epics</h3>
                <p className="text-xs text-slate-500">
                  {(selected.epics ?? []).length} Epic{(selected.epics ?? []).length !== 1 ? 's' : ''} planned ·
                  set size, dev allocation, risks, and dependencies
                </p>
              </div>
              <span className="text-slate-400 text-sm">{open.epics ? '▲' : '▼'}</span>
            </button>
            {open.epics && (
              <div className="px-4 pb-4 pt-3">
                <OKRTable teamId={team.id} quarter={selected} />
              </div>
            )}
          </section>

          {/* Forecast Grid */}
          <section className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle('forecast')}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Forecast — {selected.name} {selected.year}
                </h3>
                <p className="text-xs text-slate-500">
                  {selected.sprintCount} sprints · Epic scheduling & capacity utilization
                </p>
              </div>
              <span className="text-slate-400 text-sm">{open.forecast ? '▲' : '▼'}</span>
            </button>
            {open.forecast && (
              <div className="px-4 pb-4 pt-3">
                <QuarterGrid quarter={selected} />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
