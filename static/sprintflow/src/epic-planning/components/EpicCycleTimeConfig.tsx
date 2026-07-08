import CollapsibleSection from '../../components/CollapsibleSection';
import {
  QUARTER_NAME_OPTIONS,
  TSHIRT_SIZE_OPTIONS,
  type EpicCycleTimeSettings,
  type EpicDetailedCycleTimes,
  type EpicPhase,
  type EpicStatusConfig,
  type QuarterName,
} from '../types/quarter';

interface Props {
  epicStatuses: EpicStatusConfig[];
  epicCycleTimeSettings: EpicCycleTimeSettings;
  onSettingsChange: (s: EpicCycleTimeSettings) => void;
  epicDetailedCycleTimes?: EpicDetailedCycleTimes;
  onRecalculate: () => Promise<void>;
  recalculating?: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

type PhaseAssignment = EpicPhase | 'none';

const PHASE_OPTIONS: { value: PhaseAssignment; label: string; activeClass: string }[] = [
  { value: 'discovery', label: 'Discovery', activeClass: 'bg-amber-600 text-white' },
  { value: 'inProgress', label: 'In Progress', activeClass: 'bg-blue-600 text-white' },
  { value: 'acceptance', label: 'Acceptance', activeClass: 'bg-emerald-600 text-white' },
  { value: 'none', label: '—', activeClass: 'bg-slate-600 text-white' },
];

function EpicCycleTimeBreakdown({
  detail,
  epicStatuses,
}: {
  detail: EpicDetailedCycleTimes;
  epicStatuses: EpicStatusConfig[];
}) {
  const sizes = TSHIRT_SIZE_OPTIONS.filter((size) => detail[size]);

  if (sizes.length === 0) {
    return <p className="text-sm text-slate-400 italic">No data computed yet.</p>;
  }

  const activeStatuses = epicStatuses.filter((s) =>
    sizes.some((size) => (detail[size]?.[s.name] ?? 0) > 0),
  );

  return (
    <div className="border border-slate-200 rounded-lg overflow-x-auto">
      <table className="text-sm whitespace-nowrap">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Size</th>
            {activeStatuses.map((s) => (
              <th key={s.id} className="text-center text-xs font-semibold text-slate-500 px-3 py-2">
                {s.name}
              </th>
            ))}
            <th className="text-center text-xs font-semibold text-slate-500 px-3 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {sizes.map((size) => {
            const row = detail[size] ?? {};
            const total = activeStatuses.reduce((sum, s) => sum + (row[s.name] ?? 0), 0);
            return (
              <tr key={size} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5 font-medium text-slate-800">{size}</td>
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

function PhaseToggle({
  statusName,
  assignment,
  onChange,
}: {
  statusName: string;
  assignment: PhaseAssignment;
  onChange: (a: PhaseAssignment) => void;
}) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-1.5 text-sm text-slate-700 whitespace-nowrap">{statusName}</td>
      <td className="px-3 py-1">
        <span className="inline-flex rounded-md border border-slate-200 overflow-hidden">
          {PHASE_OPTIONS.map(({ value, label, activeClass }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={[
                'px-3 py-1 text-xs font-medium transition-colors',
                assignment === value ? activeClass : 'bg-white text-slate-600 hover:bg-slate-50',
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

export default function EpicCycleTimeConfig({
  epicStatuses,
  epicCycleTimeSettings,
  onSettingsChange,
  epicDetailedCycleTimes,
  onRecalculate,
  recalculating = false,
}: Props) {
  function getPhaseAssignment(statusName: string): PhaseAssignment {
    if (epicCycleTimeSettings.discoveryStatuses.includes(statusName)) return 'discovery';
    if (epicCycleTimeSettings.inProgressStatuses.includes(statusName)) return 'inProgress';
    if (epicCycleTimeSettings.acceptanceStatuses.includes(statusName)) return 'acceptance';
    return 'none';
  }

  function handlePhaseChange(statusName: string, assignment: PhaseAssignment) {
    const discoveryStatuses = epicCycleTimeSettings.discoveryStatuses.filter((s) => s !== statusName);
    const inProgressStatuses = epicCycleTimeSettings.inProgressStatuses.filter((s) => s !== statusName);
    const acceptanceStatuses = epicCycleTimeSettings.acceptanceStatuses.filter((s) => s !== statusName);
    if (assignment === 'discovery') discoveryStatuses.push(statusName);
    if (assignment === 'inProgress') inProgressStatuses.push(statusName);
    if (assignment === 'acceptance') acceptanceStatuses.push(statusName);
    onSettingsChange({ ...epicCycleTimeSettings, discoveryStatuses, inProgressStatuses, acceptanceStatuses });
  }

  return (
    <CollapsibleSection
      title="Cycle times"
      subtitle="Calculates average time spent in each Epic workflow status from completed epics, per quarter. For review only — not yet used in the Epic Forecast."
    >
      {/* Year/Quarter + Recalculate */}
      <div className="flex items-center gap-3 mb-6">
        <select
          value={epicCycleTimeSettings.year}
          onChange={(e) => onSettingsChange({ ...epicCycleTimeSettings, year: Number(e.target.value) })}
          className="text-sm border border-slate-300 rounded px-2 py-1.5 bg-white"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={epicCycleTimeSettings.quarter}
          onChange={(e) =>
            onSettingsChange({ ...epicCycleTimeSettings, quarter: e.target.value as QuarterName })
          }
          className="text-sm border border-slate-300 rounded px-2 py-1.5 bg-white"
        >
          {QUARTER_NAME_OPTIONS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
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
      {epicDetailedCycleTimes ? (
        <div className="mb-6">
          <EpicCycleTimeBreakdown detail={epicDetailedCycleTimes} epicStatuses={epicStatuses} />
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic mb-6">
          No data yet — click "Recalculate from Jira" to compute from issue history.
        </p>
      )}

      {/* Phase assignment */}
      {epicStatuses.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Phase assignment</h3>
          <p className="text-xs text-slate-400 mb-3">
            Tag each Epic workflow status as Discovery, In Progress, or Acceptance. Changes apply
            immediately and are captured for review only.
          </p>
          <div className="border border-slate-200 rounded-lg overflow-hidden max-w-md mb-2">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Phase</th>
                </tr>
              </thead>
              <tbody>
                {epicStatuses.map((s) => (
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
    </CollapsibleSection>
  );
}
