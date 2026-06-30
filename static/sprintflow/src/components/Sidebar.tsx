import { useState } from 'react';
import { useTeamStore } from '../stores/teamStore';
import { useQuarterStore } from '../stores/quarterStore';
import { useUIStore } from '../stores/uiStore';
import { parseBackup } from '../utils/backup';
import { isFileSystemAccessSupported, pickJsonFileFSA, pickJsonFileViaInput } from '../utils/backupFs';

export default function Sidebar() {
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);
  const addTeam = useTeamStore((s) => s.addTeam);
  const removeTeam = useTeamStore((s) => s.removeTeam);
  const renameTeam = useTeamStore((s) => s.renameTeam);
  const importTeam = useTeamStore((s) => s.importTeam);
  const importQuarters = useQuarterStore((s) => s.importQuarters);

  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function startEdit(id: string, name: string) {
    setEditingId(id);
    setEditingName(name);
  }

  function commitEdit() {
    if (editingId && editingName.trim()) {
      renameTeam(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  }

  function handleRemove(id: string, name: string) {
    if (window.confirm(`Delete team "${name}"? This cannot be undone.`)) {
      removeTeam(id);
    }
  }

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    try {
      const json = isFileSystemAccessSupported()
        ? await pickJsonFileFSA()
        : await pickJsonFileViaInput();
      if (!json) return; // user cancelled
      const backup = parseBackup(json);
      const newTeamId = importTeam(backup.team);
      importQuarters(newTeamId, backup.quarters);
      selectTeam(newTeamId);
      setView('config');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col h-full">
      <button
        onClick={() => setView('home')}
        className={`p-4 border-b border-slate-200 text-left w-full transition-colors ${
          view === 'home' ? 'bg-slate-900' : 'hover:bg-slate-50'
        }`}
        title="Go to home"
      >
        <h1 className={`text-lg font-semibold ${view === 'home' ? 'text-white' : 'text-slate-900'}`}>
          SprintFlow
        </h1>
        <p className={`text-xs ${view === 'home' ? 'text-slate-400' : 'text-slate-500'}`}>
          Sprint forecasting
        </p>
      </button>

      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase text-slate-500">Teams</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleImport}
              disabled={importing}
              className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              title="Import a team from a SprintFlow backup file"
            >
              {importing ? '…' : '↑ Import'}
            </button>
            <button
              onClick={() => addTeam('New Team')}
              className="text-xs px-2 py-1 rounded bg-slate-900 text-white hover:bg-slate-700"
              title="Add team"
            >
              + Add
            </button>
          </div>
        </div>
        {importError && (
          <p className="text-xs text-red-600 mb-1">{importError}</p>
        )}
        <ul className="space-y-1">
          {teams.map((t) => (
            <li key={t.id}>
              <div
                className={`group flex items-center justify-between rounded px-2 py-1.5 cursor-pointer ${
                  t.id === selectedTeamId
                    ? 'bg-slate-900 text-white'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
                onClick={() => {
                  selectTeam(t.id);
                  if (view === 'home') setView('sprint');
                }}
              >
                {editingId === t.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 bg-white text-slate-900 px-1 rounded text-sm"
                  />
                ) : (
                  <span
                    className="text-sm truncate flex-1"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEdit(t.id, t.name);
                    }}
                  >
                    {t.name}
                  </span>
                )}
                {editingId !== t.id && (
                  <span className="opacity-0 group-hover:opacity-100 flex gap-1 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(t.id, t.name);
                      }}
                      className="text-xs hover:underline"
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(t.id, t.name);
                      }}
                      className="text-xs hover:underline"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
            </li>
          ))}
          {teams.length === 0 && (
            <li className="text-xs text-slate-400 italic px-2">No teams yet</li>
          )}
        </ul>
      </div>

      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-xs font-semibold uppercase text-slate-500 mb-2">View</h2>
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <button
              onClick={() => setView('sprint')}
              className={`flex-1 text-sm px-2 py-1.5 rounded ${
                view === 'sprint'
                  ? 'bg-slate-200 text-slate-900 font-medium'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              Sprint
            </button>
            <button
              onClick={() => setView('config')}
              className={`flex-1 text-sm px-2 py-1.5 rounded ${
                view === 'config'
                  ? 'bg-slate-200 text-slate-900 font-medium'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              Config
            </button>
          </div>
          <button
            onClick={() => setView('quarter')}
            className={`w-full text-sm px-2 py-1.5 rounded ${
              view === 'quarter'
                ? 'bg-indigo-100 text-indigo-900 font-medium'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            Quarter Forecast
          </button>
        </div>
      </div>

      <div className="mt-auto p-4 text-[11px] text-slate-400">
        Local-only. Data persists in your browser.
      </div>
    </aside>
  );
}
