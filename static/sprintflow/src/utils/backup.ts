import type { Team } from '../types';
import type { Quarter } from '../types/quarter';

export interface SprintFlowBackup {
  version: 1;
  exportedAt: string;
  team: Team;
  quarters: Quarter[];
}

export function createBackup(team: Team, quarters: Quarter[]): SprintFlowBackup {
  return { version: 1, exportedAt: new Date().toISOString(), team, quarters };
}

export function backupFilename(teamName: string): string {
  const safe = teamName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `sprintflow-${safe}.json`;
}

export function parseBackup(json: string): SprintFlowBackup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as Record<string, unknown>).version !== 1 ||
    typeof (data as Record<string, unknown>).team !== 'object' ||
    !Array.isArray((data as Record<string, unknown>).quarters)
  ) {
    throw new Error('File does not appear to be a SprintFlow backup (version 1).');
  }
  return data as SprintFlowBackup;
}
