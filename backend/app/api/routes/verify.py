import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...models.api import ApiResponse, ok
from ...models.note import NoteData
from ...services.theory_checker import TheoryChecker

logger = logging.getLogger(__name__)

router = APIRouter()


class VerifyRequest(BaseModel):
    """Request model for theory-based verification."""
    notes: list[NoteData]
    instrument: str
    tempo: int
    key: str
    time_signature: str = "4/4"


@router.post("/api/verify", response_model=ApiResponse[dict])
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

    return ok(result)
