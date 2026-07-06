"""Shared fixtures: programmatic WAV synthesis with known ground truth."""
from collections.abc import Callable
from pathlib import Path

import pytest

from tests.synth import synth_melody_file

SynthMelody = Callable[..., Path]


@pytest.fixture
def synth_melody(tmp_path: Path) -> SynthMelody:
    """Factory: synthesize a melody of (pitch, duration_in_beats) tuples to a WAV file."""

    def _synth(
        notes: list[tuple[str, float]],
        bpm: int,
        sr: int = 44100,
        filename: str = "melody.wav",
    ) -> Path:
        return synth_melody_file(tmp_path / filename, notes, bpm, sr)

    return _synth
