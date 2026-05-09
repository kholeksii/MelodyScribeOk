from pathlib import Path
from fastapi import APIRouter, UploadFile, HTTPException
from fastapi.responses import FileResponse
from ...services.audio_service import AudioService
from ...config import settings

router = APIRouter(prefix="/api")
audio_service = AudioService()

@router.post("/upload")
async def upload_audio(file: UploadFile):
    try:
        audio_info = await audio_service.upload_file(file)
        return {"success": True, "data": audio_info}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/audio/{file_id}")
async def get_audio(file_id: str):
    upload_dir = Path(settings.upload_dir)
    for ext in (".wav", ".mp3", ".flac", ".ogg", ".m4a"):
        path = upload_dir / f"{file_id}{ext}"
        if path.exists():
            media_types = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".flac": "audio/flac", ".ogg": "audio/ogg", ".m4a": "audio/mp4"}
            return FileResponse(path, media_type=media_types[ext])
    raise HTTPException(status_code=404, detail="Audio file not found")