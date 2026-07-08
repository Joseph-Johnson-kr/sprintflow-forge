import { useState } from 'react';
import type { Story, Team } from '../types';
import { useTeamStore } from '../stores/teamStore';

interface Props {
  team: Team;
}

const COLUMN_COUNT = 8;

interface StoryRowProps {
  team: Team;
  story: Story;
}

function StoryRow({ team, story }: StoryRowProps) {
  const updateStory = useTeamStore((s) => s.updateStory);
  const setRollover = useTeamStore((s) => s.setRollover);
  const removeStory = useTeamStore((s) => s.removeStory);

  const [showDeps, setShowDeps] = useState(false);

  const override = story.override ?? false;
  const rollover = story.rollover ?? false;
  const hasCycleTime = override || !!team.cycleTimes[story.storyPoints];
  const otherStories = team.backlog.filter((s) => s.issueKey !== story.issueKey);

  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="px-3 py-2 font-mono text-xs">{story.issueKey}</td>
        <td className="px-3 py-2 max-w-md truncate" title={story.summary}>
          {story.summary}
        </td>

        {/* Override */}
        <td className="px-3 py-2 text-center">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={override}
              onChange={(e) => {
                const enabled = e.target.checked;
                updateStory(team.id, story.issueKey, {
                  override: enabled,
                  overrideCells: enabled
                    ? Array(team.sprintLength).fill('done')
                    : [],
                });
              }}
              className="w-4 h-4 rounded border-slate-300 cursor-pointer"
            />
            <span className={`text-xs font-medium ${override ? 'text-slate-900' : 'text-slate-400'}`}>
              {override ? 'Y' : 'N'}
            </span>
          </label>
        </td>

        {/* Rollover */}
        <td className="px-3 py-2 text-center">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={rollover}
              onChange={(e) =>
                setRollover(team.id, story.issueKey, e.target.checked)
              }
              className="w-4 h-4 rounded border-slate-300 cursor-pointer"
            />
            <span className={`text-xs font-medium ${rollover ? 'text-red-700' : 'text-slate-400'}`}>
              {rollover ? 'Y' : 'N'}
            </span>
          </label>
        </td>

        {/* SP */}
        <td className="px-3 py-2">
          {override ? (
            <span className="text-slate-400 text-xs">N/A</span>
          ) : (
            <span
              className={hasCycleTime ? '' : 'text-red-600 font-medium'}
              title={hasCycleTime ? '' : 'No cycle time configured for this SP'}
            >
              {story.storyPoints}
              {!hasCycleTime && ' ⚠'}
            </span>
          )}
        </td>

        {/* Start Day */}
        <td className="px-3 py-2">
          <input
            type="number"
            min={1}
            max={team.sprintLength}
            value={story.startDay}
            disabled={override}
            onChange={(e) =>
              updateStory(team.id, story.issueKey, {
                startDay: Math.max(1, Number(e.target.value)),
              })
            }
            className={`w-16 px-2 py-1 border rounded ${
              override
                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'border-slate-300'
            }`}
          />
        </td>

        {/* Dependencies */}
        <td className="px-3 py-2 text-center">
          {otherStories.length > 0 && (
            <button
              onClick={() => setShowDeps((v) => !v)}
              className={`text-xs px-2 py-1 rounded border ${
                story.dependencies.length > 0
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  : 'border-slate-200 text-slate-400 hover:bg-slate-50'
              }`}
              title="Manage dependencies"
            >
              {story.dependencies.length > 0
                ? `${story.dependencies.length} dep${story.dependencies.length > 1 ? 's' : ''}`
                : '+ Dep'}
            </button>
          )}
        </td>

        <td className="px-3 py-2 text-right">
          <button
            onClick={() => removeStory(team.id, story.issueKey)}
            className="text-xs text-slate-400 hover:text-red-600"
          >
            Remove
          </button>
        </td>
      </tr>

      {showDeps && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={COLUMN_COUNT} className="px-3 py-2">
            <p className="text-xs text-slate-500 mb-1">
              Depends on (must complete before this starts):
            </p>
            <div className="flex flex-wrap gap-2">
              {otherStories.map((other) => {
                const checked = story.dependencies.includes(other.issueKey);
                return (
                  <label
                    key={other.issueKey}
                    className={`flex items-center gap-1.5 text-xs rounded border px-2 py-1 cursor-pointer ${
                      checked
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const deps = e.target.checked
                          ? [...story.dependencies, other.issueKey]
                          : story.dependencies.filter((d) => d !== other.issueKey);
                        updateStory(team.id, story.issueKey, { dependencies: deps });
                      }}
                      className="accent-indigo-600"
                    />
                    <span className="font-mono">{other.issueKey}</span> {other.summary}
                  </label>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function BacklogTable({ team }: Props) {
  if (team.backlog.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic px-3 py-6 border border-dashed border-slate-300 rounded text-center">
        No issues found in the Jira backlog.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Key</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Summary</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Override</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Rollover</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">SP</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Start day</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Deps</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {team.backlog.map((story) => (
            <StoryRow key={story.issueKey} team={team} story={story} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
