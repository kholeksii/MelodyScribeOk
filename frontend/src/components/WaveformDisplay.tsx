import React, { useEffect, useRef, useState } from 'react';
import { NoteData } from '../types';
import { useProjectStore } from '../store/projectStore';

const BASE_URL = 'http://localhost:8000/api';
const WAVEFORM_COLOR = '#94a3b8';    // slate-400
const ONSET_COLOR = '#3b82f6';       // blue-500
const PLAYHEAD_COLOR = '#16a34a';    // green-600
const CANVAS_HEIGHT = 96;

interface WaveformDisplayProps {
  notes: NoteData[];
  tempo: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({ notes, tempo }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFileId = useProjectStore((state) => state.audioFileId);
  const playingNoteId = useProjectStore((state) => state.playingNoteId);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  // Decode audio once when audioFileId changes
  useEffect(() => {
    if (!audioFileId) return;
    let cancelled = false;

    const decode = async () => {
      try {
        const res = await fetch(`${BASE_URL}/audio/${audioFileId}`);
        if (!res.ok) return;
        const arrayBuffer = await res.arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        // Downsample to at most 4000 points for performance
        const raw = decoded.getChannelData(0);
        const step = Math.max(1, Math.floor(raw.length / 4000));
        const down = new Float32Array(Math.floor(raw.length / step));
        for (let i = 0; i < down.length; i++) {
          down[i] = raw[i * step];
        }
        setSamples(down);
        setDurationSec(decoded.duration);
        ctx.close();
      } catch {
        // Silent fail — waveform is non-critical
      }
    };

    decode();
    return () => { cancelled = true; };
  }, [audioFileId]);

  // Redraw whenever samples, notes, tempo, or playingNoteId changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = CANVAS_HEIGHT;
    ctx.clearRect(0, 0, W, H);

    if (samples && samples.length > 0) {
      // Draw waveform
      ctx.beginPath();
      ctx.strokeStyle = WAVEFORM_COLOR;
      ctx.lineWidth = 1;
      const mid = H / 2;
      for (let i = 0; i < samples.length; i++) {
        const x = (i / samples.length) * W;
        const y = mid - samples[i] * mid * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      // Flat center line while no audio loaded
      ctx.beginPath();
      ctx.strokeStyle = WAVEFORM_COLOR;
      ctx.lineWidth = 1;
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
    }

    if (durationSec > 0 && notes.length > 0) {
      const secsPerBeat = 60 / tempo;

      // Draw onset markers
      for (const note of notes) {
        const timeSec = note.startBeat * secsPerBeat;
        const x = (timeSec / durationSec) * W;
        const isPlaying = note.id === playingNoteId;
        ctx.beginPath();
        ctx.strokeStyle = isPlaying ? PLAYHEAD_COLOR : ONSET_COLOR;
        ctx.lineWidth = isPlaying ? 2 : 1;
        ctx.globalAlpha = isPlaying ? 1 : 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }, [samples, durationSec, notes, tempo, playingNoteId]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = CANVAS_HEIGHT;
    });
    observer.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = CANVAS_HEIGHT;
    return () => observer.disconnect();
  }, []);

  if (!audioFileId) return null;

  return (
    <div className="w-full">
      <div className="border border-ink-soft/15 rounded bg-white">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: CANVAS_HEIGHT }}
          className="block rounded"
        />
      </div>
      <div className="mt-1 flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-blue-500" />
          Note onset
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-green-600" />
          Playing
        </span>
      </div>
    </div>
  );
};
