"""Octave-outlier folding (U12)."""
from app.core.pitch_postprocess import fold_octave_outliers


def _note(pitch: str, confidence: float = 0.9) -> dict:
    return {"note": pitch, "confidence": confidence}


def _pitches(notes: list[dict]) -> list[str]:
    return [n["note"] for n in notes]


def test_single_octave_spike_is_folded_with_reduced_confidence() -> None:
    notes = [_note("C4"), _note("E4"), _note("E5"), _note("G4"), _note("C4")]
    result = fold_octave_outliers(notes)
    assert _pitches(result) == ["C4", "E4", "E4", "G4", "C4"]
    assert result[2]["confidence"] == round(0.9 * 0.7, 4)
    assert result[1]["confidence"] == 0.9  # untouched


def test_downward_spike_is_folded_up() -> None:
    # The audit case: a B3 surrounded by B4s in the violin take
    notes = [_note("B4"), _note("B3"), _note("A4")]
    result = fold_octave_outliers(notes)
    assert _pitches(result) == ["B4", "B4", "A4"]


def test_genuine_octave_alternation_is_not_folded() -> None:
    notes = [_note("C4"), _note("C5"), _note("C4"), _note("C5")]
    assert _pitches(fold_octave_outliers(notes)) == ["C4", "C5", "C4", "C5"]


def test_wide_neighbor_span_is_not_folded() -> None:
    # neighbors a sixth apart give no stable context to fold toward
    notes = [_note("C4"), _note("C5"), _note("A4")]
    assert _pitches(fold_octave_outliers(notes)) == ["C4", "C5", "A4"]


def test_octave_leap_passage_is_not_folded() -> None:
    # ascending line through an octave leap: C4 G4 C5 — C5 is not an outlier
    notes = [_note("C4"), _note("G4"), _note("C5"), _note("B4")]
    assert _pitches(fold_octave_outliers(notes)) == ["C4", "G4", "C5", "B4"]


def test_rests_are_transparent_for_neighbor_lookup() -> None:
    notes = [_note("E4"), {"note": "rest", "confidence": 1.0}, _note("E5"), _note("F4")]
    result = fold_octave_outliers(notes)
    assert _pitches(result) == ["E4", "rest", "E4", "F4"]


def test_short_sequences_untouched() -> None:
    notes = [_note("C4"), _note("C5")]
    assert _pitches(fold_octave_outliers(notes)) == ["C4", "C5"]
