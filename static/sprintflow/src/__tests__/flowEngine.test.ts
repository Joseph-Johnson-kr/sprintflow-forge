import { describe, it, expect } from 'vitest';
import { buildFlowGrid, computeStoryRow } from '../engine/flowEngine';
import { makeDefaultTeam } from '../utils/defaults';
import type { Story, Team } from '../types';

function makeTeam(overrides: Partial<Team> = {}): Team {
  return { ...makeDefaultTeam('T'), ...overrides };
}

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    issueKey: 'T-1',
    summary: 'Test',
    storyPoints: 3,
    startDay: 1,
    ...overrides,
  };
}

describe('flowEngine.computeStoryRow', () => {
  it('marks dev then qa then done', () => {
    // 3pt: dev=3, qa=1
    const team = makeTeam({ sprintLength: 6 });
    const row = computeStoryRow(makeStory({ storyPoints: 3, startDay: 1 }), team);
    expect(row.cells).toEqual(['dev', 'dev', 'dev', 'qa', 'done', 'done']);
    expect(row.devEnd).toBe(3);
    expect(row.qaEnd).toBe(4);
  });

  it('marks idle days before startDay', () => {
    const team = makeTeam({ sprintLength: 6 });
    const row = computeStoryRow(makeStory({ storyPoints: 1, startDay: 3 }), team);
    // 1pt: dev=1, qa=1
    expect(row.cells).toEqual(['idle', 'idle', 'dev', 'qa', 'done', 'done']);
  });

  it('marks unknown when no cycle time configured', () => {
    const team = makeTeam({ sprintLength: 4, cycleTimes: {} });
    const row = computeStoryRow(makeStory({ storyPoints: 5 }), team);
    expect(row.cells).toEqual(['unknown', 'unknown', 'unknown', 'unknown']);
    expect(row.hasCycleTime).toBe(false);
  });

  it('clamps startDay to at least 1', () => {
    const team = makeTeam({ sprintLength: 3 });
    const row = computeStoryRow(makeStory({ storyPoints: 1, startDay: 0 }), team);
    expect(row.cells[0]).toBe('dev');
  });
});

describe('flowEngine.buildFlowGrid', () => {
  it('returns empty rows for empty backlog', () => {
    const team = makeTeam({ sprintLength: 5 });
    const grid = buildFlowGrid(team);
    expect(grid.days).toEqual([1, 2, 3, 4, 5]);
    expect(grid.rows).toEqual([]);
  });

  it('builds rows for each story', () => {
    const team = makeTeam({
      sprintLength: 4,
      backlog: [
        makeStory({ issueKey: 'A', storyPoints: 1, startDay: 1 }),
        makeStory({ issueKey: 'B', storyPoints: 2, startDay: 2 }),
      ],
    });
    const grid = buildFlowGrid(team);
    expect(grid.rows).toHaveLength(2);
    expect(grid.rows[0].story.issueKey).toBe('A');
  });
});
