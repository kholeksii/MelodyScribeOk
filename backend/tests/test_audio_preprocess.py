"""Bandpass + noise gate pre-filtering (U14)."""
import numpy as np
import soundfile as sf

from app.core.audio_preprocess import _bandpass, preprocess
from app.services.segmentation_service import SegmentationService

MELODY = [("C4", 1.0), ("E4", 1.0), ("G4", 1.0), ("C5", 1.0)]


def _band_energy(audio, sr: int, freq: float, width: float = 10.0) -> float:
    spectrum = np.abs(np.fft.rfft(audio))
    freqs = np.fft.rfftfreq(len(audio), 1.0 / sr)
    mask = (freqs >= freq - width) & (freqs <= freq + width)
    return float(np.sum(spectrum[mask] ** 2))


def test_noisy_melody_transcribes_to_same_note_count(synth_melody, tmp_path) -> None:
    clean_path = synth_melody(MELODY, bpm=120, filename="clean.wav")
    audio, sr = sf.read(clean_path, dtype="float32")

    rng = np.random.default_rng(7)
    noise = (rng.standard_normal(len(audio)) * 10 ** (-30 / 20)).astype(np.float32)
    noisy_path = tmp_path / "noisy.wav"
    sf.write(noisy_path, audio + noise, sr)

    service = SegmentationService()
    clean = service.transcribe(str(clean_path), "piano", bpm=120)
    noisy = service.transcribe(str(noisy_path), "piano", bpm=120)

    clean_sounding = [n for n in clean.notes if n.pitch != "rest"]
    noisy_sounding = [n for n in noisy.notes if n.pitch != "rest"]
    assert len(noisy_sounding) == len(clean_sounding)
    assert [n.pitch for n in noisy_sounding] == [n.pitch for n in clean_sounding]


def test_mains_hum_is_attenuated_by_the_violin_bandpass() -> None:
    sr = 44100
    t = np.arange(sr * 2) / sr
    hum = 0.3 * np.sin(2 * np.pi * 50.0 * t).astype(np.float32)  # 50 Hz mains
    tone = 0.5 * np.sin(2 * np.pi * 440.0 * t).astype(np.float32)  # A4
    mixed = (hum + tone).astype(np.float32)

    filtered = _bandpass(mixed, sr, "violin")

    assert _band_energy(filtered, sr, 50.0) < _band_energy(mixed, sr, 50.0) * 0.01
    assert _band_energy(filtered, sr, 440.0) > _band_energy(mixed, sr, 440.0) * 0.8


def test_clean_audio_survives_preprocessing(synth_melody) -> None:
    path = synth_melody(MELODY, bpm=120)
    audio, sr = sf.read(path, dtype="float32")
    processed = preprocess(audio, sr, "piano")
    assert len(processed) == len(audio)  # time base preserved — no trimming
    # the tone itself is untouched within a small tolerance
    peak_ratio = float(np.max(np.abs(processed))) / float(np.max(np.abs(audio)))
    assert 0.8 <= peak_ratio <= 1.2
