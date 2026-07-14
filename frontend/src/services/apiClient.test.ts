import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from './apiClient';
import type { Project } from '../types';

const project: Project = {
  version: '1.0',
  metadata: {
    title: 'Test',
    instrument: 'piano',
    tempo: 120,
    timeSignature: '4/4',
    key: 'C major',
  },
  notes: [
    {
      id: 'n1',
      pitch: 'C4',
      duration: 'quarter',
      startBeat: 0,
      measure: 1,
      velocity: 80,
      confidence: 1,
      theoryCorrected: false,
    },
  ],
};

describe('apiClient.exportMusicXml', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('serializes the payload in the backend\'s snake_case shape (B5)', async () => {
    let sentBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sentBody = JSON.parse(init.body as string);
        return new Response(new Blob(['<xml/>']), { status: 200 });
      })
    );

    await apiClient.exportMusicXml(project);

    expect(sentBody).not.toBeNull();
    const body = sentBody as unknown as Record<string, unknown>;
    const metadata = body.metadata as Record<string, unknown>;
    const notes = body.notes as Record<string, unknown>[];

    // The bug: these used to be sent as camelCase (timeSignature, startBeat,
    // theoryCorrected), which the Pydantic models reject with a 422 on the
    // missing required `start_beat` field.
    expect(metadata.time_signature).toBe('4/4');
    expect(metadata).not.toHaveProperty('timeSignature');
    expect(notes[0].start_beat).toBe(0);
    expect(notes[0].theory_corrected).toBe(false);
    expect(notes[0]).not.toHaveProperty('startBeat');
  });
});
