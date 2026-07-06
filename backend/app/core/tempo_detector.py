BPM_MIN = 70
BPM_MAX = 180

# Musical subdivisions an inter-onset interval may represent relative to the
# base pulse, with prior weights: plain subdivisions are far more common
# than dotted ones, which breaks the "eighth at X" vs "dotted eighth at
# 1.5X" symmetry that uniform rhythms otherwise create
IOI_RATIO_WEIGHTS = {
    0.25: 0.7,  # sixteenth
    0.5: 1.0,  # eighth
    0.75: 0.7,  # dotted eighth (habanera figure)
    1.0: 1.0,  # the pulse itself
    1.5: 0.9,  # dotted quarter
    2.0: 1.0,  # half
    3.0: 0.9,  # dotted half
    4.0: 0.9,  # whole
}
RATIO_TOLERANCE = 0.15  # relative error still counted as that subdivision
MERGE_GAP_SEC = 0.1  # onsets closer than this are double-trigger artifacts
MODAL_BONUS = 0.5  # extra weight when an interval IS the pulse (ratio 1.0)


class TempoDetector:
    """Tempo estimation for sparse monophonic melodies.

    librosa.beat.beat_track is built for dense percussive material and is
    known to fail on played melodies (42 BPM reported for a ~120 BPM take).
    When onsets are available the tempo is chosen by scanning candidate BPMs
    and scoring how well every inter-onset interval matches a musical
    subdivision of the candidate pulse. beat_track remains as a fallback.

    Known limitation: on rhythmically loose real playing the winner may lock
    onto a metrically related level (e.g. 3:2) rather than the notated beat —
    the user-supplied BPM hint remains the authoritative override.
    """

    def detect(self, audio, sr: int, onsets: list[float] | None = None) -> int:
        if onsets is not None and len(onsets) >= 4:
            bpm = self._detect_from_onsets(onsets)
            if bpm is not None:
                return bpm
        return self._detect_with_beat_track(audio, sr)

    def _detect_from_onsets(self, onsets: list[float]) -> int | None:
        import numpy as np

        # Merge double-trigger artifacts, keeping the LAST onset of each
        # cluster: a spurious onset at a note's decay lands right before the
        # true attack of the next note
        merged: list[float] = []
        for onset in sorted(float(o) for o in onsets):
            if merged and onset - merged[-1] < MERGE_GAP_SEC:
                merged[-1] = onset
            else:
                merged.append(onset)

        iois = np.diff(np.asarray(merged))
        iois = iois[iois > 0]
        if len(iois) < 3:
            return None

        ratios = np.asarray(list(IOI_RATIO_WEIGHTS))
        best_bpm, best_score = None, -1.0
        for bpm in range(BPM_MIN, BPM_MAX + 1):
            pulse = 60.0 / bpm
            score = 0.0
            for ioi in iois:
                ratio = ioi / pulse
                nearest = float(ratios[int(np.argmin(np.abs(ratios - ratio)))])
                error = abs(ratio - nearest) / nearest
                # weight by duration so long notes anchor the grid
                fit = max(0.0, 1.0 - error / RATIO_TOLERANCE) * ioi
                fit *= IOI_RATIO_WEIGHTS[nearest]
                score += fit * (1.0 + MODAL_BONUS) if nearest == 1.0 else fit
            if score > best_score:
                best_bpm, best_score = bpm, score

        return best_bpm if best_score > 0 else None

    def _detect_with_beat_track(self, audio, sr: int) -> int:
        import librosa

        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
        if hasattr(tempo, "item"):
            tempo = tempo.item()
        return self._fold(float(tempo))

    @staticmethod
    def _fold(bpm: float) -> int:
        """Fold octave errors into the plausible melody range [70, 180] BPM."""
        if bpm <= 0:
            return 120
        while bpm < BPM_MIN:
            bpm *= 2
        while bpm > BPM_MAX:
            bpm /= 2
        return int(round(bpm))
