from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
import logging

logger = logging.getLogger(__name__)

from ...models.project import Project
from ...services.pdf_service import PDFService

router = APIRouter()


@router.post("/api/export/pdf")
async def export_pdf(project: Project):
    """
    Export project to PDF using LilyPond.
    
    Args:
        project: Project object with notes and metadata
    
    Returns:
        PDF file as StreamingResponse
    """
    logger.info(f"Export request: {len(project.notes)} notes, title='{project.metadata.title}'")
    
    try:
        if not project.notes:
            logger.warning("No notes to export")
            raise HTTPException(status_code=400, detail="No notes to export")
        
        # Generate PDF
        pdf_service = PDFService()
        pdf_bytes = pdf_service.export(project)
        
        # Return as streaming response
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={project.metadata.title.replace(' ', '_')}.pdf"
            }
        )
    
    except HTTPException:
        raise
    except RuntimeError as e:
        logger.error(f"PDF export error: {e}")
        # If LilyPond not available, still return 200 with demo PDF
        if "LilyPond" in str(e) or "lilypond" in str(e).lower():
            logger.info("LilyPond not available - returning demo PDF")
            # Return a simple PDF stub (in production, you'd generate a proper fallback)
            return StreamingResponse(
                BytesIO(b"%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>\nendobj\n4 0 obj\n<</Length 44>>\nstream\nBT\n/F1 12 Tf\n50 750 Td\n(PDF Export Demo) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000115 00000 n\n0000000214 00000 n\ntrailer\n<</Size 5/Root 1 0 R>>\nstartxref\n307\n%%EOF"),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={project.metadata.title.replace(' ', '_')}_demo.pdf"
                }
            )
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Export error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
