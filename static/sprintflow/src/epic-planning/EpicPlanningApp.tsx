import { useEffect, useState } from 'react';
import { useQuarterStore, getSelectedQuarter } from './stores/quarterStore';
import { useEpicPlanningData } from './hooks/useEpicPlanningData';
import QuarterConfig from './components/QuarterConfig';
import EpicTable from './components/EpicTable';
import MemberCapacity from './components/MemberCapacity';
import QuarterGrid from './components/QuarterGrid';
import AllQuartersView from './components/AllQuartersView';
import CollapsibleSection from '../components/CollapsibleSection';

export default function App() {
  const { loading, teamId, teamName, members, backlogEpics } = useEpicPlanningData();

  const quartersByTeam = useQuarterStore((s) => s.quartersByTeam);
  const selectedQuarterId = useQuarterStore((s) => s.selectedQuarterId);
  const syncMembersFromTeam = useQuarterStore((s) => s.syncMembersFromTeam);
  const state = useQuarterStore((s) => s);

  const [isAllView, setIsAllView] = useState(false);

  const quarters = teamId ? (quartersByTeam[teamId] ?? []) : [];
  const selectedQuarter = teamId ? getSelectedQuarter(state, teamId) : null;

  useEffect(() => {
    if (!teamId || !selectedQuarterId || members.length === 0) return;
    syncMembersFromTeam(teamId, selectedQuarterId, members);
  }, [teamId, selectedQuarterId, members, syncMembersFromTeam]);

  return (
    <div className="flex flex-col h-screen max-w-[1500px] w-full mx-auto">
      <header className="px-6 py-4 border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">
          Epic Planning {teamName && <span className="text-slate-400">· {teamName}</span>}
        </h1>
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
        ) : (
          <div className="space-y-6">
            <QuarterConfig
              teamId={teamId}
              quarters={quarters}
              selected={selectedQuarter}
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
                    <EpicTable teamId={teamId} quarter={selectedQuarter} backlogEpics={backlogEpics} />
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
