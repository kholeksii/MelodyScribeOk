import logging

logger = logging.getLogger(__name__)

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Schmuckler key profiles
MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

# Relative major/minor scores are close by construction (same pitch-class
# set); within this margin the melody's final note decides
RELATIVE_TIE_MARGIN = 0.05


class KeyDetector:
    """Krumhansl-Schmuckler key estimation.

    The original implementation used np.correlate(mode='full') — a LINEAR
    cross-correlation — instead of comparing the chroma vector against the
    12 CIRCULAR rotations of each profile, which offset the detected root
    (both real G-major test recordings came back as "B major").
    """

    def detect(self, audio, sr: int) -> str:
        """Estimate the key from raw audio via an averaged chromagram."""
        import librosa
        import numpy as np

        chromagram = librosa.feature.chroma_cqt(y=audio, sr=sr, n_chroma=12)
        chroma_avg = np.mean(chromagram, axis=1)
        root, mode, scores = self._best_key(chroma_avg)
        self._log_top_candidates("chroma", scores)
        return f"{NOTE_NAMES[root]} {mode}"

    def detect_from_notes(
        self,
        pitches: list[str],
        durations_beats: list[float] | None = None,
    ) -> str:
        """Estimate the key from segmented notes (scientific pitch names).

        More robust than raw chroma: overtones and room noise are already
        filtered out by the pitch tracker. Pitch classes are weighted by
        sqrt(duration) — long notes anchor the key without letting a held
        final dominant flip it. Rests are ignored.
        """
        histogram, final_pitch_class = self._note_histogram(pitches, durations_beats)
        if histogram is None:
            return "C major"
        root, mode, scores = self._best_key(histogram)
        self._log_top_candidates("notes", scores)
        root, mode = self._final_note_tiebreak(root, mode, scores, final_pitch_class)
        return f"{NOTE_NAMES[root]} {mode}"

    def detect_combined(
        self,
        audio,
        sr: int,
        pitches: list[str],
        durations_beats: list[float] | None = None,
    ) -> str:
        """Average the note-based and chroma-based score tables.

        On the real Que Lindo recordings each source alone misjudges the
        piano take (it ends on a long half-cadence D); their average picks
        G major for both takes.
        """
        import librosa
        import numpy as np

        histogram, final_pitch_class = self._note_histogram(pitches, durations_beats)
        if histogram is None:
            return self.detect(audio, sr)

        chromagram = librosa.feature.chroma_cqt(y=audio, sr=sr, n_chroma=12)
        _, _, chroma_scores = self._best_key(np.mean(chromagram, axis=1))
        _, _, note_scores = self._best_key(histogram)

        scores = {k: (note_scores[k] + chroma_scores[k]) / 2 for k in note_scores}
        self._log_top_candidates("notes", note_scores)
        self._log_top_candidates("chroma", chroma_scores)
        self._log_top_candidates("combined", scores)
        root, mode = max(scores, key=lambda k: scores[k])
        root, mode = self._final_note_tiebreak(root, mode, scores, final_pitch_class)
        return f"{NOTE_NAMES[root]} {mode}"

    @staticmethod
    def _note_histogram(
        pitches: list[str],
        durations_beats: list[float] | None,
    ):
        """Sqrt-duration-weighted pitch-class histogram + final pitch class."""
        import librosa
        import numpy as np

        histogram = np.zeros(12)
        final_pitch_class: int | None = None
        for i, pitch in enumerate(pitches):
            if pitch == "rest":
                continue
            try:
                pitch_class = int(librosa.note_to_midi(pitch)) % 12
            except Exception:
                continue
            weight = durations_beats[i] if durations_beats is not None else 1.0
            histogram[pitch_class] += max(weight, 0.0) ** 0.5
            final_pitch_class = pitch_class

        if histogram.sum() <= 0:
            return None, None
        return histogram, final_pitch_class

    def _final_note_tiebreak(
        self,
        root: int,
        mode: str,
        scores: dict[tuple[int, str], float],
        final_pitch_class: int | None,
    ) -> tuple[int, str]:
        # Relative major/minor share the same accidentals and score close to
        # each other; if the melody ends on either tonic, trust the ending.
        if final_pitch_class is None:
            return root, mode
        relative = self._relative_key(root, mode)
        if (
            relative[0] == final_pitch_class
            and root != final_pitch_class
            and scores[(root, mode)] - scores[relative] <= RELATIVE_TIE_MARGIN
        ):
            return relative
        return root, mode

    @staticmethod
    def _relative_key(root: int, mode: str) -> tuple[int, str]:
        if mode == "major":
            return (root + 9) % 12, "minor"
        return (root + 3) % 12, "major"

    @staticmethod
    def _log_top_candidates(label: str, scores: dict[tuple[int, str], float], n: int = 3) -> None:
        """B2: surface the near-misses — key confusions (e.g. G vs D major)
        are usually a close call between the top 2-3 candidates."""
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:n]
        formatted = ", ".join(f"{NOTE_NAMES[r]} {m}={s:.3f}" for (r, m), s in ranked)
        logger.info(f"Key candidates ({label}): {formatted}")

    @staticmethod
    def _best_key(pitch_class_vector) -> tuple[int, str, dict[tuple[int, str], float]]:
        """Score all 24 keys via Pearson correlation with circularly rotated
        Krumhansl profiles; return the winner and the full score table."""
        import numpy as np

        vector = np.asarray(pitch_class_vector, dtype=float)
        scores: dict[tuple[int, str], float] = {}
        for mode, profile in (("major", MAJOR_PROFILE), ("minor", MINOR_PROFILE)):
            base = np.asarray(profile)
            for root in range(12):
                rotated = np.roll(base, root)
                if np.std(vector) == 0 or np.std(rotated) == 0:
                    scores[(root, mode)] = 0.0
                else:
                    scores[(root, mode)] = float(np.corrcoef(vector, rotated)[0, 1])

        best_root, best_mode = max(scores, key=lambda k: scores[k])
        return best_root, best_mode, scores
