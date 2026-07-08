import type { FlowGridData, FlowRow, Story, StoryStatus, Team } from '../types';
import { isDevHoliday, isQaHoliday } from './capacityDays';

export function computeStoryRow(story: Story, team: Team): FlowRow {
  if (story.override) {
    const cells: StoryStatus[] = Array.from(
      { length: team.sprintLength },
      (_, i) => story.overrideCells[i] ?? 'done',
    );
    return { story, cells, devEnd: 0, qaEnd: 0, hasCycleTime: true };
  }

  const cycle = team.cycleTimes[story.storyPoints];
  const hasCycleTime = !!cycle;
  let devRemaining = cycle?.dev ?? 0;
  let qaRemaining = cycle?.qa ?? 0;

  const startDay = Math.max(1, Math.floor(story.startDay || 1));

  const cells: StoryStatus[] = [];
  let devEnd = 0;
  let qaEnd = 0;

  for (let d = 1; d <= team.sprintLength; d++) {
    if (!hasCycleTime) {
      cells.push('unknown');
    } else if (d < startDay) {
      cells.push('idle');
    } else if (devRemaining > 0) {
      // A day-off (explicit 0 capacity override) pauses the phase without
      // shifting it — the story just resumes on the next working day.
      if (isDevHoliday(team, d)) {
        cells.push('idle');
      } else {
        cells.push('dev');
        devRemaining--;
        devEnd = d;
      }
    } else if (qaRemaining > 0) {
      if (isQaHoliday(team, d)) {
        cells.push('idle');
      } else {
        cells.push('qa');
        qaRemaining--;
        qaEnd = d;
      }
    } else {
      cells.push('done');
    }
  }

  return { story, cells, devEnd, qaEnd, hasCycleTime };
}

export function buildFlowGrid(team: Team): FlowGridData {
  const days = Array.from({ length: team.sprintLength }, (_, i) => i + 1);
  const rows = team.backlog.map((story) => computeStoryRow(story, team));
  return { days, rows };
}
