import { useBacklogAssistantStore } from '../stores/backlogAssistantStore';
import { statusColor, trunc, typeColor } from '../utils/graph';
import type { BAEdge, BAIssue, DependencyCandidate } from '../types';

function focusNode(key: string) {
  const store = useBacklogAssistantStore.getState();
  store.graphApi?.focusNode(key);
  store.setSelectedNode(key);
}

function LinkChip({
  issueKey,
  summary,
  edgeId,
  external,
}: {
  issueKey: string;
  summary: string;
  edgeId?: string;
  external?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 mb-1.5 cursor-pointer hover:bg-slate-100"
      onClick={() => focusNode(issueKey)}
    >
      <span className="text-xs font-semibold text-slate-700 shrink-0">{issueKey}</span>
      <span className="text-xs text-slate-500 truncate flex-1">{summary}</span>
      {external && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">External</span>
      )}
      {edgeId && (
        <button
          type="button"
          className="text-slate-400 hover:text-red-600 text-xs shrink-0"
          title="Remove dependency"
          onClick={(e) => {
            e.stopPropagation();
            const api = useBacklogAssistantStore.getState().graphApi;
            if (api) api.removeEdge(edgeId);
            else useBacklogAssistantStore.getState().removeEdge(edgeId);
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function dedupeByOtherEnd(edges: BAEdge[], self: (e: BAEdge) => string): BAEdge[] {
  const seen = new Set<string>();
  const out: BAEdge[] = [];
  for (const e of edges) {
    const other = self(e);
    if (seen.has(other)) continue;
    seen.add(other);
    out.push(e);
  }
  return out;
}

function resolveLinkedIssue(
  key: string,
  issues: Record<string, BAIssue>,
  externalIssues: Record<string, DependencyCandidate>,
): { summary: string; external: boolean } {
  if (issues[key]) return { summary: issues[key].summary, external: false };
  if (externalIssues[key]) return { summary: externalIssues[key].summary, external: true };
  return { summary: '(not in project)', external: false };
}

function IssueDetail({ issueKey }: { issueKey: string }) {
  const issues = useBacklogAssistantStore((s) => s.issues);
  const externalIssues = useBacklogAssistantStore((s) => s.externalIssues);
  const edges = useBacklogAssistantStore((s) => s.edges);

  const issue = issues[issueKey];
  if (!issue) return <div className="text-sm text-slate-400 text-center mt-8">Issue not found</div>;

  const blockEdges = dedupeByOtherEnd(
    edges.filter((e) => e.type === 'blocks' && e.from === issueKey),
    (e) => e.to,
  );
  const blockedByEdges = dedupeByOtherEnd(
    edges.filter((e) => e.type === 'blocks' && e.to === issueKey),
    (e) => e.from,
  );

  const c = typeColor(issue.type);
  const sc = statusColor(issue.status);
  const parent = issue.parentKey ? issues[issue.parentKey] : undefined;

  return (
    <div>
      <div className="text-sm font-semibold text-slate-800">{issue.key}</div>
      <div className="text-sm text-slate-600 mt-1 mb-3">{issue.summary}</div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Field label="Type">
          <span
            className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
            style={{ background: c.border, color: c.font }}
          >
            {issue.type || '—'}
          </span>
        </Field>
        <Field label="Status">
          <span
            className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
            style={{ background: `${sc}22`, color: sc, border: `1px solid ${sc}55` }}
          >
            {issue.status || '—'}
          </span>
        </Field>
        <Field label="Priority">{issue.priority || '—'}</Field>
        <Field label="Story Points">{issue.storyPoints || '—'}</Field>
        <Field label="Sprint">{trunc(issue.sprint, 22) || '—'}</Field>
        <Field label="Assignee">{trunc(issue.assignee, 20) || '—'}</Field>
      </div>

      {issue.parentKey && (
        <Section title="Parent">
          <LinkChip
            issueKey={issue.parentKey}
            summary={trunc(parent ? parent.summary : issue.parentSummary, 36)}
          />
        </Section>
      )}

      {blockedByEdges.length > 0 && (
        <Section title={`Blocked By (${blockedByEdges.length})`}>
          {blockedByEdges.map((e) => {
            const info = resolveLinkedIssue(e.from, issues, externalIssues);
            return (
              <LinkChip
                key={e.id}
                issueKey={e.from}
                summary={trunc(info.summary, 24)}
                external={info.external}
                edgeId={e.id}
              />
            );
          })}
        </Section>
      )}

      {blockEdges.length > 0 && (
        <Section title={`Blocks (${blockEdges.length})`}>
          {blockEdges.map((e) => {
            const info = resolveLinkedIssue(e.to, issues, externalIssues);
            return (
              <LinkChip
                key={e.id}
                issueKey={e.to}
                summary={trunc(info.summary, 24)}
                external={info.external}
                edgeId={e.id}
              />
            );
          })}
        </Section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">{label}</label>
      <span className="text-sm text-slate-700">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h4 className="text-xs font-semibold text-slate-500 mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

export default function Sidebar() {
  const selectedNode = useBacklogAssistantStore((s) => s.selectedNode);

  return (
    <div className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col">
      <div className="border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">Issue</div>
      <div className="flex-1 overflow-y-auto p-3">
        {selectedNode ? (
          <IssueDetail issueKey={selectedNode} />
        ) : (
          <div className="text-sm text-slate-400 text-center mt-8 leading-relaxed">
            Click an issue to see details.
            <br />
            <br />
            <b>Right-click</b> any dependency line
            <br />
            to remove or reverse it.
            <br />
            <br />
            <b>Right-click</b> an issue or use
            <br />
            <b>+ Add Dependency</b> to create links.
          </div>
        )}
      </div>
    </div>
  );
}
