import { useMemo, useRef, useState } from 'react';
import type { Story, Team, StoryStatus } from '../types';
import { buildFlowGrid } from '../engine/flowEngine';
import { computeDayMetrics, formatLoad, loadColor } from '../engine/metricsEngine';
import { useTeamStore } from '../stores/teamStore';
import { buildDayLabels } from '../utils/sprintDays';

interface Props {
  team: Team;
}

const STATUS_STYLES: Record<StoryStatus, string> = {
  idle: 'bg-slate-50',
  dev: 'bg-blue-200 text-blue-900',
  qa: 'bg-purple-200 text-purple-900',
  done: 'bg-emerald-50 text-emerald-700',
  unknown: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<StoryStatus, string> = {
  idle: '',
  dev: 'D',
  qa: 'Q',
  done: '✓',
  unknown: '?',
};

const CYCLE_STATUS: Record<StoryStatus, StoryStatus> = {
  done: 'dev',
  dev: 'qa',
  qa: 'idle',
  idle: 'done',
  unknown: 'dev',
};

const DEFAULT_STORY_COL_WIDTH = 192;
const MIN_STORY_COL_WIDTH = 120;
const MAX_STORY_COL_WIDTH = 800;
const MOVE_COL_WIDTH = 28;

export default function FlowGrid({ team }: Props) {
  const setCapacityOverride = useTeamStore((s) => s.setCapacityOverride);
  const updateStory = useTeamStore((s) => s.updateStory);
  const setRollover = useTeamStore((s) => s.setRollover);
  const moveStoryUp = useTeamStore((s) => s.moveStoryUp);
  const moveStoryDown = useTeamStore((s) => s.moveStoryDown);
  const grid = useMemo(() => buildFlowGrid(team), [team]);
  const metrics = useMemo(() => computeDayMetrics(grid, team), [grid, team]);
  const dayLabels = useMemo(
    () => buildDayLabels(team.sprintLength, team.sprintStartDay ?? 1),
    [team.sprintLength, team.sprintStartDay],
  );

  const [storyColWidth, setStoryColWidth] = useState(DEFAULT_STORY_COL_WIDTH);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const [collapsed, setCollapsed] = useState({
    devDemand: false,
    qaDemand: false,
    devCapacity: false,
    qaCapacity: false,
  });
  function toggle(key: keyof typeof collapsed) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: storyColWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.startX;
      const next = Math.max(
        MIN_STORY_COL_WIDTH,
        Math.min(MAX_STORY_COL_WIDTH, dragRef.current.startW + delta),
      );
      setStoryColWidth(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleOverrideToggle(story: Story, enabled: boolean) {
    updateStory(team.id, story.issueKey, {
      override: enabled,
      overrideCells: enabled ? Array(team.sprintLength).fill('done') : [],
    });
  }

  function handleCellClick(story: Story, dayIndex: number, currentStatus: StoryStatus) {
    const next = CYCLE_STATUS[currentStatus];
    const newCells: StoryStatus[] = Array.from(
      { length: team.sprintLength },
      (_, i) => story.overrideCells[i] ?? 'done',
    );
    newCells[dayIndex] = next;
    updateStory(team.id, story.issueKey, { overrideCells: newCells });
  }

  const storyColStyle = {
    width: storyColWidth,
    minWidth: storyColWidth,
    maxWidth: storyColWidth,
    left: MOVE_COL_WIDTH,
  };

  const rowCount = grid.rows.length;

  if (grid.rows.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic px-3 py-6 border border-dashed border-slate-300 rounded text-center">
        No stories to plot. Add stories to see the flow grid.
      </div>
    );
  }

  const TOGGLE_LABELS: Record<keyof typeof collapsed, string> = {
    devDemand: 'Dev demand',
    qaDemand: 'QA demand',
    devCapacity: 'Dev capacity',
    qaCapacity: 'QA capacity',
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium">Show:</span>
        {(Object.keys(TOGGLE_LABELS) as (keyof typeof collapsed)[]).map((key) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              !collapsed[key]
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-400 border-slate-300 hover:border-slate-400 hover:text-slate-600'
            }`}
          >
            {TOGGLE_LABELS[key]}
          </button>
        ))}
      </div>
    <div className="border border-slate-200 rounded bg-white overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th
              className="sticky left-0 z-10 bg-slate-50"
              style={{ width: MOVE_COL_WIDTH, minWidth: MOVE_COL_WIDTH }}
            />
            <th
              className="text-left px-2 py-1.5 font-medium text-slate-600 sticky z-10 bg-slate-50 relative select-none"
              style={storyColStyle}
            >
              Story
              <div
                onMouseDown={onResizeMouseDown}
                onDoubleClick={() => setStoryColWidth(DEFAULT_STORY_COL_WIDTH)}
                className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400/60 active:bg-blue-500/80"
                title="Drag to resize · double-click to reset"
              />
            </th>
            <th className="px-2 py-1.5 font-medium text-slate-600 text-center">Override</th>
            <th className="px-2 py-1.5 font-medium text-slate-600 text-center">Rollover</th>
            <th className="px-2 py-1.5 font-medium text-slate-600 text-center">SP</th>
            {grid.days.map((d, i) => (
              <th
                key={d}
                className="px-2 py-1.5 font-medium text-slate-600 text-center min-w-[3.25rem]"
              >
                {dayLabels[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, rowIndex) => {
            const override = row.story.override ?? false;
            const rollover = row.story.rollover ?? false;
            return (
              <tr key={row.story.issueKey} className="border-b border-slate-100 group">
                {/* Move controls */}
                <td
                  className="sticky left-0 z-10 bg-white"
                  style={{ width: MOVE_COL_WIDTH, minWidth: MOVE_COL_WIDTH }}
                >
                  <div className="flex flex-col items-center justify-center h-full py-0.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveStoryUp(team.id, row.story.issueKey)}
                      disabled={rowIndex === 0}
                      className="text-slate-500 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-default leading-none transition-colors"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveStoryDown(team.id, row.story.issueKey)}
                      disabled={rowIndex === rowCount - 1}
                      className="text-slate-500 hover:text-slate-900 disabled:text-slate-300 disabled:cursor-default leading-none transition-colors"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                </td>

                {/* Story name */}
                <td
                  className={`px-2 py-1 sticky z-10 truncate ${
                    rollover ? 'bg-red-300 text-red-900' : 'bg-white'
                  }`}
                  style={storyColStyle}
                  title={row.story.summary}
                >
                  <span className={`font-mono text-[10px] ${rollover ? 'text-red-800' : 'text-slate-500'}`}>
                    {row.story.issueKey}
                  </span>{' '}
                  <span>{row.story.summary}</span>
                </td>

                {/* Override */}
                <td className="px-2 py-1 text-center border-l border-slate-100">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={(e) => handleOverrideToggle(row.story, e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer"
                    />
                    <span className={`font-medium ${override ? 'text-slate-900' : 'text-slate-400'}`}>
                      {override ? 'Y' : 'N'}
                    </span>
                  </label>
                </td>

                {/* Rollover */}
                <td className="px-2 py-1 text-center border-l border-slate-100">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rollover}
                      onChange={(e) =>
                        setRollover(team.id, row.story.issueKey, e.target.checked)
                      }
                      className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer"
                    />
                    <span className={`font-medium ${rollover ? 'text-red-700' : 'text-slate-400'}`}>
                      {rollover ? 'Y' : 'N'}
                    </span>
                  </label>
                </td>

                {/* SP */}
                <td className="px-2 py-1 text-center border-l border-slate-100 text-slate-600">
                  {override ? (
                    <span className="text-slate-400">N/A</span>
                  ) : (
                    row.story.storyPoints
                  )}
                </td>

                {/* Day cells */}
                {row.cells.map((status, i) => (
                  <td
                    key={i}
                    className={`text-center px-1 py-1 border-l border-slate-100 ${STATUS_STYLES[status]} ${
                      override ? 'cursor-pointer select-none hover:brightness-95 active:brightness-90' : ''
                    }`}
                    title={override ? 'Click to cycle: Done → Dev → QA → Idle → Done' : status}
                    onClick={
                      override
                        ? () => handleCellClick(row.story, i, status)
                        : undefined
                    }
                  >
                    {STATUS_LABEL[status]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {!collapsed.devDemand && (
            <SummaryRow
              label="Dev demand"
              values={metrics.map((m) => m.devDemand)}
              days={grid.days}
            />
          )}
          {!collapsed.qaDemand && (
            <SummaryRow
              label="QA demand"
              values={metrics.map((m) => m.qaDemand)}
              days={grid.days}
            />
          )}
          {!collapsed.devCapacity && (
            <CapacityRow
              label="Dev capacity"
              values={metrics.map((m) => m.devCapacity)}
              days={grid.days}
              onChange={(day, val) =>
                setCapacityOverride(
                  team.id,
                  day,
                  val === team.defaultCapacity.devs
                    ? null
                    : { ...team.capacityOverrides[day], devs: val },
                )
              }
              isOverride={(day) => team.capacityOverrides[day]?.devs !== undefined}
            />
          )}
          {!collapsed.qaCapacity && (
            <CapacityRow
              label="QA capacity"
              values={metrics.map((m) => m.qaCapacity)}
              days={grid.days}
              disabled={team.devsAreQAs}
              onChange={(day, val) =>
                setCapacityOverride(
                  team.id,
                  day,
                  val === team.defaultCapacity.qa
                    ? null
                    : { ...team.capacityOverrides[day], qa: val },
                )
              }
              isOverride={(day) => team.capacityOverrides[day]?.qa !== undefined}
            />
          )}
          <LoadRow
            label="Dev load"
            values={metrics.map((m) => m.devLoad)}
            days={grid.days}
          />
          <LoadRow
            label="QA load"
            values={metrics.map((m) => m.qaLoad)}
            days={grid.days}
          />
        </tfoot>
      </table>
    </div>
    </>
  );
}

function SummaryRow({
  label,
  values,
  days,
}: {
  label: string;
  values: number[];
  days: number[];
}) {
  return (
    <tr className="bg-slate-50 border-t border-slate-200">
      <td
        colSpan={5}
        className="px-2 py-1.5 sticky left-0 bg-slate-50 z-10 font-medium text-slate-700"
      >
        {label}
      </td>
      {days.map((_, i) => (
        <td key={i} className="text-center px-1 py-1.5 border-l border-slate-100 text-slate-700">
          {values[i]}
        </td>
      ))}
    </tr>
  );
}

function CapacityRow({
  label,
  values,
  days,
  disabled = false,
  onChange,
  isOverride,
}: {
  label: string;
  values: number[];
  days: number[];
  disabled?: boolean;
  onChange: (day: number, val: number) => void;
  isOverride: (day: number) => boolean;
}) {
  return (
    <tr className="bg-white border-t border-slate-100">
      <td
        colSpan={5}
        className="px-2 py-1 sticky left-0 bg-white z-10 font-medium text-slate-700"
      >
        {label}
      </td>
      {days.map((d, i) =>
        disabled ? (
          <td
            key={i}
            className="text-center px-0.5 py-1 border-l border-slate-100 text-slate-400 text-xs"
          >
            N/A
          </td>
        ) : (
          <td key={i} className="text-center px-0.5 py-1 border-l border-slate-100">
            <input
              type="number"
              min={0}
              value={values[i]}
              onChange={(e) => onChange(d, Math.max(0, Number(e.target.value)))}
              className={`w-12 px-1 py-0.5 border rounded text-xs text-center ${
                isOverride(d) ? 'border-amber-400 bg-amber-50' : 'border-slate-200'
              }`}
              title={isOverride(d) ? 'Override (set to default to clear)' : 'Default'}
            />
          </td>
        ),
      )}
    </tr>
  );
}

function LoadRow({
  label,
  values,
  days,
}: {
  label: string;
  values: number[];
  days: number[];
}) {
  return (
    <tr className="border-t border-slate-100">
      <td
        colSpan={5}
        className="px-2 py-1.5 sticky left-0 bg-white z-10 font-medium text-slate-700"
      >
        {label}
      </td>
      {days.map((_, i) => (
        <td
          key={i}
          className={`text-center px-1 py-1.5 border-l border-slate-100 font-medium ${loadColor(
            values[i],
          )}`}
        >
          {formatLoad(values[i])}
        </td>
      ))}
    </tr>
  );
}
