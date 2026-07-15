"""Unit tests for legato re-segmentation (U51).

Onsets alone cut notes only at attacks; a slurred (single-bow) pitch
change has no attack to split on. `_split_segment_by_pitch` scans a
segment's own pyin frames for a sustained semitone change instead.
"""
import librosa

from app.services.segmentation_service import (
    LEGATO_MEDIAN_WINDOW,
    LEGATO_MIN_RUN_SEC,
    _split_segment_by_pitch,
)

HOP_SEC = 256 / 44100  # matches PitchDetector's hop_length


def _frames(pitch: str, n: int, start_time: float, jitter_hz: float = 0.0) -> list[dict]:
    """Synthetic pyin frames at a fixed pitch, `n` frames apart by HOP_SEC —
    a glissando-free slur has no gap and no fade, unlike synth_melody_file's
    detached notes, which is exactly the case onsets can't split."""
    freq = librosa.note_to_hz(pitch)
    return [
        {
            "time_ms": (start_time + i * HOP_SEC) * 1000,
            "frequency": freq + (jitter_hz if i % 2 == 0 else -jitter_hz),
            "note": pitch,
            "confidence": 1.0,
        }
        for i in range(n)
    ]


def test_sustained_pitch_change_splits_into_two_notes() -> None:
    # ~116ms of C4 glued directly to ~116ms of D4 — a bowed slur, no gap
    n_per_note = int(0.116 / HOP_SEC)
    segment = _frames("C4", n_per_note, start_time=0.0) + _frames(
        "D4", n_per_note, start_time=n_per_note * HOP_SEC
    )

    partitions = _split_segment_by_pitch(segment)

    assert len(partitions) == 2
    assert partitions[0][0]["note"] == "C4"
    assert partitions[1][0]["note"] == "D4"
    # every frame accounted for, none dropped or duplicated
    assert sum(len(p) for p in partitions) == len(segment)


def test_short_blip_does_not_split() -> None:
    # A single stray frame a semitone off (vibrato overshoot / pyin jitter)
    # surrounded by a stable pitch must NOT be treated as a new note
    n = int(0.2 / HOP_SEC)
    segment = _frames("C4", n, start_time=0.0)
    blip_idx = n // 2
    segment[blip_idx] = {**segment[blip_idx], "frequency": librosa.note_to_hz("Db4")}

    partitions = _split_segment_by_pitch(segment)

    assert len(partitions) == 1
    assert len(partitions[0]) == len(segment)


def test_change_shorter_than_min_run_does_not_split() -> None:
    # The second pitch holds for less than LEGATO_MIN_RUN_SEC — not a real
    # note, gets folded back into the first
    n_first = int(0.2 / HOP_SEC)
    n_second = max(1, int((LEGATO_MIN_RUN_SEC * 0.5) / HOP_SEC))
    segment = _frames("C4", n_first, start_time=0.0) + _frames(
        "D4", n_second, start_time=n_first * HOP_SEC
    )

    partitions = _split_segment_by_pitch(segment)

    assert len(partitions) == 1


def test_too_few_frames_returns_unchanged() -> None:
    segment = _frames("C4", LEGATO_MEDIAN_WINDOW - 1, start_time=0.0)

    partitions = _split_segment_by_pitch(segment)

    assert partitions == [segment]


def test_stable_segment_is_not_split() -> None:
    segment = _frames("A4", 30, start_time=0.0, jitter_hz=0.5)

    partitions = _split_segment_by_pitch(segment)

    assert len(partitions) == 1
