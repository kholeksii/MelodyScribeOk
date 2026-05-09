import React, { useRef, useState, useCallback, useEffect } from 'react';

interface TranscribeOptionsProps {
  bpm: string;
  setBpm: (bpm: string) => void;
  timeSignature: string;
  setTimeSignature: (ts: string) => void;
  musicalKey: string;
  setMusicalKey: (key: string) => void;
}

const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4'];

const KEYS = [
  'C major', 'C# major', 'D major', 'D# major', 'E major', 'F major',
  'F# major', 'G major', 'G# major', 'A major', 'A# major', 'B major',
  'C minor', 'C# minor', 'D minor', 'D# minor', 'E minor', 'F minor',
  'F# minor', 'G minor', 'G# minor', 'A minor', 'A# minor', 'B minor',
];

function useTapTempo(onBpm: (bpm: string) => void) {
  const timestampsRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);
  const [computedBpm, setComputedBpm] = useState<number | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    timestampsRef.current = [];
    setTapCount(0);
    setComputedBpm(null);
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const tap = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(reset, 3000);

    const now = performance.now();
    const next = [...timestampsRef.current, now].slice(-8);
    timestampsRef.current = next;
    const count = next.length;
    setTapCount(count);

    if (count >= 4) {
      const intervals: number[] = [];
      for (let i = 1; i < next.length; i++) {
        intervals.push(next[i] - next[i - 1]);
      }
      intervals.sort((a, b) => a - b);
      const median = intervals[Math.floor(intervals.length / 2)];
      const bpmVal = Math.round(60000 / median);
      const clamped = Math.max(40, Math.min(300, bpmVal));
      setComputedBpm(clamped);
      onBpm(String(clamped));
    }
  }, [onBpm, reset]);

  return { tap, tapCount, computedBpm, reset };
}

export const TranscribeOptions: React.FC<TranscribeOptionsProps> = ({
  bpm, setBpm, timeSignature, setTimeSignature, musicalKey, setMusicalKey,
}) => {
  const { tap, tapCount, computedBpm } = useTapTempo(setBpm);

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || (/^\d+$/.test(val) && Number(val) >= 0 && Number(val) <= 300)) {
      setBpm(val);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-purple-800">BPM:</label>
        <input
          type="number"
          value={bpm}
          onChange={handleBpmChange}
          placeholder="auto"
          min={40}
          max={300}
          className="w-20 px-2 py-1.5 text-sm border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        />
        <button
          type="button"
          onClick={tap}
          className="px-3 py-1.5 text-sm font-medium border border-purple-300 rounded bg-white hover:bg-purple-100 active:bg-purple-200 transition text-purple-700"
          title="Tap at least 4 times to the beat"
        >
          {tapCount === 0
            ? 'Tap tempo'
            : tapCount < 4
              ? `Tap ${tapCount}/4...`
              : `BPM: ${computedBpm}`}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-purple-800">Time:</label>
        <select
          value={timeSignature}
          onChange={(e) => setTimeSignature(e.target.value)}
          className="px-2 py-1.5 text-sm border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        >
          {TIME_SIGNATURES.map((ts) => (
            <option key={ts} value={ts}>{ts}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-purple-800">Key:</label>
        <select
          value={musicalKey}
          onChange={(e) => setMusicalKey(e.target.value)}
          className="px-2 py-1.5 text-sm border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        >
          <option value="">auto</option>
          {KEYS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
