import { describe, it, expect, beforeEach } from 'vitest';
import { useTeamStore } from '../stores/teamStore';

beforeEach(() => {
  // Reset persisted state
  localStorage.clear();
  useTeamStore.setState({ teams: [], selectedTeamId: null });
});

describe('teamStore', () => {
  it('addTeam creates and selects when first', () => {
    const id = useTeamStore.getState().addTeam('Alpha');
    const s = useTeamStore.getState();
    expect(s.teams).toHaveLength(1);
    expect(s.selectedTeamId).toBe(id);
  });

  it('removeTeam reassigns selection', () => {
    const a = useTeamStore.getState().addTeam('A');
    const b = useTeamStore.getState().addTeam('B');
    useTeamStore.getState().selectTeam(a);
    useTeamStore.getState().removeTeam(a);
    expect(useTeamStore.getState().selectedTeamId).toBe(b);
  });

  it('setBacklog and updateStory work', () => {
    const id = useTeamStore.getState().addTeam('A');
    useTeamStore.getState().setBacklog(id, [
      { issueKey: 'X-1', summary: 's', storyPoints: 3, startDay: 1 },
    ]);
    useTeamStore.getState().updateStory(id, 'X-1', { startDay: 5 });
    const story = useTeamStore.getState().teams[0].backlog[0];
    expect(story.startDay).toBe(5);
  });

  it('removeStory drops the story', () => {
    const id = useTeamStore.getState().addTeam('A');
    useTeamStore.getState().setBacklog(id, [
      { issueKey: 'X-1', summary: 's', storyPoints: 3, startDay: 1 },
      { issueKey: 'X-2', summary: 's', storyPoints: 1, startDay: 1 },
    ]);
    useTeamStore.getState().removeStory(id, 'X-1');
    expect(useTeamStore.getState().teams[0].backlog).toHaveLength(1);
  });

  it('setCapacityOverride and clear', () => {
    const id = useTeamStore.getState().addTeam('A');
    useTeamStore.getState().setCapacityOverride(id, 3, { devs: 1 });
    expect(useTeamStore.getState().teams[0].capacityOverrides[3]).toEqual({ devs: 1 });
    useTeamStore.getState().setCapacityOverride(id, 3, null);
    expect(useTeamStore.getState().teams[0].capacityOverrides[3]).toBeUndefined();
  });

  it('setSprintLength clamps to >= 1', () => {
    const id = useTeamStore.getState().addTeam('A');
    useTeamStore.getState().setSprintLength(id, 0);
    expect(useTeamStore.getState().teams[0].sprintLength).toBe(1);
  });

  it('removeCycleTime drops the SP key', () => {
    const id = useTeamStore.getState().addTeam('A');
    useTeamStore.getState().removeCycleTime(id, 5);
    expect(useTeamStore.getState().teams[0].cycleTimes[5]).toBeUndefined();
  });
});
