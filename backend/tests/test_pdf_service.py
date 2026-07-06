"""MusicXML export: dotted durations, ties, triplets (U13)."""
from app.models.note import NoteData
from app.models.project import Project, ProjectMetadata
from app.services.pdf_service import PDFService


def _note(id_: str, pitch: str, duration: str, start_beat: float, measure: int, **kw) -> NoteData:
    return NoteData(
        id=id_,
        pitch=pitch,
        duration=duration,
        start_beat=start_beat,
        measure=measure,
        velocity=80,
        confidence=1.0,
        **kw,
    )


def _project(notes: list[NoteData]) -> Project:
    return Project(
        version="1.0",
        metadata=ProjectMetadata(
            title="Test", instrument="piano", tempo=120, time_signature="4/4", key="C major"
        ),
        notes=notes,
    )


def test_dotted_duration_exports_with_a_dot() -> None:
    xml = PDFService().export_musicxml(
        _project([
            _note("n1", "C4", "quarter.", 0.0, 1),
            _note("n2", "D4", "eighth", 1.5, 1),
            _note("n3", "E4", "half", 2.0, 1),
        ])
    )
    assert "<dot" in xml


def test_tied_pair_exports_tie_elements() -> None:
    xml = PDFService().export_musicxml(
        _project([
            _note("n1", "C4", "half.", 0.0, 1),
            _note("n2", "G4", "quarter", 3.0, 1, tie_start=True),
            _note("n3", "G4", "quarter", 4.0, 2, tie_end=True),
            _note("n4", "E4", "half.", 5.0, 2),
        ])
    )
    assert 'tie type="start"' in xml
    assert 'tie type="stop"' in xml


def test_triplet_exports_time_modification() -> None:
    xml = PDFService().export_musicxml(
        _project([
            _note("n1", "C4", "eighth", 0.0, 1, tuplet="triplet"),
            _note("n2", "D4", "eighth", 1 / 3, 1, tuplet="triplet"),
            _note("n3", "E4", "eighth", 2 / 3, 1, tuplet="triplet"),
            _note("n4", "F4", "half.", 1.0, 1),
        ])
    )
    assert "<time-modification>" in xml
    assert "<actual-notes>3</actual-notes>" in xml
