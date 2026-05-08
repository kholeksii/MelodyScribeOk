from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

from ...models.note import NoteData
from ...services.theory_checker import TheoryChecker

router = APIRouter()


class VerifyRequest(BaseModel):
    """Request model for theory-based verification."""
    notes: List[NoteData]
    instrument: str
    tempo: int
    key: str
    time_signature: str = "4/4"


class VerifyResponse(BaseModel):
    """Response model for verification."""
    success: bool
    data: dict
    error: Optional[str] = None


@router.post("/api/verify", response_model=VerifyResponse)
async def verify_notes(request: VerifyRequest):
    """
    Verify transcribed notes using music theory rules.

    Checks instrument range, interval plausibility,
    measure completeness, and enharmonic spelling.
    """
    logger.info(f"Verify request: {len(request.notes)} notes, instrument={request.instrument}")

    if not request.notes:
        raise HTTPException(status_code=400, detail="No notes to verify")

    if not request.instrument:
        raise HTTPException(status_code=400, detail="Instrument is required")

    checker = TheoryChecker()
    result = checker.verify(
        notes=request.notes,
        instrument=request.instrument,
        tempo=request.tempo,
        key=request.key,
        time_signature=request.time_signature,
    )

    logger.info(f"Verification complete: {len(result.get('corrections', []))} corrections")

    return VerifyResponse(
        success=True,
        data=result,
    )
