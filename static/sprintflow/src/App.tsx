import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ConfigView from './components/ConfigView';
import SprintView from './components/SprintView';
import QuarterView from './components/QuarterView';
import HomePage from './components/HomePage';
import EmptyState from './components/EmptyState';
import { useTeamStore } from './stores/teamStore';
import { useUIStore } from './stores/uiStore';

export default function App() {
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const addTeam = useTeamStore((s) => s.addTeam);
  const view = useUIStore((s) => s.view);

  useEffect(() => {
    if (teams.length === 0) {
      addTeam('Team Alpha');
    }
  }, [teams.length, addTeam]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {view === 'home' ? (
          <HomePage />
        ) : !selectedTeam ? (
          <EmptyState
            title="No team selected"
            message="Create a team from the sidebar to get started."
          />
        ) : view === 'config' ? (
          <ConfigView team={selectedTeam} />
        ) : view === 'quarter' ? (
          <QuarterView team={selectedTeam} />
        ) : (
          <SprintView team={selectedTeam} />
        )}
      </main>
    </div>
  );
}
