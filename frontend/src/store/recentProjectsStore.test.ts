import { beforeEach, describe, expect, it } from 'vitest';
import { useRecentProjectsStore } from './recentProjectsStore';

describe('recentProjectsStore', () => {
  beforeEach(() => {
    useRecentProjectsStore.getState().clearRecents();
  });

  it('adds entries with the newest first', () => {
    useRecentProjectsStore.getState().addRecent('a.melody');
    useRecentProjectsStore.getState().addRecent('b.melody');
    expect(useRecentProjectsStore.getState().recents.map((r) => r.name)).toEqual([
      'b.melody',
      'a.melody',
    ]);
  });

  it('dedupes by name, moving the entry to the top', () => {
    useRecentProjectsStore.getState().addRecent('a.melody');
    useRecentProjectsStore.getState().addRecent('b.melody');
    useRecentProjectsStore.getState().addRecent('a.melody');
    expect(useRecentProjectsStore.getState().recents.map((r) => r.name)).toEqual([
      'a.melody',
      'b.melody',
    ]);
  });

  it('caps the list at 5 entries', () => {
    for (let i = 0; i < 8; i++) {
      useRecentProjectsStore.getState().addRecent(`p${i}.melody`);
    }
    const names = useRecentProjectsStore.getState().recents.map((r) => r.name);
    expect(names).toHaveLength(5);
    expect(names[0]).toBe('p7.melody');
  });

  it('clearRecents empties the list', () => {
    useRecentProjectsStore.getState().addRecent('a.melody');
    useRecentProjectsStore.getState().clearRecents();
    expect(useRecentProjectsStore.getState().recents).toEqual([]);
  });
});
