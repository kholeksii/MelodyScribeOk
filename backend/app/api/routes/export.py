import logging

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import Response

from ...models.note import NoteData
from ...models.project import Project
from ...services.pdf_service import PDFService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/export/musicxml")
async def export_musicxml(project: Project):
    """Export project to MusicXML — open in MuseScore, Finale, Sibelius."""
    logger.info(f"MusicXML export: {len(project.notes)} notes")

    if not project.notes:
        raise HTTPException(status_code=400, detail="No notes to export")

    service = PDFService()
    xml_bytes = service.export_musicxml_bytes(project)

    filename = (project.metadata.title or "score").replace(" ", "_")
    return Response(
        content=xml_bytes,
        media_type="application/vnd.recordare.musicxml+xml",
        headers={"Content-Disposition": f"attachment; filename={filename}.musicxml"},
    )


@router.post("/api/import/musicxml")
async def import_musicxml(file: UploadFile):
    """Import a MusicXML file and return notes in internal format."""
    fname = (file.filename or "").lower()
    if not fname.endswith((".musicxml", ".xml", ".mxl")):
        raise HTTPException(status_code=400, detail="File must be .musicxml, .xml, or .mxl")

    try:
        from music21 import converter, meter, stream
        from music21 import key as m21key
        from music21 import note as m21note
        from music21 import tempo as m21tempo

        content = await file.read()
        score = converter.parseData(content.decode("utf-8", errors="replace"))
        if isinstance(score, stream.Opus):
            first_score = score.scores.first()
            if first_score is None:
                raise HTTPException(status_code=422, detail="Empty MusicXML opus")
            score = first_score
        score_parts = score.parts if isinstance(score, stream.Score) else [score]

        # Metadata
        has_title = score.metadata and score.metadata.title
        title = score.metadata.title if has_title else "Imported Score"

        bpm = 120
        for el in score.flat.getElementsByClass(m21tempo.MetronomeMark):
            if el.number:
                bpm = int(el.number)
                break

        time_sig = "4/4"
        for el in score.flat.getElementsByClass(meter.TimeSignature):
            time_sig = el.ratioString
            break

        key_str = "C"
        for el in score.flat.getElementsByClass(m21key.KeySignature):
            key_str = el.asKey().tonic.name
            break

        beats_per_measure = _beats_from_sig(time_sig)

        # Extract notes from first part only (monophonic)
        notes = []
        for i, part in enumerate(score_parts):
            for idx, element in enumerate(part.flat.notesAndRests):
                ql = float(element.duration.quarterLength)
                start_beat = float(element.offset)
                measure_num = int(start_beat // beats_per_measure) + 1

                if isinstance(element, m21note.Rest):
                    notes.append(NoteData(
                        id=f"n{idx + 1}",
                        pitch="rest",
                        duration=_ql_to_duration(ql),
                        start_beat=start_beat,
                        measure=measure_num,
                        velocity=0,
                        confidence=1.0,
                        theory_corrected=False,
                    ))
                elif isinstance(element, m21note.Note):
                    notes.append(NoteData(
                        id=f"n{idx + 1}",
                        pitch=f"{element.pitch.name}{element.pitch.octave}",
                        duration=_ql_to_duration(ql),
                        start_beat=start_beat,
                        measure=measure_num,
                        velocity=int(element.volume.velocity or 80),
                        confidence=1.0,
                        theory_corrected=False,
                    ))
            break  # first part only

        logger.info(f"MusicXML import: {len(notes)} notes from '{title}'")
        return {
            "success": True,
            "data": {
                "title": title,
                "instrument": "piano",
                "tempo": bpm,
                "time_signature": time_sig,
                "key": key_str,
                "notes": [n.model_dump() for n in notes],
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MusicXML import error: {e}", exc_info=True)
        raise HTTPException(status_code=422, detail=f"Could not parse MusicXML: {str(e)}")


def _beats_from_sig(time_sig: str) -> float:
    parts = time_sig.split("/")
    if len(parts) != 2:
        return 4.0
    return int(parts[0]) * (4.0 / int(parts[1]))


def _ql_to_duration(ql: float) -> str:
    candidates = [
        (4.0, "whole"), (3.0, "half."), (2.0, "half"),
        (1.5, "quarter."), (1.0, "quarter"),
        (0.75, "eighth."), (0.5, "eighth"), (0.25, "sixteenth"),
    ]
    return min(candidates, key=lambda x: abs(x[0] - ql))[1]
