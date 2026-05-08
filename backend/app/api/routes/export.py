from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
import logging

logger = logging.getLogger(__name__)

from ...models.project import Project
from ...services.pdf_service import PDFService

router = APIRouter()


@router.post("/api/export/musicxml")
async def export_musicxml(project: Project):
    """
    Export project to MusicXML format.

    MusicXML can be opened in MuseScore, Finale, Sibelius,
    or converted to PDF on the frontend via VexFlow.
    """
    logger.info(f"MusicXML export: {len(project.notes)} notes, title='{project.metadata.title}'")

    if not project.notes:
        raise HTTPException(status_code=400, detail="No notes to export")

    service = PDFService()
    xml_bytes = service.export_musicxml_bytes(project)

    filename = project.metadata.title.replace(" ", "_") or "score"
    return Response(
        content=xml_bytes,
        media_type="application/vnd.recordare.musicxml+xml",
        headers={"Content-Disposition": f"attachment; filename={filename}.musicxml"},
    )
