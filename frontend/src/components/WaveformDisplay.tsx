import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { NoteData } from '../types';
import { useProjectStore } from '../store/projectStore';
import { noteAtTime, formatTimecode } from '../utils/noteUtils';
import { useT } from '../i18n';

const BASE_URL = 'http://localhost:8000/api';
const WAVEFORM_COLOR = '#94a3b8';    // slate-400
const ONSET_COLOR = '#3b82f6';       // blue-500
const PLAYING_ONSET_COLOR = '#16a34a'; // green-600 — matches the notation highlight
const PLAYHEAD_COLOR = '#7C5CBF';    // accent
const CANVAS_HEIGHT = 96;

interface WaveformDisplayProps {
  notes: NoteData[];
  tempo: number;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({ notes, tempo }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioFileId = useProjectStore((state) => state.audioFileId);
  const playingNoteId = useProjectStore((state) => state.playingNoteId);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const setSelectedNote = useProjectStore((state) => state.setSelectedNote);
  const setPlayingNoteId = useProjectStore((state) => state.setPlayingNoteId);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [hover, setHover] = useState<{ x: number; label: string } | null>(null);
  const t = useT();

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

  /** Full repaint; playheadSec draws the transport cursor when non-null. */
  const draw = useCallback((playheadSec: number | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = CANVAS_HEIGHT;
    ctx.clearRect(0, 0, W, H);

    if (samples && samples.length > 0) {
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

      // Onset markers
      for (const note of notes) {
        const timeSec = note.startBeat * secsPerBeat;
        const x = (timeSec / durationSec) * W;
        const isCurrent = note.id === playingNoteId;
        ctx.beginPath();
        ctx.strokeStyle = isCurrent ? PLAYING_ONSET_COLOR : ONSET_COLOR;
        ctx.lineWidth = isCurrent ? 2 : 1;
        ctx.globalAlpha = isCurrent ? 1 : 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    if (playheadSec != null && durationSec > 0) {
      const x = (playheadSec / durationSec) * W;
      ctx.beginPath();
      ctx.strokeStyle = PLAYHEAD_COLOR;
      ctx.lineWidth = 2;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  }, [samples, durationSec, notes, tempo, playingNoteId]);

  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; }, [draw]);

  // Repaint on data changes
  useEffect(() => {
    draw(isPlaying ? Tone.Transport.seconds : null);
  }, [draw, isPlaying]);

  // Animate the playhead while the transport runs
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      draw(Tone.Transport.seconds);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, draw]);

  // Resize canvas to match container (and repaint — resizing clears it)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = CANVAS_HEIGHT;
      drawRef.current(null);
    };
    const observer = new ResizeObserver(apply);
    observer.observe(canvas);
    apply();
    return () => observer.disconnect();
  }, []);

  const timeAtEvent = (e: React.MouseEvent): { timeSec: number; x: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || durationSec <= 0) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = Math.max(0, Math.min(1, x / rect.width));
    return { timeSec: frac * durationSec, x };
  };

  const handleClick = (e: React.MouseEvent) => {
    const at = timeAtEvent(e);
    if (!at) return;
    const note = noteAtTime(notes, tempo, at.timeSec);
    if (note) setSelectedNote(note.id);
    if (isPlaying) {
      // Seek — remaining scheduled events continue from the new position
      Tone.Transport.seconds = at.timeSec;
      setPlayingNoteId(note ? note.id : null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const at = timeAtEvent(e);
    setHover(at ? { x: at.x, label: formatTimecode(at.timeSec) } : null);
  };

  if (!audioFileId) return null;

  return (
    <div className="w-full">
      <div className="relative border border-ink-soft/15 rounded bg-white">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
          style={{ width: '100%', height: CANVAS_HEIGHT }}
          className="block rounded cursor-pointer"
        />
        {hover && (
          <div
            className="pointer-events-none absolute -top-6 rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-white"
            style={{ left: hover.x, transform: 'translateX(-50%)' }}
          >
            {hover.label}
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-blue-500" />
          {t('noteOnset')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-green-600" />
          {t('playing')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-accent" />
          {t('playhead')}
        </span>
      </div>
    </div>
  );
};
