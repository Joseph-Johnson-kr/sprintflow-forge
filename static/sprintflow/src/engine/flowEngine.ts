import type { FlowGridData, FlowRow, Story, StoryStatus, Team } from '../types';

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
  const devDays = cycle?.dev ?? 0;
  const qaDays = cycle?.qa ?? 0;

  const startDay = Math.max(1, Math.floor(story.startDay || 1));
  const devEnd = startDay + devDays - 1;
  const qaEnd = devEnd + qaDays;

  const cells: StoryStatus[] = [];
  for (let d = 1; d <= team.sprintLength; d++) {
    if (!hasCycleTime) {
      cells.push('unknown');
    } else if (d < startDay) {
      cells.push('idle');
    } else if (d <= devEnd) {
      cells.push('dev');
    } else if (d <= qaEnd) {
      cells.push('qa');
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
