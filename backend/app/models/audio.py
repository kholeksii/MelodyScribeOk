from pydantic import BaseModel

class AudioUploadResponse(BaseModel):
    success: bool
    data: "AudioInfo"

class AudioInfo(BaseModel):
    file_id: str
    duration_sec: float
    sample_rate: int
    format: str