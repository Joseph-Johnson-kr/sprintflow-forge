import { describe, it, expect } from 'vitest';
import { parseCsv } from '../utils/csv';

describe('parseCsv', () => {
  it('parses standard Jira-style CSV', async () => {
    const text = 'Issue Key,Summary,Story Points\nABC-1,Login,3\nABC-2,Logout,5\n';
    const r = await parseCsv(text);
    expect(r.errors).toEqual([]);
    expect(r.stories).toHaveLength(2);
    expect(r.stories[0]).toMatchObject({
      issueKey: 'ABC-1',
      summary: 'Login',
      storyPoints: 3,
      startDay: 1,
    });
  });

  it('errors on missing required columns', async () => {
    const text = 'Foo,Bar\n1,2\n';
    const r = await parseCsv(text);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.stories).toEqual([]);
  });

  it('warns on duplicate keys and skips them', async () => {
    const text = 'Issue Key,Story Points\nABC-1,3\nABC-1,5\n';
    const r = await parseCsv(text);
    expect(r.stories).toHaveLength(1);
    expect(r.warnings.some((w) => w.includes('duplicate'))).toBe(true);
  });

  it('warns and defaults to 0 for invalid story points', async () => {
    const text = 'Issue Key,Story Points\nABC-1,not-a-number\n';
    const r = await parseCsv(text);
    expect(r.stories[0].storyPoints).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('accepts alternate column casing', async () => {
    const text = 'key,summary,sp\nA-1,X,2\n';
    const r = await parseCsv(text);
    expect(r.stories).toHaveLength(1);
    expect(r.stories[0].storyPoints).toBe(2);
  });
});
