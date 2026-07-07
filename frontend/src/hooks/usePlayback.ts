import { useCallback, useRef, useEffect, useState } from 'react';
import * as Tone from 'tone';
import { NoteData } from '../types';
import { useProjectStore } from '../store/projectStore';

interface UsePlaybackOptions {
  bpm?: number;
  volume?: number;
}

const DURATION_TO_TONE: Record<string, string> = {
  whole: '1n',
  'half.': '2n.',
  half: '2n',
  'quarter.': '4n.',
  quarter: '4n',
  'eighth.': '8n.',
  eighth: '8n',
  sixteenth: '16n',
};

const DURATION_TO_BEATS: Record<string, number> = {
  whole: 4,
  'half.': 3,
  half: 2,
  'quarter.': 1.5,
  quarter: 1,
  'eighth.': 0.75,
  eighth: 0.5,
  sixteenth: 0.25,
};

export const usePlayback = (options: UsePlaybackOptions = {}) => {
  const { bpm = 120, volume = -12 } = options;

  const synthRef = useRef<Tone.Synth | null>(null);
  const metronomeRef = useRef<Tone.Loop | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(bpm);

  const setPlayingNoteId = useProjectStore((state) => state.setPlayingNoteId);
  const setStoreIsPlaying = useProjectStore((state) => state.setIsPlaying);

  // Initialize synth
  useEffect(() => {
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 },
    }).toDestination();
    synth.volume.value = volume;
    synthRef.current = synth;
    return () => { synth.dispose(); };
  }, [volume]);

  // Initialize metronome
  useEffect(() => {
    const metronomeSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0.05 },
    }).toDestination();
    metronomeSynth.volume.value = -15;

    const loop = new Tone.Loop((time) => {
      metronomeSynth.triggerAttackRelease('A4', '32n', time);
    }, '4n');

    metronomeRef.current = loop;
    return () => { loop.dispose(); metronomeSynth.dispose(); };
  }, []);

  const play = useCallback(
    (notes: NoteData[], playbackBpm: number = currentBpm) => {
      if (!synthRef.current) return;

      try {
        setCurrentBpm(playbackBpm);
        Tone.Transport.bpm.value = playbackBpm;

        const secsPerBeat = 60 / playbackBpm;
        let endTime = 0;

        notes.forEach((note) => {
          const timeInSecs = note.startBeat * secsPerBeat;
          const toneDuration = DURATION_TO_TONE[note.duration] ?? '4n';
          const durationBeats = DURATION_TO_BEATS[note.duration] ?? 1;
          const noteEnd = timeInSecs + durationBeats * secsPerBeat;
          if (noteEnd > endTime) endTime = noteEnd;

          // Highlight note when it starts
          Tone.Transport.schedule(() => {
            setPlayingNoteId(note.id);
          }, timeInSecs);

          // Clear highlight when note ends
          Tone.Transport.schedule(() => {
            setPlayingNoteId(null);
          }, noteEnd);

          if (note.pitch !== 'rest') {
            const velocity = Math.max(0, Math.min(1, (note.velocity ?? 80) / 127));
            Tone.Transport.schedule((time) => {
              synthRef.current!.triggerAttackRelease(note.pitch, toneDuration, time, velocity);
            }, timeInSecs);
          }
        });

        // Auto-stop when the last note finishes
        Tone.Transport.schedule(() => {
          Tone.Transport.stop();
          Tone.Transport.cancel();
          setTimeout(() => {
            setIsPlaying(false);
            setStoreIsPlaying(false);
          }, 0);
        }, endTime + 0.1);

        Tone.Transport.start();
        setIsPlaying(true);
        setStoreIsPlaying(true);
      } catch (error) {
        console.error('Playback error:', error);
      }
    },
    [currentBpm, setPlayingNoteId, setStoreIsPlaying]
  );

  const stop = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    setIsPlaying(false);
    setStoreIsPlaying(false);
    setPlayingNoteId(null);
  }, [setPlayingNoteId, setStoreIsPlaying]);

  const toggleMetronome = useCallback(() => {
    if (!metronomeRef.current) return;
    if (isMetronomeEnabled) {
      metronomeRef.current.stop();
      setIsMetronomeEnabled(false);
    } else {
      metronomeRef.current.start(0);
      setIsMetronomeEnabled(true);
    }
  }, [isMetronomeEnabled]);

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  return {
    play,
    stop,
    toggleMetronome,
    isPlaying,
    isMetronomeEnabled,
    currentBpm,
    setCurrentBpm: (newBpm: number) => {
      setCurrentBpm(newBpm);
      Tone.Transport.bpm.value = newBpm;
    },
  };
};
