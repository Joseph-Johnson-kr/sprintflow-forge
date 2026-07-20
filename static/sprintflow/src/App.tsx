import { useEffect } from 'react';
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
  const updateStory = useTeamStore((s) => s.updateStory);
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
    externalDependencyInfo,
    resolveExternalIssues,
    searchStoryDependencies,
    syncStoryDependencyLink,
  } = useForgeData();

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  // Read-side reconciliation: a Story's local `dependencies` is kept fully in sync with
  // Jira's real "Blocks" links (`blockedByIssueKeys`) — every add/remove in this app writes
  // through to Jira, so any drift (e.g. a link removed directly in Jira) is corrected here.
  useEffect(() => {
    if (!selectedTeam) return;
    const unresolvedKeys: string[] = [];
    for (const story of selectedTeam.backlog) {
      const blockedBy = new Set(story.blockedByIssueKeys);
      const additions = story.blockedByIssueKeys.filter((k) => !story.dependencies.includes(k));
      const removals = story.dependencies.filter((k) => !blockedBy.has(k));
      if (additions.length || removals.length) {
        const next = [...new Set(story.dependencies.filter((d) => !removals.includes(d)).concat(additions))];
        updateStory(selectedTeam.id, story.issueKey, { dependencies: next });
      }
      for (const blockerKey of story.blockedByIssueKeys) {
        if (!selectedTeam.backlog.some((s) => s.issueKey === blockerKey)) unresolvedKeys.push(blockerKey);
      }
    }
    if (unresolvedKeys.length) resolveExternalIssues(unresolvedKeys);
  }, [selectedTeam, updateStory, resolveExternalIssues]);

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
            onSyncDependencyLink={syncStoryDependencyLink}
            onSearchDependencies={searchStoryDependencies}
            onResolveExternalIssues={resolveExternalIssues}
            externalDependencyInfo={externalDependencyInfo}
          />
        )}
      </main>
    </div>
  );
}
