import { useState } from 'react';
import type { MemberRole, Team } from '../types';
import CycleTimeEditor from './CycleTimeEditor';
import CapacityEditor from './CapacityEditor';
import { useTeamStore } from '../stores/teamStore';
import { useQuarterStore } from '../stores/quarterStore';
import { SPRINT_START_OPTIONS } from '../utils/sprintDays';
import { createBackup, backupFilename } from '../utils/backup';
import {
  isFileSystemAccessSupported,
  getDirectory,
  pickDirectory,
  writeToDirectory,
  downloadJson,
} from '../utils/backupFs';

interface Props {
  team: Team;
}

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'qa', label: 'QA' },
  { value: 'both', label: 'Both' },
];

function TeamMembersEditor({ team }: { team: Team }) {
  const addTeamMember = useTeamStore((s) => s.addTeamMember);
  const removeTeamMember = useTeamStore((s) => s.removeTeamMember);
  const updateTeamMember = useTeamStore((s) => s.updateTeamMember);

  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('dev');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const members = team.members ?? [];

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    addTeamMember(team.id, name, newRole);
    setNewName('');
    setNewRole('dev');
  }

  function startRename(id: string, currentName: string) {
    setEditingId(id);
    setEditingName(currentName);
  }

  function commitRename() {
    if (editingId && editingName.trim()) {
      updateTeamMember(team.id, editingId, { name: editingName.trim() });
    }
    setEditingId(null);
  }

  return (
    <div>
      {members.length === 0 ? (
        <p className="text-sm text-slate-400 italic mb-3">
          No members yet. Add your first team member below.
        </p>
      ) : (
        <div className="mb-3 border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2 w-28">Role</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    {editingId === member.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full border border-slate-300 rounded px-2 py-0.5 text-sm"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-indigo-600"
                        onDoubleClick={() => startRename(member.id, member.name)}
                        title="Double-click to rename"
                      >
                        {member.name}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateTeamMember(team.id, member.id, { role: e.target.value as MemberRole })
                      }
                      className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white"
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => removeTeamMember(team.id, member.id)}
                      className="text-xs text-slate-400 hover:text-red-500"
                      title="Remove member"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Member name"
          className="text-sm border border-slate-300 rounded px-2 py-1.5 w-44"
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value as MemberRole)}
          className="text-sm border border-slate-300 rounded px-2 py-1.5 bg-white"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="text-sm px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
        >
          + Add Member
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Dev and QA capacity for the Sprint tab are derived from member roles. Double-click a name to rename.
      </p>
    </div>
  );
}

export default function ConfigView({ team }: Props) {
  const setSprintLength = useTeamStore((s) => s.setSprintLength);
  const setSprintStartDay = useTeamStore((s) => s.setSprintStartDay);
  const quartersByTeam = useQuarterStore((s) => s.quartersByTeam);

  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    setExportStatus(null);
    try {
      const quarters = quartersByTeam[team.id] ?? [];
      const backup = createBackup(team, quarters);
      const filename = backupFilename(team.name);

      if (isFileSystemAccessSupported()) {
        let dir = await getDirectory();
        if (!dir) {
          dir = await pickDirectory();
        }
        if (dir) {
          await writeToDirectory(dir, filename, JSON.stringify(backup, null, 2));
          setExportStatus(`Saved "${filename}" to folder "${dir.name}"`);
        } else {
          // User cancelled the directory picker — fall back to download
          downloadJson(filename, backup);
          setExportStatus(`Downloaded "${filename}"`);
        }
      } else {
        downloadJson(filename, backup);
        setExportStatus(`Downloaded "${filename}"`);
      }
    } catch (err) {
      setExportStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{team.name} — Config</h1>
            <p className="text-sm text-slate-500 mt-1">
              Set cycle times by story points and default daily capacity.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="shrink-0 text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 disabled:opacity-40 flex items-center gap-1.5"
            title="Export this team's config, sprint backlog, and quarter data to a JSON backup"
          >
            <span>↓</span>
            <span>{exporting ? 'Saving…' : 'Export Team'}</span>
          </button>
        </div>
        {exportStatus && (
          <p className={`mt-2 text-xs ${exportStatus.startsWith('Export failed') ? 'text-red-600' : 'text-emerald-700'}`}>
            {exportStatus}
          </p>
        )}
      </header>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">
          Sprint settings
        </h2>
        <div className="grid grid-cols-2 gap-6 max-w-md">
          <label className="block">
            <span className="text-xs text-slate-600">Sprint Start Day</span>
            <select
              value={team.sprintStartDay ?? 1}
              onChange={(e) => setSprintStartDay(team.id, Number(e.target.value))}
              className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
            >
              {SPRINT_START_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Sprint Length</span>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={1}
                max={60}
                value={team.sprintLength}
                onChange={(e) => setSprintLength(team.id, Number(e.target.value))}
                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
              />
              <span className="text-sm text-slate-500 shrink-0">days</span>
            </div>
          </label>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">
          Team members
        </h2>
        <TeamMembersEditor team={team} />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">
          Cycle times
        </h2>
        <CycleTimeEditor team={team} />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">
          Default capacity
        </h2>
        <CapacityEditor team={team} />
      </section>
    </div>
  );
}
