import type { Quarter, TeamMember } from '../types/quarter';
import { useQuarterStore } from '../stores/quarterStore';

interface Props {
  teamId: string;
  quarter: Quarter;
}

export default function MemberCapacity({ teamId, quarter }: Props) {
  const setAbsence = useQuarterStore((s) => s.setAbsence);

  const members = quarter.members ?? [];
  const sprints = Array.from({ length: quarter.sprintCount }, (_, i) => i + 1);

  function getAbsenceDays(member: TeamMember, sprint: number): number {
    return member.absences.find((a) => a.sprintNumber === sprint)?.days ?? 0;
  }

  if (members.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic py-2">
        No team members found. Add members in the <strong>Config → Team Members</strong> section to begin capacity planning.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-sm w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-slate-500 py-2 pr-4 min-w-[160px]">
              Team Member
            </th>
            {sprints.map((s) => (
              <th
                key={s}
                className="text-center text-xs font-semibold text-slate-500 py-2 px-2 min-w-[56px]"
              >
                S{s}
              </th>
            ))}
            <th className="text-center text-xs font-semibold text-slate-500 py-2 px-2 min-w-[72px]">
              Avail Days
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const totalAvail = sprints.reduce(
              (sum, s) => sum + Math.max(0, 10 - getAbsenceDays(member, s)),
              0,
            );
            return (
              <tr key={member.id} className="border-t border-slate-100">
                <td className="py-1.5 pr-4 text-sm text-slate-700 font-medium">
                  {member.name}
                </td>
                {sprints.map((s) => {
                  const days = getAbsenceDays(member, s);
                  return (
                    <td key={s} className="px-2 py-1.5 text-center">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={days === 0 ? '' : days}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                          setAbsence(teamId, quarter.id, member.id, s, val);
                        }}
                        className={`w-12 text-center text-sm border rounded px-1 py-0.5 ${
                          days > 0
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-white text-slate-400'
                        }`}
                        title={days > 0 ? `${days} days absent in Sprint ${s}` : `No absence in Sprint ${s}`}
                      />
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center text-xs font-medium text-slate-600">
                  {totalAvail}d
                </td>
              </tr>
            );
          })}

          {/* Total row */}
          <tr className="border-t border-slate-200 bg-slate-50">
            <td className="py-1.5 pr-4 text-xs font-semibold text-slate-500">
              Available Devs / Sprint
            </td>
            {sprints.map((s) => {
              const avail = members.reduce((sum, m) => {
                const days = getAbsenceDays(m, s);
                return sum + (days >= 10 ? 0 : 1);
              }, 0);
              return (
                <td
                  key={s}
                  className="px-2 py-1.5 text-center text-xs font-medium text-slate-700"
                >
                  {avail}
                </td>
              );
            })}
            <td />
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-400">
        Enter days absent per sprint (0–10). Members are managed in Config → Team Members.
      </p>
    </div>
  );
}
