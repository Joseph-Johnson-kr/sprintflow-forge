import NavBar from './components/NavBar';
import ConfigView from './components/ConfigView';
import SprintView from './components/SprintView';
import EmptyState from './components/EmptyState';
import { useTeamStore } from './stores/teamStore';
import { useUIStore } from './stores/uiStore';
import { useForgeData } from './hooks/useForgeData';

export default function App() {
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const view = useUIStore((s) => s.view);

  const {
    loading,
    teamName,
    sprints,
    selectedSprintId,
    sprintLoading,
    selectSprint,
    boardStatuses,
    cycleTimeSettings,
    applyPhaseSettings,
    recalculateCycleTimes,
    recalculating,
  } = useForgeData();

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  return (
    <div className="flex flex-col h-screen max-w-[1500px] w-full mx-auto">
      <NavBar teamName={teamName} loading={loading} />
      <main className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Loading SprintFlow...
          </div>
        ) : !selectedTeam ? (
          <EmptyState
            title="No team data"
            message="SprintFlow could not load team data from Jira."
          />
        ) : view === 'config' ? (
          <ConfigView
            team={selectedTeam}
            boardStatuses={boardStatuses}
            cycleTimeSettings={cycleTimeSettings}
            onCycleTimeSettingsChange={applyPhaseSettings}
            onRecalculate={recalculateCycleTimes}
            recalculating={recalculating}
          />
        ) : (
          <SprintView
            team={selectedTeam}
            sprints={sprints}
            selectedSprintId={selectedSprintId}
            sprintLoading={sprintLoading}
            onSprintChange={selectSprint}
          />
        )}
      </main>
    </div>
  );
}
