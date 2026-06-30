import { describe, it, expect } from 'vitest';
import { buildFlowGrid } from '../engine/flowEngine';
import { computeDayMetrics, formatLoad, loadColor } from '../engine/metricsEngine';
import { makeDefaultTeam } from '../utils/defaults';

describe('metricsEngine.computeDayMetrics', () => {
  it('counts dev and qa demand per day', () => {
    const team = {
      ...makeDefaultTeam('T'),
      sprintLength: 4,
      defaultCapacity: { devs: 2, qa: 1 },
      backlog: [
        // 1pt: dev=1, qa=1
        { issueKey: 'A', summary: '', storyPoints: 1, startDay: 1 },
        { issueKey: 'B', summary: '', storyPoints: 1, startDay: 1 },
        { issueKey: 'C', summary: '', storyPoints: 1, startDay: 2 },
      ],
    };
    const grid = buildFlowGrid(team);
    const m = computeDayMetrics(grid, team);
    // Day 1: A,B in dev (devDemand=2, qaDemand=0)
    expect(m[0].devDemand).toBe(2);
    expect(m[0].qaDemand).toBe(0);
    // Day 2: A,B in qa, C in dev
    expect(m[1].devDemand).toBe(1);
    expect(m[1].qaDemand).toBe(2);
    // Day 3: C in qa
    expect(m[2].qaDemand).toBe(1);
  });

  it('uses capacity overrides when present', () => {
    const team = {
      ...makeDefaultTeam('T'),
      sprintLength: 2,
      defaultCapacity: { devs: 4, qa: 2 },
      capacityOverrides: { 1: { devs: 1 } },
      backlog: [
        { issueKey: 'A', summary: '', storyPoints: 1, startDay: 1 },
      ],
    };
    const grid = buildFlowGrid(team);
    const m = computeDayMetrics(grid, team);
    expect(m[0].devCapacity).toBe(1);
    expect(m[0].devLoad).toBe(1);
    expect(m[1].devCapacity).toBe(4);
  });

  it('returns Infinity load when capacity is 0 and demand > 0', () => {
    const team = {
      ...makeDefaultTeam('T'),
      sprintLength: 1,
      defaultCapacity: { devs: 0, qa: 0 },
      backlog: [{ issueKey: 'A', summary: '', storyPoints: 1, startDay: 1 }],
    };
    const grid = buildFlowGrid(team);
    const m = computeDayMetrics(grid, team);
    expect(m[0].devLoad).toBe(Infinity);
  });

  it('returns 0 load when both demand and capacity are 0', () => {
    const team = {
      ...makeDefaultTeam('T'),
      sprintLength: 1,
      defaultCapacity: { devs: 0, qa: 0 },
      backlog: [],
    };
    const grid = buildFlowGrid(team);
    const m = computeDayMetrics(grid, team);
    expect(m[0].devLoad).toBe(0);
  });
});

describe('metricsEngine.loadColor', () => {
  it('returns distinct classes for thresholds', () => {
    expect(loadColor(0)).toContain('slate');
    expect(loadColor(0.8)).toContain('emerald');
    expect(loadColor(1.0)).toContain('emerald');
    expect(loadColor(1.2)).toContain('amber');
    expect(loadColor(1.5)).toContain('red');
    expect(loadColor(Infinity)).toContain('red');
  });
});

describe('metricsEngine.formatLoad', () => {
  it('formats finite as 2 decimals', () => {
    expect(formatLoad(1.234)).toBe('1.23');
  });
  it('formats infinity', () => {
    expect(formatLoad(Infinity)).toBe('∞');
  });
});
