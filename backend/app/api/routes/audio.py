from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ...config import settings
from ...models.api import ApiResponse, ok
from ...services.audio_service import AudioService

router = APIRouter(prefix="/api")
audio_service = AudioService()

@router.post("/upload", response_model=ApiResponse[dict])
async def upload_audio(file: UploadFile):
    # ValueError (bad extension, missing filename) and unexpected errors are
    # mapped to the error envelope by the handlers in main.py
    audio_info = await audio_service.upload_file(file)
    return ok(audio_info)


@router.get("/audio/{file_id}")
async def get_audio(file_id: str):
    upload_dir = Path(settings.upload_dir)
    for ext in (".wav", ".mp3", ".flac", ".ogg", ".m4a", ".webm"):
        path = upload_dir / f"{file_id}{ext}"
        if path.exists():
            media_types = {
                ".wav": "audio/wav",
                ".mp3": "audio/mpeg",
                ".flac": "audio/flac",
                ".ogg": "audio/ogg",
                ".m4a": "audio/mp4",
                ".webm": "audio/webm",
            }
            return FileResponse(path, media_type=media_types[ext])
    raise HTTPException(status_code=404, detail="Audio file not found")