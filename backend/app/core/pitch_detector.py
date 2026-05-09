from typing import List, Dict

INSTRUMENT_RANGES = {
    "violin": (196.0, 2637.0),
    "piano": (27.5, 4186.0),
    "guitar": (82.0, 1319.0),
}


class PitchDetector:
    def detect(self, audio, sr: int, instrument: str) -> List[Dict]:
        if instrument not in INSTRUMENT_RANGES:
            raise ValueError(f"Unsupported instrument: {instrument}")
        min_freq, max_freq = INSTRUMENT_RANGES[instrument]

        import librosa
        import numpy as np

        hop_length = 256
        try:
            f0, voiced_flag, _voiced_prob = librosa.pyin(
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

        # Keep only Viterbi-voiced frames with valid frequency
        # voiced_flag (Viterbi HMM decision) is reliable;
        # voiced_prob (raw frame probability) can be near-zero even for clean notes
        results = []
        for t, f, v in zip(times, f0, voiced_flag):
            if not bool(v):
                continue
            f_val = float(f)
            if np.isnan(f_val) or not (min_freq <= f_val <= max_freq):
                continue
            results.append({
                "time_ms": float(t) * 1000,
                "frequency": f_val,
                "note": self._frequency_to_note(f_val),
                # confidence will be computed per-segment from pitch stability
                "confidence": 1.0,
            })

        return results

    def _frequency_to_note(self, frequency: float) -> str:
        import librosa
        return librosa.hz_to_note(frequency)
