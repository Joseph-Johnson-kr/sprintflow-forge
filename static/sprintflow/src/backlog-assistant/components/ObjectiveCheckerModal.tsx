import { useState } from 'react';
import { useBacklogAssistantStore } from '../stores/backlogAssistantStore';
import { isDoneStatus } from '../utils/graph';
import type { SprintIssue, SprintOption } from '../types';

interface Props {
  onClose: () => void;
  sprints: SprintOption[];
  fetchSprintIssues: (sprintId: number) => Promise<SprintIssue[]>;
}

interface CanBringItem {
  key: string;
  summary: string;
  total: number;
  doneCount: number;
  sprintCount: number;
  memberKeys: string[];
}

interface CompleteItem {
  key: string;
  summary: string;
  total: number;
  doneCount: number;
}

interface CheckResults {
  error?: string;
  canBring: CanBringItem[];
  complete: CompleteItem[];
  completedKeys: Set<string>;
}

function runObjectiveChecker(sprintKeys: Set<string>): CheckResults {
  const { issues, objectiveGroups } = useBacklogAssistantStore.getState();
  const objectiveKeys = new Set(Object.values(issues).filter((i) => i.type === 'Objective').map((i) => i.key));

  if (!objectiveKeys.size) {
    return { error: 'No Objectives are present in the current backlog.', canBring: [], complete: [], completedKeys: new Set() };
  }

  const completedKeys = new Set(Object.values(issues).filter((i) => isDoneStatus(i.status)).map((i) => i.key));

  const canBring: CanBringItem[] = [];
  const complete: CompleteItem[] = [];

  [...objectiveKeys].sort().forEach((ok) => {
    const members = objectiveGroups[ok] || [];
    if (!members.length) return;
    const obj = issues[ok];
    if (!obj) return;

    const doneCount = members.filter((k) => completedKeys.has(k)).length;
    const sprintCount = members.filter((k) => sprintKeys.has(k) && !completedKeys.has(k)).length;
    const otherCount = members.length - doneCount - sprintCount;
    if (otherCount > 0) return;

    if (sprintCount > 0) {
      canBring.push({ key: obj.key, summary: obj.summary, total: members.length, doneCount, sprintCount, memberKeys: members });
    } else {
      complete.push({ key: obj.key, summary: obj.summary, total: members.length, doneCount });
    }
  });

  return { canBring, complete, completedKeys };
}

function CanBringRow({ item, completedKeys, expanded, onToggle }: {
  item: CanBringItem;
  completedKeys: Set<string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const issues = useBacklogAssistantStore((s) => s.issues);
  const memberSummary = (key: string) => issues[key]?.summary || '';

  return (
    <div className="rounded border border-slate-200 p-2.5 mb-2">
      <button type="button" className="flex items-start gap-2 w-full text-left" onClick={onToggle}>
        <span className="text-slate-400 text-xs mt-0.5 shrink-0">{expanded ? '▼' : '▶'}</span>
        <div>
          <div className="text-sm font-semibold text-slate-800">{item.key}</div>
          <div className="text-xs text-slate-500">{item.summary}</div>
        </div>
      </button>
      <div className="flex flex-wrap gap-1.5 mt-1.5 ml-5">
        {item.doneCount > 0 && (
          <span className="rounded bg-emerald-100 text-emerald-700 text-[11px] px-1.5 py-0.5">{item.doneCount} completed</span>
        )}
        {item.sprintCount > 0 && (
          <span className="rounded bg-cyan-100 text-cyan-700 text-[11px] px-1.5 py-0.5">{item.sprintCount} in sprint</span>
        )}
        <span className="rounded bg-slate-100 text-slate-600 text-[11px] px-1.5 py-0.5">{item.total} related total</span>
      </div>
      {expanded && (
        <div className="mt-2 ml-5 border-t border-slate-100 pt-2">
          {item.memberKeys.map((k) => (
            <div key={k} className="flex items-center gap-2 py-1 text-xs">
              <span className="font-semibold text-slate-700 shrink-0">{k}</span>
              <span className="text-slate-500 truncate flex-1">{memberSummary(k)}</span>
              {completedKeys.has(k) ? (
                <span className="rounded bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 shrink-0">Completed</span>
              ) : (
                <span className="rounded bg-cyan-100 text-cyan-700 text-[10px] px-1.5 py-0.5 shrink-0">In Sprint</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompleteRow({ item }: { item: CompleteItem }) {
  return (
    <div className="rounded border border-slate-200 p-2.5 mb-2">
      <div className="text-sm font-semibold text-slate-800">{item.key}</div>
      <div className="text-xs text-slate-500">{item.summary}</div>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <span className="rounded bg-emerald-100 text-emerald-700 text-[11px] px-1.5 py-0.5">{item.doneCount} completed</span>
        <span className="rounded bg-slate-100 text-slate-600 text-[11px] px-1.5 py-0.5">{item.total} related total</span>
      </div>
    </div>
  );
}

export default function ObjectiveCheckerModal({ onClose, sprints, fetchSprintIssues }: Props) {
  const [sprintId, setSprintId] = useState<number | ''>(() => sprints[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResults | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const runCheck = async () => {
    if (sprintId === '') return;
    setLoading(true);
    setExpandedKeys(new Set());
    try {
      const sprintIssues = await fetchSprintIssues(Number(sprintId));
      const sprintKeys = new Set(sprintIssues.map((i) => i.issueKey));
      setResults(runObjectiveChecker(sprintKeys));
    } catch (err) {
      window.alert(`Could not load sprint issues: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[640px] max-w-[95vw] max-h-[85vh] flex flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Objective Checker</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Pick a sprint to check which objectives are on track to complete.
            </p>
          </div>
          <button type="button" className="text-sm text-slate-500 hover:text-slate-800 shrink-0" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Sprint</label>
              <select
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value ? Number(e.target.value) : '')}
              >
                {sprints.length === 0 && <option value="">No sprints found</option>}
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.state === 'active' ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="rounded bg-cyan-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-700"
              disabled={sprintId === '' || loading}
              onClick={runCheck}
            >
              {loading ? 'Checking…' : 'Check Objectives'}
            </button>
          </div>

          {results && (
            <div className="mt-4">
              {results.error ? (
                <div className="text-sm text-slate-400 text-center py-6">{results.error}</div>
              ) : results.canBring.length === 0 && results.complete.length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-6 leading-relaxed">
                  No objectives are fully covered by this sprint.
                  <br />
                  Some related work items may still be outstanding.
                </div>
              ) : (
                <>
                  {results.canBring.length > 0 && (
                    <>
                      <div className="text-xs font-semibold text-slate-500 mb-2">
                        Ready to complete this sprint — {results.canBring.length} objective{results.canBring.length !== 1 ? 's' : ''}
                      </div>
                      {results.canBring.map((item) => (
                        <CanBringRow
                          key={item.key}
                          item={item}
                          completedKeys={results.completedKeys}
                          expanded={expandedKeys.has(item.key)}
                          onToggle={() => toggle(item.key)}
                        />
                      ))}
                    </>
                  )}
                  {results.complete.length > 0 && (
                    <>
                      <div className={`text-xs font-semibold text-slate-500 mb-2 ${results.canBring.length ? 'mt-5' : ''}`}>
                        Already complete — {results.complete.length} objective{results.complete.length !== 1 ? 's' : ''}
                      </div>
                      {results.complete.map((item) => (
                        <CompleteRow key={item.key} item={item} />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
