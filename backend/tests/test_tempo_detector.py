"""Tempo detection on synthesized monophonic melodies (IOI-based, U9)."""
import pytest
import soundfile as sf

from app.core.onset_detector import OnsetDetector
from app.core.tempo_detector import TempoDetector

SCALE = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]


def _detect_from_file(path) -> int:
    audio, sr = sf.read(path, dtype="float32")
    onsets = OnsetDetector().detect(audio, sr)
    return TempoDetector().detect(audio, sr, onsets=onsets)


@pytest.mark.parametrize("bpm", [90, 120, 150])
def test_quarter_notes_detect_within_8_percent(synth_melody, bpm: int) -> None:
    path = synth_melody([(p, 1.0) for p in SCALE], bpm=bpm)
    detected = _detect_from_file(path)
    assert abs(detected - bpm) / bpm <= 0.08, f"expected ~{bpm}, got {detected}"


def test_eighth_notes_fold_to_base_pulse(synth_melody) -> None:
    # Eighth notes at 120 BPM must not read as 240 BPM
    path = synth_melody([(p, 0.5) for p in SCALE * 2], bpm=120)
    detected = _detect_from_file(path)
    assert abs(detected - 120) / 120 <= 0.08, f"expected ~120, got {detected}"


def test_mixed_rhythm_detects_base_pulse(synth_melody) -> None:
    # Dotted quarter + eighth + two quarters, twice, at 120 BPM
    pattern = [("C4", 1.5), ("D4", 0.5), ("E4", 1.0), ("G4", 1.0)]
    path = synth_melody(pattern * 2, bpm=120)
    detected = _detect_from_file(path)
    assert abs(detected - 120) / 120 <= 0.08, f"expected ~120, got {detected}"


def test_habanera_rhythm_detects_base_pulse(synth_melody) -> None:
    # Dotted eighth + sixteenth + two eighths (the Que Lindo figure) at 120 BPM
    pattern = [("B4", 0.75), ("B4", 0.25), ("G4", 0.5), ("E4", 0.5)]
    path = synth_melody(pattern * 4, bpm=120)
    detected = _detect_from_file(path)
    assert abs(detected - 120) / 120 <= 0.08, f"expected ~120, got {detected}"


def test_fallback_without_onsets_stays_in_plausible_range(synth_melody) -> None:
    path = synth_melody([(p, 1.0) for p in SCALE], bpm=120)
    audio, sr = sf.read(path, dtype="float32")
    detected = TempoDetector().detect(audio, sr)  # beat_track fallback
    assert 70 <= detected <= 180


class TestFold:
    def test_folds_octave_errors_into_range(self) -> None:
        assert TempoDetector._fold(42.0) == 84  # the historical failure case
        assert TempoDetector._fold(240.0) == 120
        assert TempoDetector._fold(120.0) == 120

    def test_degenerate_input_defaults(self) -> None:
        assert TempoDetector._fold(0.0) == 120
