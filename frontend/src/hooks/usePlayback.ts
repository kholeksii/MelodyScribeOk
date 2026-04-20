import { useCallback, useRef, useEffect, useState } from 'react';
import * as Tone from 'tone';
import { NoteData } from '../types';

interface UsePlaybackOptions {
  bpm?: number;
  volume?: number;
}

export const usePlayback = (options: UsePlaybackOptions = {}) => {
  const { bpm = 120, volume = -12 } = options;
  
  const synthRef = useRef<Tone.Synth | null>(null);
  const metronomeRef = useRef<Tone.Loop | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(bpm);

  // Initialize Tone.js and synth
  useEffect(() => {
    // Create synth with nice settings
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.3,
        release: 0.5,
      },
    }).toDestination();

    synth.volume.value = volume;
    synthRef.current = synth;

    // Cleanup
    return () => {
      synth.dispose();
    };
  }, [volume]);

  // Initialize metronome
  useEffect(() => {
    if (!synthRef.current) return;

    // Create a simple metronome synth with higher pitch
    const metronomesynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.005,
        decay: 0.05,
        sustain: 0,
        release: 0.05,
      },
    }).toDestination();

    metronomesynth.volume.value = -15; // Quieter than main synth

    // Create metronome loop (plays on each beat)
    const metronomLoop = new Tone.Loop((time) => {
      // Accent on beat 1 (higher pitch)
      const beatInMeasure = (Tone.Transport.ticks % (Tone.Transport.PPQ * 4)) / Tone.Transport.PPQ;
      const frequency = beatInMeasure === 0 ? 'A5' : 'A4';
      metronomesynth.triggerAttackRelease('32n', time);
    }, '4n'); // Every quarter note

    metronomesynth.triggerAttackRelease('A4', '32n');

    metronomeRef.current = metronomLoop;

    // Cleanup
    return () => {
      metronomLoop.dispose();
      metronomesynth.dispose();
    };
  }, []);

  // Map duration string to Tone.js duration format
  const mapDuration = (duration: string): string => {
    const durationMap: { [key: string]: string } = {
      whole: '1n',
      half: '2n',
      quarter: '4n',
      eighth: '8n',
      sixteenth: '16n',
    };
    return durationMap[duration] || '4n';
  };

  // Calculate beats from duration
  const durationToBeats = (duration: string): number => {
    const beatMap: { [key: string]: number } = {
      whole: 4,
      half: 2,
      quarter: 1,
      eighth: 0.5,
      sixteenth: 0.25,
    };
    return beatMap[duration] || 1;
  };

  // Play notes
  const play = useCallback(
    (notes: NoteData[], playbackBpm: number = currentBpm) => {
      if (!synthRef.current) return;

      try {
        setCurrentBpm(playbackBpm);
        Tone.Transport.bpm.value = playbackBpm;

        // Schedule all notes
        notes.forEach((note) => {
          if (note.pitch === 'rest') {
            // Skip rests
            return;
          }

          // Calculate time in seconds: beat * (60 / bpm)
          const timeInSeconds = (note.startBeat * 60) / playbackBpm;
          
          // Map duration to Tone.js format
          const toneDuration = mapDuration(note.duration);

          console.log(
            `🎵 Scheduling: ${note.pitch} at ${timeInSeconds.toFixed(2)}s, duration: ${toneDuration}`
          );

          // Schedule note
          Tone.Transport.schedule((time) => {
            synthRef.current!.triggerAttackRelease(note.pitch, toneDuration, time);
          }, timeInSeconds);
        });

        // Start transport
        Tone.Transport.start();
        setIsPlaying(true);

        console.log(`▶️  Playback started at ${playbackBpm} BPM`);
      } catch (error) {
        console.error('❌ Playback error:', error);
      }
    },
    [currentBpm]
  );

  // Stop playback
  const stop = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Clear all scheduled events
    setIsPlaying(false);
    console.log('⏹️  Playback stopped');
  }, []);

  // Toggle metronome
  const toggleMetronome = useCallback(() => {
    if (!metronomeRef.current) return;

    if (isMetronomeEnabled) {
      metronomeRef.current.stop();
      setIsMetronomeEnabled(false);
      console.log('🔇 Metronome disabled');
    } else {
      metronomeRef.current.start(0);
      setIsMetronomeEnabled(true);
      console.log('🔊 Metronome enabled');
    }
  }, [isMetronomeEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
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
