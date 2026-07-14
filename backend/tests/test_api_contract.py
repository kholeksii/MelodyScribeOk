"""Every JSON endpoint speaks the same envelope: {success, data, error}."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_health_envelope() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == {"status": "ok"}


def test_transcribe_unknown_file_is_enveloped_404() -> None:
    response = client.post(
        "/api/transcribe", json={"file_id": "does-not-exist", "instrument": "piano"}
    )
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["data"] is None
    assert body["error"]["code"] == "not_found"
    assert "not found" in body["error"]["message"].lower()


def test_upload_bad_extension_is_enveloped_400() -> None:
    response = client.post(
        "/api/upload", files={"file": ("notes.txt", b"not audio", "text/plain")}
    )
    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "bad_request"


def test_validation_error_is_enveloped_422() -> None:
    response = client.post("/api/transcribe", json={"instrument": "piano"})  # no file_id
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "validation_error"


def test_verify_empty_notes_is_enveloped_400() -> None:
    response = client.post(
        "/api/verify",
        json={"notes": [], "instrument": "piano", "tempo": 120, "key": "C"},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "bad_request"


def test_musicxml_export_with_cyrillic_title() -> None:
    """B5b: the app's default title is Cyrillic («Транскрипція — …») and HTTP
    headers are latin-1 — a bare filename= crashed the response with a 400."""
    response = client.post(
        "/api/export/musicxml",
        json={
            "version": "1.0",
            "metadata": {
                "title": "Транскрипція — Фортепіано",
                "instrument": "piano",
                "tempo": 66,
                "time_signature": "3/4",
                "key": "G major",
            },
            "notes": [
                {
                    "id": "n1",
                    "pitch": "D4",
                    "duration": "quarter",
                    "start_beat": 0.0,
                    "measure": 1,
                    "velocity": 80,
                    "confidence": 1.0,
                    "theory_corrected": False,
                }
            ],
        },
    )
    assert response.status_code == 200
    disposition = response.headers["content-disposition"]
    assert "filename=score.musicxml" in disposition  # latin-1-safe fallback
    assert "filename*=UTF-8''" in disposition  # real name, RFC 5987
    assert b"score-partwise" in response.content
