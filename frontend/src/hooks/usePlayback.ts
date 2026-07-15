import { useCallback, useRef, useEffect, useState } from 'react';
import * as Tone from 'tone';
import { NoteData } from '../types';
import { useProjectStore } from '../store/projectStore';

const SAMPLED_INSTRUMENTS = ['piano', 'violin', 'guitar'] as const;
type SampledInstrument = (typeof SAMPLED_INSTRUMENTS)[number];

function toSampledInstrument(instrument: string | undefined): SampledInstrument {
  return (SAMPLED_INSTRUMENTS as readonly string[]).includes(instrument ?? '')
    ? (instrument as SampledInstrument)
    : 'piano';
}

interface UsePlaybackOptions {
  bpm?: number;
  volume?: number;
  /** Selects which sampled instrument voice to use (U50). Defaults to piano;
   * ProjectMetadata.instrument is a loose `string`, so unknown values fall
   * back rather than failing to load samples. */
  instrument?: string;
}

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

// Sparse note set (major thirds, C2-C7) that Tone.Sampler pitch-shifts
// between — keeps the asset bundle small (~1.1MB for all 3 instruments)
// while staying within a couple of semitones of any note it plays (U50).
const SAMPLE_NOTES = [
  'C2', 'E2', 'Ab2', 'C3', 'E3', 'Ab3', 'C4', 'E4', 'Ab4',
  'C5', 'E5', 'Ab5', 'C6', 'E6', 'Ab6', 'C7',
];

function sampleUrls(): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const note of SAMPLE_NOTES) urls[note] = `${note}.mp3`;
  return urls;
}

// A note shortens under staccato and lengthens slightly under legato so the
// articulation music21/segmentation_service already detects is audible,
// not just visible in the score (U50).
const ARTICULATION_SCALE: Record<string, number> = {
  staccato: 0.5,
  legato: 1.15,
};

export const usePlayback = (options: UsePlaybackOptions = {}) => {
  const { bpm = 120, volume = -12 } = options;
  const instrument = toSampledInstrument(options.instrument);

  // Fallback synth: used immediately and while a sampler is still loading,
  // so playback never silently does nothing (U50).
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const metronomeRef = useRef<Tone.Loop | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(bpm);

  const setPlayingNoteId = useProjectStore((state) => state.setPlayingNoteId);
  const setStoreIsPlaying = useProjectStore((state) => state.setIsPlaying);

  // Shared reverb bus — a little room ambience instead of the previous
  // perfectly dry synth (U50).
  useEffect(() => {
    const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.15 });
    reverb.toDestination();
    reverbRef.current = reverb;
    return () => { reverb.dispose(); };
  }, []);

  // Fallback synth
  useEffect(() => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 },
    });
    synth.volume.value = volume;
    if (reverbRef.current) synth.connect(reverbRef.current);
    synthRef.current = synth;
    return () => { synth.dispose(); };
  }, [volume]);

  // Real sampled instrument voice — swapped whenever the transcription's
  // instrument changes; the fallback synth above covers playback started
  // before the samples finish loading (U50).
  useEffect(() => {
    const sampler = new Tone.Sampler({
      urls: sampleUrls(),
      baseUrl: `${import.meta.env.BASE_URL}samples/${instrument}/`,
      release: 1,
      onload: () => {
        samplerRef.current = sampler;
      },
      onerror: () => {
        // Sampling failed to load (offline build, missing files) — keep
        // using the fallback synth silently.
      },
    });
    sampler.volume.value = volume;
    if (reverbRef.current) sampler.connect(reverbRef.current);

    return () => {
      if (samplerRef.current === sampler) samplerRef.current = null;
      sampler.dispose();
    };
  }, [instrument, volume]);

  // Initialize metronome (kept synthetic — a real click needs no realism)
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
      const voice = samplerRef.current ?? synthRef.current;
      if (!voice) return;

      try {
        setCurrentBpm(playbackBpm);
        Tone.Transport.bpm.value = playbackBpm;

        const secsPerBeat = 60 / playbackBpm;
        let endTime = 0;

        notes.forEach((note) => {
          const timeInSecs = note.startBeat * secsPerBeat;
          const durationBeats = DURATION_TO_BEATS[note.duration] ?? 1;
          const nominalDurationSecs = durationBeats * secsPerBeat;
          const articulationScale = note.articulation
            ? ARTICULATION_SCALE[note.articulation] ?? 1
            : 1;
          const soundingDurationSecs = nominalDurationSecs * articulationScale;
          const noteEnd = timeInSecs + nominalDurationSecs;
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
              (samplerRef.current ?? synthRef.current)?.triggerAttackRelease(
                note.pitch,
                soundingDurationSecs,
                time,
                velocity
              );
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
