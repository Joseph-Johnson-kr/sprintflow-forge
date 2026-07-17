import { useEffect, useState } from 'react';
import { useQuarterStore, getSelectedQuarter } from './stores/quarterStore';
import { useEpicPlanningData } from './hooks/useEpicPlanningData';
import QuarterConfig from './components/QuarterConfig';
import EpicTable from './components/EpicTable';
import MemberCapacity from './components/MemberCapacity';
import QuarterGrid from './components/QuarterGrid';
import AllQuartersView from './components/AllQuartersView';
import TeamRoster from './components/TeamRoster';
import EpicCycleTimeConfig from './components/EpicCycleTimeConfig';
import CollapsibleSection from '../components/CollapsibleSection';

type EpicPlanningTab = 'forecast' | 'team';

export default function App() {
  const {
    loading,
    teamId,
    teamName,
    members,
    backlogEpics,
    quarterOptions,
    assignPlanningVersion,
    updateMemberRole,
    epicStatuses,
    epicCycleTimeSettings,
    updateEpicCycleTimeSettings,
    epicDetailedCycleTimes,
    recalculateEpicCycleTimes,
    recalculatingEpicCycleTimes,
  } = useEpicPlanningData();

  const quartersByTeam = useQuarterStore((s) => s.quartersByTeam);
  const selectedQuarterId = useQuarterStore((s) => s.selectedQuarterId);
  const syncMembersFromTeam = useQuarterStore((s) => s.syncMembersFromTeam);
  const state = useQuarterStore((s) => s);

  const [isAllView, setIsAllView] = useState(false);
  const [tab, setTab] = useState<EpicPlanningTab>('forecast');

  const quarters = teamId ? (quartersByTeam[teamId] ?? []) : [];
  const selectedQuarter = teamId ? getSelectedQuarter(state, teamId) : null;

  useEffect(() => {
    if (!teamId || !selectedQuarterId || members.length === 0) return;
    syncMembersFromTeam(teamId, selectedQuarterId, members);
  }, [teamId, selectedQuarterId, members, syncMembersFromTeam]);

  return (
    <div className="flex flex-col h-screen max-w-[1500px] w-full mx-auto">
      <header className="flex items-center gap-6 px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900 truncate">Epic Planning</h1>
          <p className="text-xs text-slate-500 truncate">{teamName}</p>
        </div>
        <nav className="flex items-center gap-1">
          <button
            onClick={() => setTab('forecast')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === 'forecast' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Forecast
          </button>
          <button
            onClick={() => setTab('team')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === 'team' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Config
          </button>
        </nav>
      </header>
      <main className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Loading Epic Planning...
          </div>
        ) : !teamId ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Could not load team data from Jira.
          </div>
        ) : tab === 'team' ? (
          <div className="space-y-6">
            <TeamRoster members={members} onUpdateRole={updateMemberRole} />
            <EpicCycleTimeConfig
              epicStatuses={epicStatuses}
              epicCycleTimeSettings={epicCycleTimeSettings}
              onSettingsChange={updateEpicCycleTimeSettings}
              epicDetailedCycleTimes={epicDetailedCycleTimes}
              onRecalculate={recalculateEpicCycleTimes}
              recalculating={recalculatingEpicCycleTimes}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <QuarterConfig
              teamId={teamId}
              quarters={quarters}
              selected={selectedQuarter}
              quarterOptions={quarterOptions}
              isAllView={isAllView}
              onAllViewChange={setIsAllView}
            />
            {isAllView && selectedQuarter ? (
              <AllQuartersView
                quarters={quarters.filter((q) => q.year === selectedQuarter.year)}
              />
            ) : (
              selectedQuarter && (
                <>
                  <CollapsibleSection
                    title="Epics"
                    subtitle={`${(selectedQuarter.epics ?? []).length} Epic${
                      (selectedQuarter.epics ?? []).length !== 1 ? 's' : ''
                    } planned · set size, dev allocation, risks, and dependencies`}
                  >
                    <EpicTable
                      teamId={teamId}
                      quarter={selectedQuarter}
                      backlogEpics={backlogEpics}
                      quarterOptions={quarterOptions}
                      onAssignPlanningVersion={assignPlanningVersion}
                    />
                  </CollapsibleSection>
                  <CollapsibleSection
                    title="Team Capacity"
                    subtitle={`${(selectedQuarter.members ?? []).length} member${
                      (selectedQuarter.members ?? []).length !== 1 ? 's' : ''
                    } · enter days absent per sprint`}
                  >
                    <MemberCapacity teamId={teamId} quarter={selectedQuarter} />
                  </CollapsibleSection>
                  <section>
                    <h2 className="text-sm font-semibold text-slate-700 mb-2">Forecast</h2>
                    <QuarterGrid quarter={selectedQuarter} />
                  </section>
                </>
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}
