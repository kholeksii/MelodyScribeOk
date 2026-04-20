from typing import List, Dict

INSTRUMENT_RANGES = {
    "violin": (196.0, 2637.0),
    "piano": (27.5, 4186.0),
    "guitar": (82.0, 1319.0),
}

class PitchDetector:
    def detect(self, audio, sr: int, instrument: str) -> List[Dict]:
        # Get instrument range
        if instrument not in INSTRUMENT_RANGES:
            raise ValueError(f"Unsupported instrument: {instrument}")
        min_freq, max_freq = INSTRUMENT_RANGES[instrument]

        import librosa
        import numpy as np

        hop_length = 256
        try:
            f0, voiced_flag, voiced_prob = librosa.pyin(
                audio,
                fmin=min_freq,
                fmax=max_freq,
                sr=sr,
                frame_length=2048,
                hop_length=hop_length,
            )
        except Exception as exc:
            raise RuntimeError(f"Pitch detection failed: {exc}") from exc

        times = librosa.times_like(f0, sr=sr, hop_length=hop_length)

        # Filter results
        results = []
        for t, f, v, p in zip(times, f0, voiced_flag, voiced_prob):
            # Convert numpy types to Python scalars safely
            try:
                t_val = float(t) if hasattr(t, 'item') else float(t)
            except (ValueError, TypeError):
                continue
            
            try:
                f_val = float(f) if hasattr(f, 'item') else float(f)
            except (ValueError, TypeError):
                continue
            
            try:
                p_val = float(p) if hasattr(p, 'item') else float(p)
            except (ValueError, TypeError):
                continue
            
            try:
                v_val = bool(v) if hasattr(v, 'item') else bool(v)
            except (ValueError, TypeError):
                continue
            
            # Check for NaN values
            if np.isnan(f_val) or np.isnan(p_val):
                continue
            
            if v_val and p_val > 0.7 and min_freq <= f_val <= max_freq:
                note = self._frequency_to_note(f_val)
                results.append({
                    "time_ms": t_val * 1000,
                    "frequency": f_val,
                    "note": note,
                    "confidence": p_val
                })

        return results

    def _frequency_to_note(self, frequency: float) -> str:
        # Simple frequency to note conversion using librosa
        import librosa
        return librosa.hz_to_note(frequency)