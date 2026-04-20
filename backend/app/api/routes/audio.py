from fastapi import APIRouter, UploadFile, HTTPException
from ...services.audio_service import AudioService

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