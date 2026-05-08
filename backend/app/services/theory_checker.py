import logging
from typing import List, Dict, Any

from ..models.note import NoteData

logger = logging.getLogger(__name__)

INSTRUMENT_RANGES: Dict[str, tuple] = {
    "piano": ("A0", "C8"),
    "violin": ("G3", "E7"),
    "guitar": ("E2", "E6"),
}

NOTE_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

DURATION_BEATS: Dict[str, float] = {
    "whole": 4.0,
    "half": 2.0,
    "quarter": 1.0,
    "eighth": 0.5,
    "sixteenth": 0.25,
}


def _pitch_to_midi(pitch: str) -> int:
    """Convert pitch string like 'C4' or 'C#4' to MIDI number."""
    if pitch == "rest":
        return -1
    note_part = pitch[:-1]
    octave = int(pitch[-1])
    if note_part not in NOTE_ORDER:
        return -1
    return 12 * (octave + 1) + NOTE_ORDER.index(note_part)


def _midi_to_pitch(midi: int) -> str:
    """Convert MIDI number back to pitch string."""
    octave = (midi // 12) - 1
    note_idx = midi % 12
    return f"{NOTE_ORDER[note_idx]}{octave}"


def _beats_per_measure(time_signature: str) -> float:
    """Calculate beats per measure from time signature string like '4/4'."""
    parts = time_signature.split("/")
    if len(parts) != 2:
        return 4.0
    numerator, denominator = int(parts[0]), int(parts[1])
    return numerator * (4.0 / denominator)


class TheoryChecker:
    """Rule-based music theory verification for transcribed notes."""

    def verify(
        self,
        notes: List[NoteData],
        instrument: str,
        tempo: int,
        key: str,
        time_signature: str = "4/4",
    ) -> Dict[str, Any]:
        corrections: List[Dict[str, Any]] = []

        corrections.extend(self._check_instrument_range(notes, instrument))
        corrections.extend(self._check_intervals(notes))
        corrections.extend(self._check_measure_fill(notes, time_signature))
        corrections.extend(self._check_enharmonic(notes, key))

        confidence = self._calculate_confidence(notes, corrections)

        logger.info(
            f"Theory check: {len(corrections)} corrections, confidence={confidence:.2f}"
        )

        return {
            "corrections": corrections,
            "confidence": confidence,
        }

    def _check_instrument_range(
        self, notes: List[NoteData], instrument: str
    ) -> List[Dict[str, Any]]:
        corrections = []
        range_tuple = INSTRUMENT_RANGES.get(instrument)
        if not range_tuple:
            return corrections

        low_midi = _pitch_to_midi(range_tuple[0])
        high_midi = _pitch_to_midi(range_tuple[1])

        for i, note in enumerate(notes):
            if note.pitch == "rest":
                continue
            midi = _pitch_to_midi(note.pitch)
            if midi == -1:
                continue
            if midi < low_midi:
                clamped = _midi_to_pitch(low_midi)
                corrections.append({
                    "noteIndex": i,
                    "field": "pitch",
                    "oldValue": note.pitch,
                    "newValue": clamped,
                    "reason": f"Note below {instrument} range (min {range_tuple[0]})",
                })
            elif midi > high_midi:
                clamped = _midi_to_pitch(high_midi)
                corrections.append({
                    "noteIndex": i,
                    "field": "pitch",
                    "oldValue": note.pitch,
                    "newValue": clamped,
                    "reason": f"Note above {instrument} range (max {range_tuple[1]})",
                })

        return corrections

    def _check_intervals(self, notes: List[NoteData]) -> List[Dict[str, Any]]:
        """Flag unrealistic pitch jumps (> 12 semitones between consecutive notes)."""
        corrections = []
        max_jump = 12

        pitched = [(i, n) for i, n in enumerate(notes) if n.pitch != "rest"]
        for idx in range(1, len(pitched)):
            prev_i, prev_note = pitched[idx - 1]
            curr_i, curr_note = pitched[idx]

            prev_midi = _pitch_to_midi(prev_note.pitch)
            curr_midi = _pitch_to_midi(curr_note.pitch)
            if prev_midi == -1 or curr_midi == -1:
                continue

            jump = abs(curr_midi - prev_midi)
            if jump > max_jump:
                midpoint = (prev_midi + curr_midi) // 2
                suggested = _midi_to_pitch(midpoint)
                corrections.append({
                    "noteIndex": curr_i,
                    "field": "pitch",
                    "oldValue": curr_note.pitch,
                    "newValue": suggested,
                    "reason": f"Unrealistic interval jump ({jump} semitones)",
                })

        return corrections

    def _check_measure_fill(
        self, notes: List[NoteData], time_signature: str
    ) -> List[Dict[str, Any]]:
        """Check that notes within each measure add up to the correct beat count."""
        corrections = []
        expected_beats = _beats_per_measure(time_signature)

        measures: Dict[int, List[tuple]] = {}
        for i, note in enumerate(notes):
            measures.setdefault(note.measure, []).append((i, note))

        for measure_num, measure_notes in measures.items():
            total = sum(
                DURATION_BEATS.get(n.duration, 1.0) for _, n in measure_notes
            )
            if abs(total - expected_beats) > 0.01:
                corrections.append({
                    "noteIndex": measure_notes[-1][0],
                    "field": "duration",
                    "oldValue": f"{total} beats",
                    "newValue": f"{expected_beats} beats",
                    "reason": (
                        f"Measure {measure_num} has {total} beats "
                        f"(expected {expected_beats} in {time_signature})"
                    ),
                })

        return corrections

    def _check_enharmonic(
        self, notes: List[NoteData], key: str
    ) -> List[Dict[str, Any]]:
        """Normalize enharmonic spelling based on key signature preference."""
        corrections = []

        flat_keys = {"F", "Bb", "Eb", "Ab", "Db", "Gb"}
        prefer_flats = any(k in key for k in flat_keys)

        sharp_to_flat = {
            "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb",
        }
        flat_to_sharp = {v: k for k, v in sharp_to_flat.items()}

        for i, note in enumerate(notes):
            if note.pitch == "rest" or len(note.pitch) < 3:
                continue

            note_name = note.pitch[:-1]
            octave = note.pitch[-1]

            if prefer_flats and note_name in sharp_to_flat:
                new_name = sharp_to_flat[note_name]
                corrections.append({
                    "noteIndex": i,
                    "field": "pitch",
                    "oldValue": note.pitch,
                    "newValue": f"{new_name}{octave}",
                    "reason": f"Enharmonic: prefer flats in key of {key}",
                })
            elif not prefer_flats and note_name in flat_to_sharp:
                new_name = flat_to_sharp[note_name]
                corrections.append({
                    "noteIndex": i,
                    "field": "pitch",
                    "oldValue": note.pitch,
                    "newValue": f"{new_name}{octave}",
                    "reason": f"Enharmonic: prefer sharps in key of {key}",
                })

        return corrections

    def _calculate_confidence(
        self, notes: List[NoteData], corrections: List[Dict[str, Any]]
    ) -> float:
        if not notes:
            return 0.0
        avg_confidence = sum(n.confidence for n in notes) / len(notes)
        correction_penalty = len(corrections) * 0.05
        return max(0.0, min(1.0, avg_confidence - correction_penalty))
