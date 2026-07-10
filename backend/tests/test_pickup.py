"""U32 — anacrusis as a true implicit pickup measure (measure 0).

Covers the whole chain: quantizer extraction, end-to-end transcription of a
synthesized pickup melody, MusicXML export (implicit measure) and the
import round-trip through the API.
"""
import pytest
from fastapi.testclient import TestClient

from app.core.quantizer import Quantizer
from app.main import app
from app.models.note import NoteData
from app.models.project import Project, ProjectMetadata
from app.services.pdf_service import PDFService
from app.services.segmentation_service import SegmentationService

client = TestClient(app, raise_server_exceptions=False)


# ── Quantizer.extract_pickup ──────────────────────────────────────────────

def _padded_2_4() -> list[dict]:
    """Quantized layout the meter detector produces for an eighth pickup in
    2/4: rest fills [0, 1.5), pickup at 1.5, bar 2 starts at 2.0."""
    return [
        {"note": "rest", "start_beat": 0.0, "measure": 1, "duration": "quarter."},
        {"note": "G3", "start_beat": 1.5, "measure": 1, "duration": "eighth"},
        {"note": "C4", "start_beat": 2.0, "measure": 2, "duration": "quarter"},
        {"note": "E4", "start_beat": 3.0, "measure": 2, "duration": "quarter"},
    ]


def test_extract_pickup_converts_leading_rest() -> None:
    notes, pickup = Quantizer.extract_pickup(_padded_2_4(), "2/4")
    assert pickup == 0.5
    assert [n["note"] for n in notes] == ["G3", "C4", "E4"]  # rest dropped
    assert notes[0]["start_beat"] == 0.0 and notes[0]["measure"] == 0
    assert notes[1]["start_beat"] == 0.5 and notes[1]["measure"] == 1
    assert notes[2]["start_beat"] == 1.5 and notes[2]["measure"] == 1


def test_extract_pickup_noop_without_leading_rest() -> None:
    plain = [
        {"note": "C4", "start_beat": 0.0, "measure": 1, "duration": "quarter"},
        {"note": "E4", "start_beat": 1.0, "measure": 1, "duration": "quarter"},
    ]
    notes, pickup = Quantizer.extract_pickup(plain, "2/4")
    assert pickup is None
    assert notes == plain


def test_extract_pickup_noop_when_bar1_incomplete() -> None:
    # sounding notes do not reach the bar-2 downbeat — not a pickup layout
    broken = [
        {"note": "rest", "start_beat": 0.0, "measure": 1, "duration": "quarter."},
        {"note": "G3", "start_beat": 1.5, "measure": 1, "duration": "sixteenth"},
    ]
    notes, pickup = Quantizer.extract_pickup(broken, "2/4")
    assert pickup is None


# ── End-to-end on synthesized audio ───────────────────────────────────────

# Habanera-flavored 2/4 melody with an eighth-note pickup (the Que-Lindo
# failure mode, but clean studio timing)
PICKUP_MELODY = [("G3", 0.5)] + [
    note
    for _ in range(6)
    for note in [("C4", 0.75), ("E4", 0.25), ("G4", 0.5), ("E4", 0.5)]
] + [("C4", 2.0)]


@pytest.fixture(scope="module")
def service() -> SegmentationService:
    return SegmentationService()


def test_e2e_pickup_measure_zero(service, synth_melody) -> None:
    path = synth_melody(PICKUP_MELODY, bpm=66)
    result = service.transcribe(str(path), instrument="piano")

    assert result.time_signature == "2/4"
    assert result.pickup_beats == pytest.approx(0.5, abs=0.25)

    first = result.notes[0]
    assert first.pitch != "rest", "pickup must not be preceded by a rest"
    assert first.measure == 0, "the anacrusis lives in implicit measure 0"
    assert first.start_beat == 0.0, "playback starts right at the pickup"

    # the first full bar starts where the pickup ends
    bar1 = [n for n in result.notes if n.measure == 1]
    assert bar1 and bar1[0].start_beat == pytest.approx(
        result.pickup_beats, abs=0.01
    )


# ── MusicXML export + API import round-trip ──────────────────────────────

def _pickup_project() -> Project:
    notes = [
        NoteData(id="n1", pitch="G3", duration="eighth", start_beat=0.0,
                 measure=0, velocity=70, confidence=1.0),
        NoteData(id="n2", pitch="C4", duration="quarter", start_beat=0.5,
                 measure=1, velocity=100, confidence=1.0),
        NoteData(id="n3", pitch="E4", duration="quarter", start_beat=1.5,
                 measure=1, velocity=80, confidence=1.0),
        NoteData(id="n4", pitch="G4", duration="half", start_beat=2.5,
                 measure=2, velocity=90, confidence=1.0),
    ]
    return Project(
        version="1.0",
        metadata=ProjectMetadata(
            title="Pickup Test", instrument="piano", tempo=66,
            time_signature="2/4", key="C major",
        ),
        notes=notes,
    )


def test_musicxml_export_marks_pickup_implicit() -> None:
    xml = PDFService().export_musicxml(_pickup_project())
    assert 'implicit="yes"' in xml

    from music21 import converter, stream

    score = converter.parseData(xml)
    measures = list(score.parts[0].getElementsByClass(stream.Measure))
    assert measures[0].number == 0
    # the pickup bar holds exactly the eighth note
    assert float(measures[0].duration.quarterLength) == pytest.approx(0.5)
    assert [n.nameWithOctave for n in measures[0].notes] == ["G3"]
    # full bars are complete 2/4 measures numbered from 1
    assert measures[1].number == 1
    assert float(measures[1].duration.quarterLength) == pytest.approx(2.0)


def test_musicxml_roundtrip_preserves_pickup() -> None:
    xml_bytes = PDFService().export_musicxml_bytes(_pickup_project())
    response = client.post(
        "/api/import/musicxml",
        files={"file": ("pickup.musicxml", xml_bytes, "application/xml")},
    )
    assert response.status_code == 200
    data = response.json()["data"]

    assert data["time_signature"] == "2/4"
    sounding = [n for n in data["notes"] if n["pitch"] != "rest"]
    assert sounding[0]["pitch"] == "G3"
    assert sounding[0]["measure"] == 0, "pickup measure must survive the round-trip"
    assert sounding[1]["measure"] == 1
    # offsets keep the performance timeline: pickup at 0, downbeat at 0.5
    assert sounding[0]["start_beat"] == pytest.approx(0.0)
    assert sounding[1]["start_beat"] == pytest.approx(0.5)
