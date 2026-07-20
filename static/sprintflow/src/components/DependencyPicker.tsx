import { useEffect, useState } from 'react';
import type { DependencyCandidate } from '../types';

export function DependencyCandidateBadges({ candidate }: { candidate: DependencyCandidate }) {
  const currentSprint = candidate.sprintNames[candidate.sprintNames.length - 1];
  return (
    <>
      {candidate.suggestedSize && (
        <span className="px-1 rounded bg-white/70 border border-current/20 text-[10px]">
          {candidate.suggestedSize}
        </span>
      )}
      {candidate.storyPoints != null && (
        <span className="px-1 rounded bg-white/70 border border-current/20 text-[10px]">
          {candidate.storyPoints} SP
        </span>
      )}
      {candidate.teamName && (
        <span className="px-1 rounded bg-white/70 border border-current/20 text-[10px]">
          {candidate.teamName}
        </span>
      )}
      {candidate.planningVersions.map((v) => (
        <span key={v} className="px-1 rounded bg-white/70 border border-current/20 text-[10px]">
          {v}
        </span>
      ))}
      {currentSprint && (
        <span className="px-1 rounded bg-white/70 border border-current/20 text-[10px]">
          {currentSprint}
        </span>
      )}
    </>
  );
}

interface DependencySearchBoxProps {
  excludeIssueKey?: string;
  onSearchDependencies: (query: string, excludeIssueKey?: string) => Promise<DependencyCandidate[]>;
  onSelect: (candidate: DependencyCandidate) => void;
}

export function DependencySearchBox({
  excludeIssueKey,
  onSearchDependencies,
  onSelect,
}: DependencySearchBoxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DependencyCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      onSearchDependencies(query, excludeIssueKey)
        .then((r) => {
          if (!cancelled) setResults(r ?? []);
        })
        .catch((err) => console.error('Dependency search failed', err))
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, excludeIssueKey, onSearchDependencies]);

  return (
    <div className="relative mt-2 max-w-sm">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search any project by key or summary…"
        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-slate-400"
      />
      {query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {searching ? (
            <div className="px-2 py-1.5 text-xs text-slate-400">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-slate-400">No matching issues</div>
          ) : (
            results.map((r) => (
              <button
                key={r.issueKey}
                onClick={() => {
                  onSelect(r);
                  setQuery('');
                  setResults([]);
                }}
                className="flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left hover:bg-slate-50"
              >
                <span className="text-xs font-medium text-slate-800">
                  {r.issueKey} — {r.summary}
                </span>
                <span className="flex flex-wrap gap-1 text-slate-500">
                  <DependencyCandidateBadges candidate={r} />
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
