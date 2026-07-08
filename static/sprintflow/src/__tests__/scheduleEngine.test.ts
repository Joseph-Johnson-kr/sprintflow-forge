import { describe, it, expect } from 'vitest';
import { computeAutoSchedule } from '../engine/scheduleEngine';
import { makeDefaultTeam } from '../utils/defaults';
import type { Story, Team } from '../types';

function makeTeam(overrides: Partial<Team> = {}): Team {
  return { ...makeDefaultTeam('T'), ...overrides };
}

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    issueKey: 'T-1',
    summary: 'Test',
    storyPoints: 2,
    startDay: 1,
    rollover: false,
    override: false,
    overrideCells: [],
    dependencies: [],
    ...overrides,
  };
}

describe('scheduleEngine.computeAutoSchedule', () => {
  it('starts before a holiday and resumes after it, instead of pushing the whole story past it', () => {
    // 2pt: dev=2, qa=1. Day 2 is a holiday (explicit override to 0).
    const team = makeTeam({
      sprintLength: 6,
      defaultCapacity: { devs: 5, qa: 3 },
      capacityOverrides: { 2: { devs: 0, qa: 0 } },
      backlog: [makeStory({ issueKey: 'A' })],
    });
    const result = computeAutoSchedule(team);
    expect(result.startDays['A']).toBe(1);
    expect(result.overflow).toEqual([]);
  });

  it('still defers a story when a day is merely contended, not a holiday', () => {
    // Two 1pt stories (dev=1, qa=1) with only 1 dev seat/day — the second must wait.
    const team = makeTeam({
      sprintLength: 6,
      defaultCapacity: { devs: 1, qa: 1 },
      backlog: [makeStory({ issueKey: 'A', storyPoints: 1 }), makeStory({ issueKey: 'B', storyPoints: 1 })],
    });
    const result = computeAutoSchedule(team);
    expect(result.startDays['A']).toBe(1);
    expect(result.startDays['B']).toBeGreaterThan(1);
  });

  it('respects explicit dependencies', () => {
    const team = makeTeam({
      sprintLength: 10,
      defaultCapacity: { devs: 5, qa: 3 },
      backlog: [
        makeStory({ issueKey: 'A', storyPoints: 1 }),
        makeStory({ issueKey: 'B', storyPoints: 1, dependencies: ['A'] }),
      ],
    });
    const result = computeAutoSchedule(team);
    expect(result.startDays['B']).toBeGreaterThan(result.startDays['A']);
  });
});
