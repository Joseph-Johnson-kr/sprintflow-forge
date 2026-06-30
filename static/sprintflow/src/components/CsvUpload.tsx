import { useRef, useState } from 'react';
import { parseCsv } from '../utils/csv';
import type { Team } from '../types';
import { useTeamStore } from '../stores/teamStore';

interface Props {
  team: Team;
}

export default function CsvUpload({ team }: Props) {
  const setBacklog = useTeamStore((s) => s.setBacklog);
  const clearBacklog = useTeamStore((s) => s.clearBacklog);
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setErrors([]);
    setWarnings([]);
    try {
      const text = await file.text();
      const result = await parseCsv(text);
      setErrors(result.errors);
      setWarnings(result.warnings);
      if (result.errors.length === 0 && result.stories.length > 0) {
        setBacklog(team.id, result.stories);
      } else if (result.errors.length === 0 && result.stories.length === 0) {
        setErrors(['CSV parsed but contained no stories.']);
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Failed to read file.']);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="text-sm"
          disabled={busy}
        />
        {team.backlog.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Clear all stories from this team’s backlog?')) {
                clearBacklog(team.id);
              }
            }}
            className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100"
          >
            Clear backlog
          </button>
        )}
        <span className="text-xs text-slate-500">
          Required columns: Issue Key, Story Points. Optional: Summary.
        </span>
      </div>
      {errors.length > 0 && (
        <div className="mt-3 p-3 rounded border border-red-300 bg-red-50 text-sm text-red-800">
          <div className="font-medium mb-1">Couldn't import CSV:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <details className="mt-3 p-3 rounded border border-amber-300 bg-amber-50 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">
            Imported with {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </summary>
          <ul className="list-disc list-inside mt-2 space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
