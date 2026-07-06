"""Programmatic WAV synthesis with ground truth known by construction."""
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

SAMPLE_RATE = 44100
FADE_SEC = 0.010
INTER_NOTE_SILENCE_SEC = 0.060  # detached playing so onsets are detectable


def synth_melody_file(
    path: Path,
    notes: list[tuple[str, float]],
    bpm: int,
    sr: int = SAMPLE_RATE,
) -> Path:
    """Synthesize a melody of (pitch, duration_in_beats) tuples to a WAV file.

    Each note is a sine at the pitch frequency with a 10ms fade-in/out and
    60ms of silence before the next note. Pitch "rest" produces silence.
    """
    beat_sec = 60.0 / bpm
    fade_n = int(FADE_SEC * sr)
    silence = np.zeros(int(INTER_NOTE_SILENCE_SEC * sr), dtype=np.float32)

    chunks = []
    for pitch, beats in notes:
        dur_sec = beats * beat_sec - INTER_NOTE_SILENCE_SEC
        n_samples = max(int(dur_sec * sr), 2 * fade_n)
        if pitch == "rest":
            chunks.append(np.zeros(n_samples, dtype=np.float32))
        else:
            freq = librosa.note_to_hz(pitch)
            t = np.arange(n_samples) / sr
            tone = 0.6 * np.sin(2 * np.pi * freq * t).astype(np.float32)
            envelope = np.ones(n_samples, dtype=np.float32)
            envelope[:fade_n] = np.linspace(0.0, 1.0, fade_n)
            envelope[-fade_n:] = np.linspace(1.0, 0.0, fade_n)
            chunks.append(tone * envelope)
        chunks.append(silence)

    audio = np.concatenate(chunks)
    sf.write(path, audio, sr)
    return path
