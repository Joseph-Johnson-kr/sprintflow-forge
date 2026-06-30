import type { Team } from '../types';
import { useTeamStore } from '../stores/teamStore';

interface Props {
  team: Team;
}

export default function CapacityEditor({ team }: Props) {
  const setDevsAreQAs = useTeamStore((s) => s.setDevsAreQAs);

  const members = team.members ?? [];
  const hasMembers = members.length > 0;

  return (
    <div className="space-y-4 max-w-md">
      {!hasMembers && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Add team members in the Team Members section above to set capacity.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-xs text-slate-600 block mb-1">Developers</span>
          <div className="flex items-center gap-2 h-8">
            <span className={`text-2xl font-semibold ${hasMembers ? 'text-slate-900' : 'text-slate-300'}`}>
              {team.defaultCapacity.devs}
            </span>
            <span className="text-xs text-slate-400">Dev + Both</span>
          </div>
        </div>

        <div>
          <span className="text-xs text-slate-600 block mb-1">QA</span>
          <div className="flex items-center gap-2 h-8">
            <span className={`text-2xl font-semibold ${hasMembers ? 'text-slate-900' : 'text-slate-300'}`}>
              {team.defaultCapacity.qa}
            </span>
            <span className="text-xs text-slate-400">QA + Both</span>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={team.devsAreQAs}
          onChange={(e) => setDevsAreQAs(team.id, e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-slate-900 cursor-pointer"
        />
        <span className="text-sm text-slate-700">Developers are also QAs</span>
      </label>
    </div>
  );
}
