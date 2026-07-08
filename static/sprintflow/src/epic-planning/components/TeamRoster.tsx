import type { MemberRole } from '../../types';
import type { RosterMember } from '../types/quarter';

interface Props {
  members: RosterMember[];
  onUpdateRole: (memberId: string, role: MemberRole) => void;
}

const ROLES: { value: MemberRole; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'qa', label: 'QA' },
  { value: 'both', label: 'Both' },
];

export default function TeamRoster({ members, onUpdateRole }: Props) {
  if (members.length === 0) {
    return <p className="text-sm text-slate-400 italic">No members loaded from Jira.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Role determines whether a member's capacity counts toward Dev scheduling, QA
        scheduling, or both. Changes here are shared with SprintFlow's Config tab.
      </p>
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
                        onClick={() => onUpdateRole(member.id, value)}
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
    </div>
  );
}
