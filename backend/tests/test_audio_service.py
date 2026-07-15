"""Upload should report the real duration/sample rate, not the 0.0 stub (U41)."""
import io
import wave

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def _make_wav_bytes(duration_sec: float = 0.5, sample_rate: int = 44100) -> bytes:
    buf = io.BytesIO()
    n_frames = int(duration_sec * sample_rate)
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(b"\x00\x00" * n_frames)
    return buf.getvalue()


def test_upload_reports_real_duration() -> None:
    wav_bytes = _make_wav_bytes(duration_sec=0.5)
    response = client.post(
        "/api/upload", files={"file": ("melody.wav", wav_bytes, "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["duration_sec"] == pytest.approx(0.5, abs=0.02)
    assert data["sample_rate"] == 44100
    assert data["format"] == "wav"
