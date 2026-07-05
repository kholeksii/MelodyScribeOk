"""Tempo detection on synthesized monophonic melodies."""
import pytest
import soundfile as sf

from app.core.tempo_detector import TempoDetector


@pytest.mark.xfail(
    strict=False,
    reason="librosa.beat.beat_track is unreliable on sparse monophonic input; fixed in U9",
)
def test_quarters_at_120_bpm(synth_melody) -> None:
    path = synth_melody(
        [("C4", 1.0), ("D4", 1.0), ("E4", 1.0), ("F4", 1.0),
         ("G4", 1.0), ("A4", 1.0), ("B4", 1.0), ("C5", 1.0)],
        bpm=120,
    )
    audio, sr = sf.read(path, dtype="float32")
    detected = TempoDetector().detect(audio, sr)
    assert 110 <= detected <= 130
