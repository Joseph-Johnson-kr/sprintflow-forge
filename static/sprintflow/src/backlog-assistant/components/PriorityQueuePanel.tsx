import { useRef, useState } from 'react';
import { useBacklogAssistantStore } from '../stores/backlogAssistantStore';
import {
  PQ_GROUPS,
  PQ_TYPE_ORDER,
  TYPE_TC,
  computePriorityQueueItems,
  pqExplanation,
  pqPriorityIcon,
  trunc,
} from '../utils/graph';
import type { BAIssue, DependencyCandidate, PQItem } from '../types';
import { useCanvasContextMenu } from '../hooks/useCanvasContextMenu';

interface Props {
  onClose: () => void;
}

const DEFAULT_TYPE_TC = { bg: '#f1f5f9', border: '#64748b', text: '#374151' };

function collectTypes(issues: Record<string, BAIssue>): string[] {
  const set = new Set<string>();
  Object.values(issues).forEach((i) => {
    if (i.type !== 'Objective') set.add(i.type);
  });
  return [...set].sort((a, b) => {
    const ia = PQ_TYPE_ORDER.indexOf(a);
    const ib = PQ_TYPE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export default function PriorityQueuePanel({ onClose }: Props) {
  const issues = useBacklogAssistantStore((s) => s.issues);
  const edges = useBacklogAssistantStore((s) => s.edges);
  const externalIssues = useBacklogAssistantStore((s) => s.externalIssues);
  const rankOverrides = useBacklogAssistantStore((s) => s.rankOverrides);
  const newIssueKeys = useBacklogAssistantStore((s) => s.newIssueKeys);

  const [types] = useState(() => collectTypes(issues));
  const [typeFilter, setTypeFilter] = useState<Set<string>>(() => new Set(types));
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(
    () => new Set(['Critical', 'High', 'Medium', 'Low']),
  );
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState(420);

  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { canvasRef, menuCanvasClassName, openMenu } = useCanvasContextMenu(rootRef);

  const toggleType = (t: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const togglePriority = (p: string) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      const api = useBacklogAssistantStore.getState().graphApi;
      if (next.has(key)) {
        next.delete(key);
        api?.setHoverNode(null);
      } else {
        next.add(key);
        api?.setHoverNode(key);
      }
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onResizeStart = (e: React.MouseEvent) => {
    resizeRef.current = { startX: e.clientX, startW: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startX, startW } = resizeRef.current;
      setWidth(Math.max(360, Math.min(1000, startW - (ev.clientX - startX))));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const allItems = computePriorityQueueItems({ issues, edges });
  const filtered = allItems.filter((item) => typeFilter.has(item.type) && priorityFilter.has(item.rawPriority));

  const buckets: Record<string, PQItem[]> = { Critical: [], High: [], Medium: [], Low: [] };
  filtered.forEach((item) => {
    if (buckets[item.rawPriority]) buckets[item.rawPriority].push(item);
  });
  Object.values(buckets).forEach((arr) =>
    arr.sort((a, b) => Number(!!rankOverrides[b.key]) - Number(!!rankOverrides[a.key])),
  );

  const visibleGroups = PQ_GROUPS.filter((g) => buckets[g.key].length > 0);

  const focusNode = (key: string) => useBacklogAssistantStore.getState().graphApi?.focusNode(key);

  const openRowMenu = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    const override = rankOverrides[key];
    const rect = rootRef.current?.getBoundingClientRect();
    openMenu(e.clientX - (rect?.left ?? 0), e.clientY - (rect?.top ?? 0), [
      { label: key },
      { sep: true },
      override
        ? { label: 'Remove rank override', action: () => useBacklogAssistantStore.getState().graphApi?.removeRankOverride(key) }
        : { label: 'Override rank…', action: () => useBacklogAssistantStore.getState().setRankOverrideTarget(key) },
    ]);
  };

  return (
    <div
      ref={rootRef}
      className="relative shrink-0 border-l border-slate-200 bg-white flex flex-col"
      style={{ width }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-cyan-500/30"
        onMouseDown={onResizeStart}
      />
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-800 flex-1">Priority Queue</h2>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 text-slate-600"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="border-b border-slate-200 px-3 py-2 space-y-2">
        <div>
          <span className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Type</span>
          <div className="flex flex-wrap gap-1">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  typeFilter.has(t)
                    ? 'bg-slate-800 border-slate-800 text-white'
                    : 'bg-white border-slate-300 text-slate-500'
                }`}
                onClick={() => toggleType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">Priority</span>
          <div className="flex flex-wrap gap-1">
            {['Critical', 'High', 'Medium', 'Low'].map((p) => (
              <button
                key={p}
                type="button"
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  priorityFilter.has(p)
                    ? 'bg-slate-800 border-slate-800 text-white'
                    : 'bg-white border-slate-300 text-slate-500'
                }`}
                onClick={() => togglePriority(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {visibleGroups.length === 0 && (
          <div className="text-sm text-slate-400 text-center mt-8">No items match the current filters.</div>
        )}
        {visibleGroups.map((grp) => {
          const items = buckets[grp.key];
          const collapsed = collapsedGroups.has(grp.key);
          return (
            <div key={grp.key} className="mb-2">
              <div
                className="flex items-center gap-2 px-1 py-1.5 cursor-pointer select-none"
                onClick={() => toggleGroup(grp.key)}
              >
                <span className="text-xs text-slate-400">{collapsed ? '▶' : '▼'}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: grp.dot }} />
                <span className="text-xs font-semibold" style={{ color: grp.dot }}>
                  {grp.key}
                </span>
                <span className="text-xs text-slate-400 ml-auto">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>
              {!collapsed && (
                <div>
                  {items.map((item, idx) => (
                    <PQRow
                      key={item.key}
                      item={item}
                      rank={idx + 1}
                      expanded={expandedKeys.has(item.key)}
                      isNew={newIssueKeys.has(item.key)}
                      override={rankOverrides[item.key]}
                      issues={issues}
                      externalIssues={externalIssues}
                      onToggle={() => toggleExpanded(item.key)}
                      onContextMenu={(e) => openRowMenu(e, item.key)}
                      onFocusIssue={focusNode}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <canvas ref={canvasRef} className={menuCanvasClassName} />
    </div>
  );
}

function resolveKeyInfo(
  key: string,
  issues: Record<string, BAIssue>,
  externalIssues: Record<string, DependencyCandidate>,
): { summary: string; external: boolean } {
  if (issues[key]) return { summary: issues[key].summary, external: false };
  if (externalIssues[key]) return { summary: externalIssues[key].summary, external: true };
  return { summary: '', external: false };
}

function KeyRow({
  itemKey,
  issues,
  externalIssues,
  onFocusIssue,
}: {
  itemKey: string;
  issues: Record<string, BAIssue>;
  externalIssues: Record<string, DependencyCandidate>;
  onFocusIssue: (key: string) => void;
}) {
  const info = resolveKeyInfo(itemKey, issues, externalIssues);
  return (
    <div
      className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1 mb-1 cursor-pointer hover:bg-slate-100"
      onClick={(e) => {
        e.stopPropagation();
        onFocusIssue(itemKey);
      }}
    >
      <span className="text-xs font-semibold text-slate-700 shrink-0">{itemKey}</span>
      {info.summary && <span className="text-xs text-slate-500 truncate flex-1">{trunc(info.summary, 40)}</span>}
      {info.external && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">External</span>
      )}
    </div>
  );
}

function PQRow({
  item,
  rank,
  expanded,
  isNew,
  override,
  issues,
  externalIssues,
  onToggle,
  onContextMenu,
  onFocusIssue,
}: {
  item: PQItem;
  rank: number;
  expanded: boolean;
  isNew: boolean;
  override: { reason: string } | undefined;
  issues: Record<string, BAIssue>;
  externalIssues: Record<string, DependencyCandidate>;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onFocusIssue: (key: string) => void;
}) {
  const tc = TYPE_TC[item.type] || DEFAULT_TYPE_TC;
  const icon = pqPriorityIcon(item.rawPriority);
  const uCount = item.unblocksCount;
  const uLabel = uCount === 0 ? 'Unblocks nothing' : uCount === 1 ? 'Unblocks 1 item' : `Unblocks ${uCount} items`;

  return (
    <div
      className={`rounded border mb-1.5 ${override ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'}`}
      title={override ? `Rank override: ${override.reason}` : undefined}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-start gap-2 p-2 cursor-pointer" onClick={onToggle}>
        <div className="text-xs font-semibold text-slate-400 w-4 shrink-0 mt-0.5">{rank}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-800">{item.key}</div>
          <div className="text-xs text-slate-600 truncate" title={item.summary}>
            {trunc(item.summary, 60)}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{uLabel}</span>
            {item.blockedByKeys.length > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                Blocked by {item.blockedByKeys.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {icon && (
            <span className={`text-xs font-bold leading-none ${icon.cls}`} title={`${item.rawPriority} priority`}>
              {icon.char.repeat(icon.count)}
            </span>
          )}
          {isNew && <span className="text-[10px] px-1 py-0.5 rounded bg-cyan-100 text-cyan-700">… New</span>}
          {override && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">★ Override</span>}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded border"
            style={{ background: tc.bg, color: tc.text, borderColor: tc.border }}
          >
            {item.type}
          </span>
          <span className="text-xs text-slate-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 px-2 py-2 space-y-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">Jira Priority</div>
            <div className="text-xs text-slate-700">{item.priority || 'Not set'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">
              Blocked by {item.blockedByKeys.length ? `(${item.blockedByKeys.length})` : ''}
            </div>
            {item.blockedByKeys.length === 0 ? (
              <span className="text-[11px] text-slate-400">Nothing blocking this item</span>
            ) : (
              item.blockedByKeys.map((k) => (
                <KeyRow key={k} itemKey={k} issues={issues} externalIssues={externalIssues} onFocusIssue={onFocusIssue} />
              ))
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">
              Directly unblocks {item.directUnblocksKeys.length ? `(${item.directUnblocksKeys.length})` : ''}
            </div>
            {item.directUnblocksKeys.length === 0 ? (
              <span className="text-[11px] text-slate-400">Doesn't directly unblock anything</span>
            ) : (
              item.directUnblocksKeys.map((k) => (
                <KeyRow key={k} itemKey={k} issues={issues} externalIssues={externalIssues} onFocusIssue={onFocusIssue} />
              ))
            )}
          </div>
          <div className="text-xs text-slate-500 leading-relaxed">{pqExplanation(item)}</div>
        </div>
      )}
    </div>
  );
}
