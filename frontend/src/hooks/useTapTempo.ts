import { useCallback, useEffect, useRef, useState } from 'react';

/** Tap-to-BPM: median of the last up-to-8 tap intervals, clamped 40-300. */
export function useTapTempo(onBpm: (bpm: string) => void) {
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
