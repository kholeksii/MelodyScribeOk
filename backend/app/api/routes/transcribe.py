from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

from ...models.note import TranscriptionResult
from ...config import settings
from ...errors import FfmpegMissingError

class TranscribeRequest(BaseModel):
    file_id: str
    instrument: str
    bpm: Optional[int] = None
    time_signature: Optional[str] = None
    key: Optional[str] = None

router = APIRouter()

@router.post("/api/transcribe", response_model=TranscriptionResult)
def transcribe_audio(request: TranscribeRequest):
    logger.info(f"Transcribe request: file_id={request.file_id}, instrument={request.instrument}")
    try:
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
        result = segmentation_service.transcribe(
            str(file_path),
            request.instrument,
            bpm=request.bpm,
            time_signature=request.time_signature,
            key=request.key,
        )
        logger.info(f"Transcription completed: {len(result.notes)} notes")

        return TranscriptionResult(success=True, data=result)

    except FfmpegMissingError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        logger.error(f"ValueError: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
