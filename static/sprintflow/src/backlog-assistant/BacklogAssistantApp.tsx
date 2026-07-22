import { useState } from 'react';
import { useBacklogAssistantStore } from './stores/backlogAssistantStore';
import { useBacklogAssistantData } from './hooks/useBacklogAssistantData';
import { useBacklogAssistantSession } from './hooks/useBacklogAssistantSession';
import Toolbar from './components/Toolbar';
import GraphCanvas from './components/GraphCanvas';
import Sidebar from './components/Sidebar';
import PriorityQueuePanel from './components/PriorityQueuePanel';
import ObjectiveCheckerModal from './components/ObjectiveCheckerModal';
import RankOverrideDialog from './components/RankOverrideDialog';

function UndoToast() {
  const undoToast = useBacklogAssistantStore((s) => s.undoToast);
  const dismissUndoToast = useBacklogAssistantStore((s) => s.dismissUndoToast);

  if (!undoToast) return null;

  const handleUndo = () => {
    const edge = undoToast;
    dismissUndoToast();
    const api = useBacklogAssistantStore.getState().graphApi;
    if (api) api.undoRemoveEdge(edge);
    else useBacklogAssistantStore.getState().undoRemoveEdge(edge);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-slate-800 text-white text-sm px-4 py-2.5 shadow-lg">
      <span>
        Dependency removed: {undoToast.from} → {undoToast.to}
      </span>
      <button type="button" className="font-semibold text-cyan-300 hover:text-cyan-200" onClick={handleUndo}>
        Undo
      </button>
      <button type="button" className="text-slate-400 hover:text-white" onClick={dismissUndoToast}>
        ✕
      </button>
    </div>
  );
}

export default function BacklogAssistantApp() {
  const [pqOpen, setPqOpen] = useState(false);
  const [objckOpen, setObjckOpen] = useState(false);

  const data = useBacklogAssistantData();
  const { autosaveLabel, exportWork, importFile } = useBacklogAssistantSession(
    data.projectKey,
    data.knownIssueKeys,
    !data.loading,
  );

  const issueCount = useBacklogAssistantStore((s) => Object.keys(s.issues).length);
  const dependencyCount = useBacklogAssistantStore((s) => s.edges.filter((e) => e.type === 'blocks').length);

  if (data.loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-sm text-slate-400">
        Loading backlog from Jira…
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 text-sm text-red-500">
        <span>{data.error}</span>
        <button
          type="button"
          className="rounded border border-red-300 bg-white px-3 py-1.5 text-red-600 hover:bg-red-50"
          onClick={data.retry}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full">
      <Toolbar
        hasData={issueCount > 0}
        issueCount={issueCount}
        dependencyCount={dependencyCount}
        autosaveLabel={autosaveLabel}
        pqOpen={pqOpen}
        onTogglePQ={() => setPqOpen((v) => !v)}
        onOpenObjectiveChecker={() => setObjckOpen(true)}
        onExportWork={exportWork}
        onImportFile={importFile}
      />

      {data.truncated && (
        <div className="bg-amber-50 text-amber-800 text-xs px-4 py-1.5 border-b border-amber-200">
          This project has more issues than could be loaded — some data may be incomplete.
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {issueCount > 0 ? (
          <>
            <GraphCanvas initialPositions={data.initialPositions} />
            {pqOpen ? <PriorityQueuePanel onClose={() => setPqOpen(false)} /> : <Sidebar />}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            No issues found in this project.
          </div>
        )}
      </div>

      {objckOpen && (
        <ObjectiveCheckerModal
          onClose={() => setObjckOpen(false)}
          sprints={data.sprints}
          fetchSprintIssues={data.fetchSprintIssues}
        />
      )}
      <RankOverrideDialog />
      <UndoToast />
    </div>
  );
}
