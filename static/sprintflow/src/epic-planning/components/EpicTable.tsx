import { useState } from 'react';
import type {
  BacklogEpicOption,
  DependencyCandidate,
  Epic,
  PlanningVersionOption,
  Quarter,
  RiskLevel,
  TShirtSize,
} from '../types/quarter';
import { TSHIRT_LABELS, TSHIRT_SIZE_OPTIONS } from '../types/quarter';
import { useQuarterStore } from '../stores/quarterStore';
import { DependencyCandidateBadges, DependencySearchBox } from '../../components/DependencyPicker';

interface Props {
  teamId: string;
  quarter: Quarter;
  backlogEpics: BacklogEpicOption[];
  quarterOptions: PlanningVersionOption[];
  onAssignPlanningVersion: (issueKey: string, option: PlanningVersionOption, mode: 'add' | 'remove') => void;
  onSyncDependencyLink: (blockedIssueKey: string, blockerIssueKey: string, mode: 'add' | 'remove') => void;
  onSearchDependencies: (query: string, excludeIssueKey?: string) => Promise<DependencyCandidate[]>;
  onResolveExternalIssues: (issueKeys: string[]) => void;
  externalDependencyInfo: Record<string, DependencyCandidate>;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

const RISK_BADGE_COLORS: Record<RiskLevel, string> = {
  low: 'text-emerald-700',
  medium: 'text-amber-700',
  high: 'text-red-700',
};

function highestRiskLevel(epic: Epic): RiskLevel | null {
  if (epic.risks.some((r) => r.level === 'high')) return 'high';
  if (epic.risks.some((r) => r.level === 'medium')) return 'medium';
  if (epic.risks.some((r) => r.level === 'low')) return 'low';
  return null;
}

interface RisksPanelProps {
  teamId: string;
  quarter: Quarter;
  epic: Epic;
}

function RisksPanel({ teamId, quarter, epic }: RisksPanelProps) {
  const addRisk = useQuarterStore((s) => s.addRisk);
  const updateRisk = useQuarterStore((s) => s.updateRisk);
  const removeRisk = useQuarterStore((s) => s.removeRisk);

  return (
    <div className="mt-2 ml-8 space-y-2">
      {epic.risks.map((risk) => (
        <div
          key={risk.id}
          className={`flex items-start gap-2 rounded border px-3 py-2 ${RISK_COLORS[risk.level]}`}
        >
          <select
            value={risk.level}
            onChange={(e) =>
              updateRisk(teamId, quarter.id, epic.id, risk.id, {
                level: e.target.value as RiskLevel,
              })
            }
            className="text-xs rounded border-0 bg-transparent font-medium focus:ring-0 cursor-pointer pr-6"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            value={risk.description}
            onChange={(e) =>
              updateRisk(teamId, quarter.id, epic.id, risk.id, {
                description: e.target.value,
              })
            }
            placeholder="Describe the risk…"
            className="flex-1 text-xs bg-transparent border-0 focus:ring-0 placeholder-current/50"
          />
          <button
            onClick={() => removeRisk(teamId, quarter.id, epic.id, risk.id)}
            className="text-xs opacity-60 hover:opacity-100 shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => addRisk(teamId, quarter.id, epic.id)}
        className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
      >
        + Add risk
      </button>
    </div>
  );
}

interface EpicRowProps {
  teamId: string;
  quarter: Quarter;
  epic: Epic;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  backlogEpics: BacklogEpicOption[];
  planningOption?: PlanningVersionOption;
  onAssignPlanningVersion: (issueKey: string, option: PlanningVersionOption, mode: 'add' | 'remove') => void;
  onSyncDependencyLink: (blockedIssueKey: string, blockerIssueKey: string, mode: 'add' | 'remove') => void;
  onSearchDependencies: (query: string, excludeIssueKey?: string) => Promise<DependencyCandidate[]>;
  onResolveExternalIssues: (issueKeys: string[]) => void;
  externalDependencyInfo: Record<string, DependencyCandidate>;
}

function EpicRow({
  teamId,
  quarter,
  epic,
  index,
  isFirst,
  isLast,
  backlogEpics,
  planningOption,
  onAssignPlanningVersion,
  onSyncDependencyLink,
  onSearchDependencies,
  onResolveExternalIssues,
  externalDependencyInfo,
}: EpicRowProps) {
  const updateEpic = useQuarterStore((s) => s.updateEpic);
  const removeEpic = useQuarterStore((s) => s.removeEpic);
  const moveEpicUp = useQuarterStore((s) => s.moveEpicUp);
  const moveEpicDown = useQuarterStore((s) => s.moveEpicDown);

  const [showRisks, setShowRisks] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showDeps, setShowDeps] = useState(false);

  const topLevel = highestRiskLevel(epic);
  const otherEpics = quarter.epics.filter((e) => e.id !== epic.id);

  // An Epic already assigned to a different row in this quarter is hidden from
  // this row's options so it can't be double-planned. Epics may repeat across
  // quarters (rollover: an Epic started but not finished in one quarter can be
  // continued in the next).
  const usedElsewhere = new Set(
    quarter.epics
      .filter((e) => e.id !== epic.id && e.issueKey)
      .map((e) => e.issueKey),
  );
  // Nothing is hidden — epics already tagged with this quarter's Planning Version
  // in Jira are just sorted first and marked, so the picker still shows everything.
  const availableBacklogEpics = backlogEpics
    .filter((be) => !usedElsewhere.has(be.issueKey))
    .slice()
    .sort((a, b) => {
      const aMatch = planningOption ? a.planningVersions.includes(planningOption.value) : false;
      const bMatch = planningOption ? b.planningVersions.includes(planningOption.value) : false;
      if (aMatch === bMatch) return 0;
      return aMatch ? -1 : 1;
    });

  return (
    <div className="border-t border-slate-100 py-2">
      <div className="flex items-center gap-2">
        {/* Order + move buttons */}
        <div className="flex flex-col items-center shrink-0 w-6">
          <button
            onClick={() => moveEpicUp(teamId, quarter.id, epic.id)}
            disabled={isFirst}
            className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none"
          >
            ▲
          </button>
          <span className="text-xs text-slate-400 leading-none my-0.5">{index + 1}</span>
          <button
            onClick={() => moveEpicDown(teamId, quarter.id, epic.id)}
            disabled={isLast}
            className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none"
          >
            ▼
          </button>
        </div>

        {/* Title */}
        <select
          value={epic.issueKey ?? ''}
          onChange={(e) => {
            const key = e.target.value;
            const chosen = backlogEpics.find((be) => be.issueKey === key);
            updateEpic(teamId, quarter.id, epic.id, {
              issueKey: key || undefined,
              title: chosen ? chosen.summary : epic.title,
              // Pre-fill size from the Epic's Jira T-Shirt Size field when it's set;
              // otherwise leave the current size selection untouched.
              ...(chosen?.suggestedSize ? { size: chosen.suggestedSize } : {}),
            });
            if (key && planningOption) {
              onAssignPlanningVersion(key, planningOption, 'add');
            }
          }}
          className="flex-1 text-sm border border-slate-200 rounded px-2 py-1.5 bg-white hover:border-slate-300 focus:border-slate-400 focus:outline-none"
        >
          <option value="">{epic.title || 'Select an Epic…'}</option>
          {availableBacklogEpics.map((be) => {
            const isMatch = planningOption ? be.planningVersions.includes(planningOption.value) : false;
            return (
              <option key={be.issueKey} value={be.issueKey}>
                {isMatch ? '★ ' : ''}
                {be.issueKey} — {be.summary}
              </option>
            );
          })}
        </select>

        {/* Size */}
        <select
          value={epic.size}
          onChange={(e) =>
            updateEpic(teamId, quarter.id, epic.id, { size: e.target.value as TShirtSize })
          }
          className="text-sm border border-slate-200 rounded px-2 py-1.5 bg-white shrink-0"
          title="T-shirt size"
        >
          {TSHIRT_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {TSHIRT_LABELS[s]}
            </option>
          ))}
        </select>

        {/* Dev allocation */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-slate-500">Devs:</span>
          <input
            type="number"
            min={1}
            value={epic.devAllocation}
            onChange={(e) =>
              updateEpic(teamId, quarter.id, epic.id, {
                devAllocation: Math.max(1, Number(e.target.value) || 1),
              })
            }
            className="w-14 text-sm border border-slate-200 rounded px-2 py-1.5 text-center"
          />
        </div>

        {/* QA allocation */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-slate-500">QA:</span>
          <input
            type="number"
            min={1}
            value={epic.qaAllocation}
            onChange={(e) =>
              updateEpic(teamId, quarter.id, epic.id, {
                qaAllocation: Math.max(1, Number(e.target.value) || 1),
              })
            }
            className="w-14 text-sm border border-slate-200 rounded px-2 py-1.5 text-center"
          />
        </div>

        {/* Risks badge */}
        <button
          onClick={() => setShowRisks((v) => !v)}
          className={`text-xs px-2 py-1.5 rounded border shrink-0 ${
            epic.risks.length === 0
              ? 'border-slate-200 text-slate-400 hover:bg-slate-50'
              : topLevel === 'high'
              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              : topLevel === 'medium'
              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
          title="Manage risks"
        >
          {epic.risks.length === 0
            ? '+ Risk'
            : `${epic.risks.length} risk${epic.risks.length > 1 ? 's' : ''}`}
          {topLevel && (
            <span className={`ml-1 ${RISK_BADGE_COLORS[topLevel]}`}>
              {topLevel === 'high' ? '!' : topLevel === 'medium' ? '~' : ''}
            </span>
          )}
        </button>

        {/* Dependencies */}
        {otherEpics.length > 0 && (
          <button
            onClick={() => setShowDeps((v) => !v)}
            className={`text-xs px-2 py-1.5 rounded border shrink-0 ${
              epic.dependencies.length > 0
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                : 'border-slate-200 text-slate-400 hover:bg-slate-50'
            }`}
            title="Manage dependencies"
          >
            {epic.dependencies.length > 0
              ? `${epic.dependencies.length} dep${epic.dependencies.length > 1 ? 's' : ''}`
              : '+ Dep'}
          </button>
        )}

        {/* Notes */}
        <button
          onClick={() => setShowNotes((v) => !v)}
          className={`text-xs px-2 py-1.5 rounded border shrink-0 ${
            epic.notes
              ? 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100'
              : 'border-slate-200 text-slate-400 hover:bg-slate-50'
          }`}
          title="Notes"
        >
          {epic.notes ? 'Notes' : '+ Note'}
        </button>

        {/* Delete */}
        <button
          onClick={() => {
            if (window.confirm(`Remove "${epic.title}"?`)) {
              if (epic.issueKey && planningOption) {
                onAssignPlanningVersion(epic.issueKey, planningOption, 'remove');
              }
              removeEpic(teamId, quarter.id, epic.id);
            }
          }}
          className="text-xs text-slate-400 hover:text-red-500 shrink-0 px-1"
          title="Remove Epic"
        >
          ✕
        </button>
      </div>

      {showRisks && (
        <RisksPanel teamId={teamId} quarter={quarter} epic={epic} />
      )}

      {showDeps && (
        <div className="mt-2 ml-8">
          <p className="text-xs text-slate-500 mb-1">
            Depends on (must complete before this starts):
          </p>
          <div className="flex flex-wrap gap-2">
            {otherEpics.map((other) => {
              const checked = epic.dependencies.includes(other.id);
              return (
                <label
                  key={other.id}
                  className={`flex items-center gap-1.5 text-xs rounded border px-2 py-1 cursor-pointer ${
                    checked
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const deps = e.target.checked
                        ? [...epic.dependencies, other.id]
                        : epic.dependencies.filter((d) => d !== other.id);
                      updateEpic(teamId, quarter.id, epic.id, { dependencies: deps });
                      if (epic.issueKey && other.issueKey) {
                        onSyncDependencyLink(epic.issueKey, other.issueKey, e.target.checked ? 'add' : 'remove');
                      }
                    }}
                    className="accent-indigo-600"
                  />
                  {other.title}
                </label>
              );
            })}
          </div>

          {epic.dependencies.filter((depId) => !otherEpics.some((o) => o.id === depId)).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {epic.dependencies
                .filter((depId) => !otherEpics.some((o) => o.id === depId))
                .map((depKey) => {
                  const info = externalDependencyInfo[depKey];
                  return (
                    <div
                      key={depKey}
                      className="flex items-center gap-1.5 text-xs rounded border border-purple-200 bg-purple-50 text-purple-800 px-2 py-1"
                    >
                      <span className="font-medium">{info?.issueKey ?? depKey}</span>
                      {info && <span className="text-purple-600 truncate max-w-[16rem]">— {info.summary}</span>}
                      {info && <DependencyCandidateBadges candidate={info} />}
                      <button
                        onClick={() => {
                          const deps = epic.dependencies.filter((d) => d !== depKey);
                          updateEpic(teamId, quarter.id, epic.id, { dependencies: deps });
                          if (epic.issueKey) onSyncDependencyLink(epic.issueKey, depKey, 'remove');
                        }}
                        className="opacity-60 hover:opacity-100 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
            </div>
          )}

          {epic.issueKey && (
            <DependencySearchBox
              excludeIssueKey={epic.issueKey}
              onSearchDependencies={onSearchDependencies}
              onSelect={(candidate) => {
                if (!epic.dependencies.includes(candidate.issueKey)) {
                  updateEpic(teamId, quarter.id, epic.id, {
                    dependencies: [...epic.dependencies, candidate.issueKey],
                  });
                }
                if (epic.issueKey) onSyncDependencyLink(epic.issueKey, candidate.issueKey, 'add');
                onResolveExternalIssues([candidate.issueKey]);
              }}
            />
          )}
        </div>
      )}

      {showNotes && (
        <div className="mt-2 ml-8">
          <textarea
            value={epic.notes}
            onChange={(e) =>
              updateEpic(teamId, quarter.id, epic.id, { notes: e.target.value })
            }
            placeholder="Add planning notes, scope details, open questions…"
            rows={2}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-y focus:outline-none focus:border-slate-400"
          />
        </div>
      )}
    </div>
  );
}

export default function EpicTable({
  teamId,
  quarter,
  backlogEpics,
  quarterOptions,
  onAssignPlanningVersion,
  onSyncDependencyLink,
  onSearchDependencies,
  onResolveExternalIssues,
  externalDependencyInfo,
}: Props) {
  const addEpic = useQuarterStore((s) => s.addEpic);

  const planningOption = quarterOptions.find(
    (o) => o.year === quarter.year && o.quarter === quarter.name,
  );

  return (
    <div>
      {(quarter.epics ?? []).length === 0 ? (
        <p className="text-sm text-slate-400 italic py-4">
          No Epics yet. Add one to start planning.
        </p>
      ) : (
        <div>
          {(quarter.epics ?? []).map((epic, i) => (
            <EpicRow
              key={epic.id}
              teamId={teamId}
              quarter={quarter}
              epic={epic}
              index={i}
              isFirst={i === 0}
              isLast={i === (quarter.epics ?? []).length - 1}
              backlogEpics={backlogEpics}
              planningOption={planningOption}
              onAssignPlanningVersion={onAssignPlanningVersion}
              onSyncDependencyLink={onSyncDependencyLink}
              onSearchDependencies={onSearchDependencies}
              onResolveExternalIssues={onResolveExternalIssues}
              externalDependencyInfo={externalDependencyInfo}
            />
          ))}
        </div>
      )}
      <div className="mt-3">
        <button
          onClick={() => addEpic(teamId, quarter.id)}
          className="text-sm px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-700"
        >
          + Add Epic
        </button>
      </div>
    </div>
  );
}
