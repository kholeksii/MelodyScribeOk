import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...config import settings
from ...models.api import ApiResponse, ok
from ...models.note import TranscriptionData

logger = logging.getLogger(__name__)


class TranscribeRequest(BaseModel):
    file_id: str
    instrument: str
    bpm: int | None = None
    time_signature: str | None = None
    key: str | None = None

router = APIRouter()

@router.post("/api/transcribe", response_model=ApiResponse[TranscriptionData])
def transcribe_audio(request: TranscribeRequest):
    logger.info(f"Transcribe request: file_id={request.file_id}, instrument={request.instrument}")
    upload_dir = Path(settings.upload_dir)
    file_path = None
    for ext in ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.webm']:
        candidate = upload_dir / f"{request.file_id}{ext}"
        if candidate.exists():
            file_path = candidate
            break

    if not file_path:
        logger.error(f"Audio file not found for {request.file_id}")
        raise HTTPException(status_code=404, detail="Audio file not found")

    logger.info(f"Found audio file: {file_path}")
    from ...services.segmentation_service import SegmentationService
    segmentation_service = SegmentationService()

    logger.info("Starting transcription...")
    # FfmpegMissingError / ValueError / RuntimeError are mapped to the error
    # envelope by the app-level exception handlers in main.py
    result = segmentation_service.transcribe(
        str(file_path),
        request.instrument,
        bpm=request.bpm,
        time_signature=request.time_signature,
        key=request.key,
    )
    logger.info(f"Transcription completed: {len(result.notes)} notes")

    return ok(result)
