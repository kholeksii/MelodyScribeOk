import uuid
from pathlib import Path

from fastapi import UploadFile

# from pydub import AudioSegment  # Temporarily disabled due to Python 3.13 compatibility
from ..config import settings


class AudioService:
    def __init__(self):
        self.upload_dir = Path(settings.upload_dir)
        self.upload_dir.mkdir(exist_ok=True)

    async def upload_file(self, file: UploadFile) -> dict:
        # Check file extension
        allowed_extensions = {'.wav', '.mp3', '.flac', '.ogg', '.m4a', '.webm'}
        if not file.filename:
            raise ValueError("Uploaded file has no filename.")
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in allowed_extensions:
            raise ValueError("Unsupported audio format. Use WAV, MP3, FLAC, or OGG.")

        # Generate unique file ID
        file_id = str(uuid.uuid4())
        file_path = self.upload_dir / f"{file_id}{file_extension}"

        # Save uploaded file
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        # For now, return basic info without loading audio
        # TODO: Add audio loading with librosa when available
        return {
            "file_id": file_id,
            "duration_sec": 0.0,  # Placeholder
            "sample_rate": 44100,  # Default
            "format": file_extension[1:]  # Remove the dot
        }