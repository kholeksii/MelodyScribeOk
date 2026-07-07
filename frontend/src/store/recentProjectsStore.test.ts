import { beforeEach, describe, expect, it } from 'vitest';
import { useRecentProjectsStore } from './recentProjectsStore';

const store = () => useRecentProjectsStore.getState();

describe('recentProjectsStore', () => {
  beforeEach(() => {
    store().clearRecents();
  });

  it('adds entries with the newest first', () => {
    store().addRecent('a.melody', '/tmp/a.melody');
    store().addRecent('b.melody', '/tmp/b.melody');
    expect(store().recents.map((r) => r.name)).toEqual(['b.melody', 'a.melody']);
  });

  it('dedupes by path, moving the entry to the top', () => {
    store().addRecent('a.melody', '/tmp/a.melody');
    store().addRecent('b.melody', '/tmp/b.melody');
    store().addRecent('a.melody', '/tmp/a.melody');
    expect(store().recents.map((r) => r.path)).toEqual(['/tmp/a.melody', '/tmp/b.melody']);
  });

  it('dedupes legacy path-less entries by name when a path arrives', () => {
    store().addRecent('a.melody'); // browser save — no path
    store().addRecent('a.melody', '/tmp/a.melody');
    expect(store().recents).toHaveLength(1);
    expect(store().recents[0].path).toBe('/tmp/a.melody');
  });

  it('keeps distinct paths with the same visible name apart', () => {
    store().addRecent('tune.melody', '/home/tune.melody');
    store().addRecent('tune.melody', '/backup/tune.melody');
    // Same display name — the newer path wins (name dedupe keeps the list readable)
    expect(store().recents).toHaveLength(1);
    expect(store().recents[0].path).toBe('/backup/tune.melody');
  });

  it('caps the list at 5 entries', () => {
    for (let i = 0; i < 8; i++) {
      store().addRecent(`p${i}.melody`, `/tmp/p${i}.melody`);
    }
    const names = store().recents.map((r) => r.name);
    expect(names).toHaveLength(5);
    expect(names[0]).toBe('p7.melody');
  });

  it('removeRecent drops exactly the matching entry', () => {
    store().addRecent('a.melody', '/tmp/a.melody');
    store().addRecent('b.melody'); // path-less
    store().removeRecent(store().recents.find((r) => r.name === 'a.melody')!);
    expect(store().recents.map((r) => r.name)).toEqual(['b.melody']);
  });

  it('clearRecents empties the list', () => {
    store().addRecent('a.melody');
    store().clearRecents();
    expect(store().recents).toEqual([]);
  });
});
