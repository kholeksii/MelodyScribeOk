DEFAULT_MIN_GAP_MS = 80.0
# Decay artifacts land 60-70ms around percussive attacks. Violin gets a
# NARROWER window: bowed playing has no detached decay artifacts (the noise
# floor handles those), but real sixteenths sit ~70-110ms apart and a wide
# window would swallow them
INSTRUMENT_MIN_GAP_MS = {"piano": 80.0, "guitar": 80.0, "violin": 60.0}
# -48 dB rather than -40: violin bow attacks swell slowly and quiet endings
# are real notes; a stricter floor was dropping them on the real recordings
DEFAULT_NOISE_FLOOR_DB = -48.0  # relative to peak; kills breath/room noise
DEFAULT_DELTA = 0.07  # onset-strength peak threshold
# 50ms only: a longer window reaches into the NEXT note and lets silent
# decay artifacts survive the floor check
_RMS_WINDOW_SEC = 0.05


class OnsetDetector:
    """Onset detection with double-trigger merging and a noise floor.

    Close onset clusters are merged keeping the STRONGEST onset (by
    onset-envelope value): a real attack produces a large energy rise,
    a note-decay artifact a small one — position alone cannot tell them
    apart (the artifact may land before or after the true attack).
    """

    def detect(
        self,
        audio,
        sr: int,
        instrument: str | None = None,
        delta: float = DEFAULT_DELTA,
        min_gap_ms: float | None = None,
        noise_floor_db: float = DEFAULT_NOISE_FLOOR_DB,
    ) -> list[float]:
        import librosa
        import numpy as np

        # Ensure audio is float32 and mono
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        if audio.ndim > 1:
            audio = audio.mean(axis=0)

        hop_length = 512
        try:
            envelope = librosa.onset.onset_strength(y=audio, sr=sr, hop_length=hop_length)
            onset_times = librosa.onset.onset_detect(
                onset_envelope=envelope,
                sr=sr,
                hop_length=hop_length,
                units="time",
                delta=delta,
            )
        except Exception as exc:
            raise RuntimeError(f"Onset detection failed: {exc}") from exc

        onsets = sorted(float(t) for t in onset_times)
        onsets = self._drop_quiet(onsets, audio, sr, noise_floor_db)
        onsets = self._prepend_initial_attack(onsets, audio, sr, noise_floor_db)

        # Merge preference: a real attack is FOLLOWED by sound, a decay
        # artifact by silence — local RMS after the onset tells them apart
        # far more reliably than onset-envelope strength
        strengths = [self._rms_after(audio, sr, t) for t in onsets]
        if min_gap_ms is None:
            min_gap_ms = INSTRUMENT_MIN_GAP_MS.get(instrument or "", DEFAULT_MIN_GAP_MS)
        return self._merge_close(onsets, min_gap_ms / 1000.0, strengths)

    @staticmethod
    def _rms_after(audio, sr: int, onset: float) -> float:
        """Median RMS over 10ms sub-windows following the onset.

        The median (not the mean) so that a millisecond of the NEXT note
        leaking into the window cannot make a silent decay artifact look
        like a sounding attack."""
        import numpy as np

        start = int((onset + 0.01) * sr)
        segment = audio[start : start + int(_RMS_WINDOW_SEC * sr)]
        sub = max(int(0.01 * sr), 1)
        chunks = [segment[k * sub : (k + 1) * sub] for k in range(len(segment) // sub)]
        if not chunks:
            return 0.0
        return float(np.median([np.sqrt(np.mean(c**2)) for c in chunks]))

    @staticmethod
    def _prepend_initial_attack(
        onsets: list[float], audio, sr: int, noise_floor_db: float
    ) -> list[float]:
        """librosa peak-picking cannot fire near t=0 (it needs pre-context),
        so a melody starting immediately loses its first note. If sound is
        present well before the first detected onset, add an onset there."""
        import numpy as np

        peak = float(np.max(np.abs(audio))) if len(audio) else 0.0
        if peak <= 0:
            return onsets

        floor_amp = peak * (10.0 ** (noise_floor_db / 20.0))
        window = max(int(0.02 * sr), 1)
        horizon = onsets[0] if onsets else len(audio) / sr
        for k in range(int(horizon * sr) // window):
            chunk = audio[k * window : (k + 1) * window]
            if float(np.sqrt(np.mean(chunk**2))) >= floor_amp:
                first_sound = k * window / sr
                if not onsets or onsets[0] - first_sound >= 0.15:
                    return [first_sound, *onsets]
                break
        return onsets

    @staticmethod
    def _drop_quiet(
        onsets: list[float], audio, sr: int, noise_floor_db: float
    ) -> list[float]:
        """Drop onsets whose local RMS is below the noise floor (rel. peak)."""
        import numpy as np

        peak = float(np.max(np.abs(audio))) if len(audio) else 0.0
        if peak <= 0:
            return onsets

        floor_amp = peak * (10.0 ** (noise_floor_db / 20.0))
        return [
            onset
            for onset in onsets
            if OnsetDetector._rms_after(audio, sr, onset) >= floor_amp
        ]

    @staticmethod
    def _merge_close(
        onsets: list[float],
        min_gap_sec: float,
        strengths: list[float] | None = None,
    ) -> list[float]:
        """Collapse onset clusters closer than min_gap_sec, keeping the
        strongest onset of each cluster (the last one when no strengths)."""
        merged: list[float] = []
        merged_strength: list[float] = []
        for i, onset in enumerate(onsets):
            strength = strengths[i] if strengths is not None else float("inf")
            if merged and onset - merged[-1] < min_gap_sec:
                if strength >= merged_strength[-1]:
                    merged[-1] = onset
                    merged_strength[-1] = strength
            else:
                merged.append(onset)
                merged_strength.append(strength)
        return merged
