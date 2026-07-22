import { useEffect, useRef, useState } from 'react';
import { useBacklogAssistantStore } from '../stores/backlogAssistantStore';
import { trunc } from '../utils/graph';

export default function RankOverrideDialog() {
  const target = useBacklogAssistantStore((s) => s.rankOverrideTarget);
  const issues = useBacklogAssistantStore((s) => s.issues);
  const rankOverrides = useBacklogAssistantStore((s) => s.rankOverrides);
  const setRankOverrideTarget = useBacklogAssistantStore((s) => s.setRankOverrideTarget);

  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!target) return;
    setReason(rankOverrides[target]?.reason || '');
    setError(false);
    const id = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target) return null;
  const issue = issues[target];
  if (!issue) return null;

  const close = () => setRankOverrideTarget(null);

  const confirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    useBacklogAssistantStore.getState().graphApi?.applyRankOverride(target, trimmed);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={close}
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <div className="w-[420px] max-w-[95vw] rounded-lg bg-white shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-800 mb-1.5">Override Rank</h3>
        <p className="text-sm text-slate-500 mb-2">
          Issue: <span className="font-medium text-slate-700">{target}: {trunc(issue.summary, 45)}</span>
        </p>
        <textarea
          ref={textareaRef}
          className={`w-full h-24 rounded border p-2 text-sm resize-none focus:outline-none focus:ring-2 ${
            error ? 'border-red-400 ring-red-200' : 'border-slate-300 focus:ring-cyan-200'
          }`}
          placeholder="Reason for override (required)…"
          value={reason}
          onChange={(e) => { setReason(e.target.value); if (error) setError(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirm();
          }}
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700"
            onClick={confirm}
          >
            Confirm Override
          </button>
        </div>
      </div>
    </div>
  );
}
