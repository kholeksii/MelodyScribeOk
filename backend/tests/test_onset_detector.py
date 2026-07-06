"""Onset detection v2: exact counts, noise floor, double-trigger merging (U11)."""
import numpy as np
import soundfile as sf

from app.core.onset_detector import OnsetDetector

SCALE = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]


def test_detached_melody_yields_exactly_n_onsets(synth_melody) -> None:
    path = synth_melody([(p, 1.0) for p in SCALE], bpm=120)
    audio, sr = sf.read(path, dtype="float32")
    onsets = OnsetDetector().detect(audio, sr, instrument="piano")
    assert len(onsets) == len(SCALE), f"expected {len(SCALE)}, got {len(onsets)}"


def test_quiet_noise_segment_adds_no_onsets(synth_melody) -> None:
    path = synth_melody([(p, 1.0) for p in SCALE[:4]], bpm=120)
    audio, sr = sf.read(path, dtype="float32")
    rng = np.random.default_rng(42)
    # room noise below the -48 dB floor, relative to the recording's own peak
    noise_amp = float(np.max(np.abs(audio))) * 10 ** (-54 / 20)
    noise = (rng.standard_normal(sr) * noise_amp).astype(np.float32)
    audio_with_noise = np.concatenate([audio, noise])
    onsets = OnsetDetector().detect(audio_with_noise, sr, instrument="piano")
    assert len(onsets) == 4, f"noise tail added onsets: {onsets}"


def test_close_double_triggers_merge_keeping_the_attack() -> None:
    merged = OnsetDetector._merge_close([1.0, 1.03, 2.0, 2.07, 3.0], min_gap_sec=0.08)
    assert merged == [1.03, 2.07, 3.0]


def test_violin_narrow_gap_keeps_all_notes(synth_melody) -> None:
    # Violin uses a NARROW merge window (real sixteenths sit 70-110ms apart);
    # the noise floor, not merging, removes its decay artifacts
    path = synth_melody([("A4", 1.0), ("B4", 1.0), ("C5", 1.0), ("D5", 1.0)], bpm=120)
    audio, sr = sf.read(path, dtype="float32")
    onsets = OnsetDetector().detect(audio, sr, instrument="violin")
    assert len(onsets) == 4


def test_melody_starting_at_zero_keeps_first_note(synth_melody) -> None:
    # librosa peak-picking cannot fire at t=0; the detector must add it back
    path = synth_melody([("A4", 1.0), ("B4", 1.0), ("C5", 1.0), ("D5", 1.0)], bpm=120)
    audio, sr = sf.read(path, dtype="float32")
    onsets = OnsetDetector().detect(audio, sr, instrument="violin")
    assert onsets[0] < 0.1, f"first note attack missing: {onsets}"
