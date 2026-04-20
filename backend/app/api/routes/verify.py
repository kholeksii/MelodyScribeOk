from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

from ...models.note import NoteData
from ...services.llm_service import LLMService

router = APIRouter()


class VerifyRequest(BaseModel):
    """Request model for LLM verification."""
    notes: List[NoteData]
    instrument: str
    tempo: int
    key: str
    time_signature: str = "4/4"


class VerifyResponse(BaseModel):
    """Response model for LLM verification."""
    success: bool
    data: dict
    error: Optional[str] = None


@router.post("/api/verify", response_model=VerifyResponse)
async def verify_notes(request: VerifyRequest):
    """
    Verify transcribed notes using LLM.
    
    Args:
        request: VerifyRequest with notes and metadata
    
    Returns:
        VerifyResponse with corrections and confidence
    """
    logger.info(f"Verify request: {len(request.notes)} notes, instrument={request.instrument}")
    
    try:
        if not request.notes:
            logger.warning("Empty notes list")
            raise HTTPException(status_code=400, detail="No notes to verify")
        
        if not request.instrument:
            logger.warning("Missing instrument")
            raise HTTPException(status_code=400, detail="Instrument is required")
        
        # Call LLM service
        llm_service = LLMService()
        result = await llm_service.verify(
            notes=request.notes,
            instrument=request.instrument,
            tempo=request.tempo,
            key=request.key,
            time_signature=request.time_signature
        )
        
        logger.info(f"Verification complete: {len(result.get('corrections', []))} corrections")
        
        return VerifyResponse(
            success=True,
            data=result,
            error=result.get("error")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verification error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Verification failed: {str(e)}"
        )
