import { useRef } from 'react';
import { useBacklogAssistantStore } from '../stores/backlogAssistantStore';

interface Props {
  hasData: boolean;
  issueCount: number;
  dependencyCount: number;
  autosaveLabel: string | null;
  pqOpen: boolean;
  onTogglePQ: () => void;
  onOpenObjectiveChecker: () => void;
  onExportWork: () => void;
  onImportFile: (file: File) => void;
}

export default function Toolbar({
  hasData,
  issueCount,
  dependencyCount,
  autosaveLabel,
  pqOpen,
  onTogglePQ,
  onOpenObjectiveChecker,
  onExportWork,
  onImportFile,
}: Props) {
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const addingEdge = useBacklogAssistantStore((s) => s.addingEdge);
  const collapsedCount = useBacklogAssistantStore((s) => s.collapsedObjectives.size);
  const objectiveCount = useBacklogAssistantStore((s) => Object.keys(s.objectiveGroups).length);

  const graphApi = () => useBacklogAssistantStore.getState().graphApi;

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 flex-wrap">
      <h1 className="text-base font-semibold text-slate-800 mr-2">Backlog Assistant</h1>

      {hasData && (
        <>
          <div className="h-5 w-px bg-slate-200" />
          <button
            type="button"
            className={`text-sm px-3 py-1.5 rounded border ${addingEdge ? 'bg-cyan-600 border-cyan-600 text-white' : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'}`}
            onClick={() => graphApi()?.setAddingEdge(!addingEdge)}
          >
            {addingEdge ? 'Cancel Add Dependency' : 'Add Dependency'}
          </button>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            onClick={() => graphApi()?.fit()}
          >
            Fit
          </button>
          {objectiveCount > 0 && (
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              onClick={() => (collapsedCount > 0 ? graphApi()?.expandAll() : graphApi()?.collapseAll())}
            >
              {collapsedCount > 0 ? 'Expand All' : 'Collapse All'}
            </button>
          )}

          <div className="h-5 w-px bg-slate-200" />
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            onClick={onExportWork}
          >
            Export Work
          </button>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            onClick={() => jsonInputRef.current?.click()}
          >
            Import Work
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = '';
            }}
          />

          <div className="h-5 w-px bg-slate-200" />
          <button
            type="button"
            className={`text-sm px-3 py-1.5 rounded border ${pqOpen ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'}`}
            onClick={onTogglePQ}
          >
            Priority Queue
          </button>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            onClick={onOpenObjectiveChecker}
          >
            Objective Checker
          </button>

          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            {autosaveLabel && <span>{autosaveLabel}</span>}
            <span>
              {issueCount} issues · {dependencyCount} dependencies
            </span>
          </div>
        </>
      )}
    </div>
  );
}
