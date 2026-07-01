import { useUIStore } from '../stores/uiStore';

interface Props {
  teamName: string;
  loading: boolean;
}

export default function NavBar({ teamName, loading }: Props) {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);

  return (
    <header className="flex items-center gap-6 px-6 py-3 border-b border-slate-200 bg-white shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900 truncate">SprintFlow</h1>
          {loading ? (
            <p className="text-xs text-slate-400">Loading from Jira…</p>
          ) : (
            <p className="text-xs text-slate-500 truncate">{teamName}</p>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-1">
        <button
          onClick={() => setView('sprint')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            view === 'sprint'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Sprint
        </button>
        <button
          onClick={() => setView('config')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            view === 'config'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Config
        </button>
      </nav>
    </header>
  );
}
