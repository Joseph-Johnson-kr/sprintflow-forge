import type { BoardStatusConfig, CycleTimeSettings, DetailedCycleTimes, MemberRole, Team } from '../types';
import CycleTimeEditor from './CycleTimeEditor';
import CapacityEditor from './CapacityEditor';
import { useTeamStore } from '../stores/teamStore';
import { SPRINT_START_OPTIONS } from '../utils/sprintDays';

interface Props {
  team: Team;
  boardStatuses: BoardStatusConfig[];
  cycleTimeSettings: CycleTimeSettings;
  onCycleTimeSettingsChange: (s: CycleTimeSettings) => void;
  onRecalculate: () => Promise<void>;
  recalculating?: boolean;
}

const ROLES: { value: MemberRole; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'qa', label: 'QA' },
  { value: 'both', label: 'Both' },
];

function TeamMembersEditor({ team }: { team: Team }) {
  const updateMemberRole = useTeamStore((s) => s.updateMemberRole);
  const members = team.members ?? [];

  if (members.length === 0) {
    return <p className="text-sm text-slate-400 italic">No members loaded from Jira.</p>;
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Name</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Role</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-t border-slate-100">
              <td className="px-3 py-1.5 text-slate-800 whitespace-nowrap">{member.name}</td>
              <td className="px-3 py-1">
                <span className="inline-flex rounded-md border border-slate-200 overflow-hidden">
                  {ROLES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateMemberRole(team.id, member.id, value)}
                      className={[
                        'px-3 py-1 text-xs font-medium transition-colors',
                        member.role === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50',
                        'border-r border-slate-200 last:border-r-0',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CycleTimeBreakdown({
  detail,
  boardStatuses,
}: {
  detail: DetailedCycleTimes;
  boardStatuses: BoardStatusConfig[];
}) {
  const spValues = Object.keys(detail)
    .map(Number)
    .sort((a, b) => a - b);

  if (spValues.length === 0) {
    return <p className="text-sm text-slate-400 italic">No data computed yet.</p>;
  }

  // Only show status columns that have at least one non-zero value
  const activeStatuses = boardStatuses.filter((bs) =>
    spValues.some((sp) => (detail[sp]?.[bs.name] ?? 0) > 0),
  );

  return (
    <div className="border border-slate-200 rounded-lg overflow-x-auto">
      <table className="text-sm whitespace-nowrap">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">SP</th>
            {activeStatuses.map((s) => (
              <th key={s.id} className="text-center text-xs font-semibold text-slate-500 px-3 py-2">
                {s.name}
              </th>
            ))}
            <th className="text-center text-xs font-semibold text-slate-500 px-3 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {spValues.map((sp) => {
            const row = detail[sp] ?? {};
            const total = activeStatuses.reduce((sum, s) => sum + (row[s.name] ?? 0), 0);
            return (
              <tr key={sp} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5 font-medium text-slate-800">{sp}</td>
                {activeStatuses.map((s) => {
                  const val = row[s.name] ?? 0;
                  return (
                    <td key={s.id} className="px-3 py-1.5 text-center text-slate-700">
                      {val > 0 ? `${val}d` : <span className="text-slate-300">—</span>}
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-center font-semibold text-slate-800">
                  {total > 0 ? `${total}d` : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type PhaseAssignment = 'dev' | 'qa' | 'none';

function PhaseToggle({
  statusName,
  assignment,
  onChange,
}: {
  statusName: string;
  assignment: PhaseAssignment;
  onChange: (a: PhaseAssignment) => void;
}) {
  const options: { value: PhaseAssignment; label: string }[] = [
    { value: 'dev', label: 'Dev' },
    { value: 'qa', label: 'QA' },
    { value: 'none', label: '—' },
  ];
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-1.5 text-sm text-slate-700 whitespace-nowrap">{statusName}</td>
      <td className="px-3 py-1">
        <span className="inline-flex rounded-md border border-slate-200 overflow-hidden">
          {options.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={[
                'px-3 py-1 text-xs font-medium transition-colors',
                assignment === value
                  ? value === 'dev'
                    ? 'bg-blue-600 text-white'
                    : value === 'qa'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50',
                'border-r border-slate-200 last:border-r-0',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </span>
      </td>
    </tr>
  );
}

export default function ConfigView({
  team,
  boardStatuses,
  cycleTimeSettings,
  onCycleTimeSettingsChange,
  onRecalculate,
  recalculating = false,
}: Props) {
  const setDevsAreQAs = useTeamStore((s) => s.setDevsAreQAs);

  const sprintStartLabel =
    SPRINT_START_OPTIONS.find((o) => o.value === (team.sprintStartDay ?? 1))?.label ?? '—';

  function getPhaseAssignment(statusName: string): PhaseAssignment {
    if (cycleTimeSettings.devStatuses.includes(statusName)) return 'dev';
    if (cycleTimeSettings.qaStatuses.includes(statusName)) return 'qa';
    return 'none';
  }

  function handlePhaseChange(statusName: string, assignment: PhaseAssignment) {
    const devStatuses = cycleTimeSettings.devStatuses.filter((s) => s !== statusName);
    const qaStatuses = cycleTimeSettings.qaStatuses.filter((s) => s !== statusName);
    if (assignment === 'dev') devStatuses.push(statusName);
    if (assignment === 'qa') qaStatuses.push(statusName);
    onCycleTimeSettingsChange({ ...cycleTimeSettings, devStatuses, qaStatuses });
  }

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">{team.name} — Config</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sprint settings and team data are pulled from Jira automatically.
        </p>
      </header>

      {/* Sprint Settings */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">Sprint settings</h2>
        <div className="grid grid-cols-2 gap-6 max-w-md">
          <div>
            <span className="text-xs text-slate-600">Sprint Start Day</span>
            <p className="mt-1 text-sm text-slate-800 font-medium">{sprintStartLabel}</p>
            <p className="text-xs text-slate-400 mt-0.5">From Jira sprint</p>
          </div>
          <div>
            <span className="text-xs text-slate-600">Sprint Length</span>
            <p className="mt-1 text-sm text-slate-800 font-medium">{team.sprintLength} days</p>
            <p className="text-xs text-slate-400 mt-0.5">From Jira sprint</p>
          </div>
        </div>
      </section>

      {/* Team Members */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">Team members</h2>
        <p className="text-xs text-slate-400 mb-3">Names pulled from Jira. Toggle each member's role below.</p>
        <TeamMembersEditor team={team} />
        <label className="flex items-center gap-2 mt-4 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={team.devsAreQAs ?? false}
            onChange={(e) => setDevsAreQAs(team.id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 cursor-pointer"
          />
          <span className="text-sm text-slate-700">Developers are also QAs</span>
        </label>
        <p className="text-xs text-slate-400 mt-1 ml-6">
          When enabled, QA capacity is derived from Dev capacity in the flow grid.
        </p>
      </section>

      {/* Cycle Times */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">Cycle times</h2>
        <p className="text-xs text-slate-400 mb-4">
          Calculates average time spent in each workflow status from closed, completed issues with story
          points. Data is scoped to this team.
        </p>

        {/* Days back + Recalculate */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600 whitespace-nowrap">Days back</label>
            <input
              type="number"
              min={7}
              max={730}
              value={cycleTimeSettings.daysBack}
              onChange={(e) =>
                onCycleTimeSettingsChange({
                  ...cycleTimeSettings,
                  daysBack: Math.max(7, Number(e.target.value) || 60),
                })
              }
              className="w-20 text-sm border border-slate-200 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={onRecalculate}
            disabled={recalculating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
          >
            {recalculating ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Recalculating…
              </>
            ) : (
              'Recalculate from Jira'
            )}
          </button>
        </div>

        {/* Breakdown table */}
        <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Breakdown (from Jira)</h3>
        {team.detailedCycleTimes ? (
          <div className="mb-6">
            <CycleTimeBreakdown
              detail={team.detailedCycleTimes}
              boardStatuses={boardStatuses}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic mb-6">
            No data yet — click "Recalculate from Jira" to compute from issue history.
          </p>
        )}

        {/* Phase assignment */}
        {boardStatuses.length > 0 && (
          <>
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Phase assignment</h3>
            <p className="text-xs text-slate-400 mb-3">
              Tag each status as Dev or QA to determine how cycle times roll up into the flow grid.
              Changes apply immediately.
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden max-w-sm mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Phase</th>
                  </tr>
                </thead>
                <tbody>
                  {boardStatuses.map((s) => (
                    <PhaseToggle
                      key={s.id}
                      statusName={s.name}
                      assignment={getPhaseAssignment(s.name)}
                      onChange={(a) => handlePhaseChange(s.name, a)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Manual override via CycleTimeEditor */}
        <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
          Flow grid estimates (derived · editable)
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Derived from the phase assignment above. Edit individual values to override.
        </p>
        <CycleTimeEditor team={team} />
      </section>

      {/* Default Capacity */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">Default capacity</h2>
        <p className="text-xs text-slate-400 mb-3">
          Derived from team membership. Override individual days in the Sprint flow grid.
        </p>
        <CapacityEditor team={team} />
      </section>
    </div>
  );
}
