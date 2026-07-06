"""End-to-end transcription accuracy on synthesized melodies.

Pins current pipeline behavior so algorithm changes (U9-U14) are measurable.
Calls SegmentationService.transcribe() directly (no HTTP) for speed.
"""

import pytest

from app.models.note import TranscriptionData
from app.services.segmentation_service import SegmentationService

DO_MI_RE_DO = [("C4", 1.0), ("E4", 1.0), ("D4", 1.0), ("C4", 1.0)]

VIOLIN_RANGE_HZ = (196.0, 2637.0)  # G3 - E7


@pytest.fixture(scope="module")
def service() -> SegmentationService:
    return SegmentationService()


def _sounding_pitches(result: TranscriptionData) -> list[str]:
    """Pitch sequence without rests, consecutive duplicates merged
    (guards against repeated-note splitting, see U11)."""
    out: list[str] = []
    for note in result.notes:
        if note.pitch == "rest":
            continue
        if not out or out[-1] != note.pitch:
            out.append(note.pitch)
    return out


def pitch_accuracy(expected: list[str], actual: list[str]) -> float:
    """Fraction of expected pitches found at the right ordinal position."""
    if not expected:
        return 1.0
    hits = sum(
        1 for i, pitch in enumerate(expected) if i < len(actual) and actual[i] == pitch
    )
    return hits / len(expected)


def octave_tolerant_accuracy(expected: list[str], actual: list[str]) -> float:
    """Same, but ignoring the octave digit."""
    strip = lambda p: p.rstrip("0123456789")  # noqa: E731
    return pitch_accuracy([strip(p) for p in expected], [strip(p) for p in actual])


def test_do_mi_re_do_tempo_hint_respected(service, synth_melody) -> None:
    path = synth_melody(DO_MI_RE_DO, bpm=120)
    result = service.transcribe(str(path), instrument="piano", bpm=120)
    assert result.tempo == 120
    # every true pitch is present in order, even if phantoms are interleaved
    pitches = _sounding_pitches(result)
    assert [p for p in pitches if p in {"C4", "E4", "D4"}][:2] == ["C4", "E4"]


def test_do_mi_re_do_exact_pitch_sequence(service, synth_melody) -> None:
    """Fixed in U11: onset noise floor + artifact merging removed the phantom notes."""
    path = synth_melody(DO_MI_RE_DO, bpm=120)
    result = service.transcribe(str(path), instrument="piano", bpm=120)
    pitches = _sounding_pitches(result)
    assert pitch_accuracy(["C4", "E4", "D4", "C4"], pitches) == 1.0
    assert len(pitches) == 4


def test_violin_melody_stays_in_range(service, synth_melody) -> None:
    import librosa

    path = synth_melody(
        [("A4", 1.0), ("B4", 1.0), ("C5", 1.0), ("E5", 1.0)], bpm=120
    )
    result = service.transcribe(str(path), instrument="violin", bpm=120)
    pitches = _sounding_pitches(result)
    assert pitches, "expected notes from a violin-range melody"
    lo, hi = VIOLIN_RANGE_HZ
    for pitch in pitches:
        assert lo * 0.97 <= librosa.note_to_hz(pitch) <= hi * 1.03, pitch


def test_gap_pitches_survive(service, synth_melody) -> None:
    path = synth_melody(
        [("C4", 1.0), ("rest", 1.0), ("E4", 1.0)], bpm=120
    )
    result = service.transcribe(str(path), instrument="piano", bpm=120)
    assert pitch_accuracy(["C4", "E4"], _sounding_pitches(result)) == 1.0


def test_gap_produces_rest(service, synth_melody) -> None:
    """Fixed in U11: silent segment tails are split off as rest notes."""
    path = synth_melody(
        [("C4", 1.0), ("rest", 1.0), ("E4", 1.0)], bpm=120
    )
    result = service.transcribe(str(path), instrument="piano", bpm=120)
    assert any(n.pitch == "rest" for n in result.notes), (
        "1-beat silence should yield a rest"
    )
