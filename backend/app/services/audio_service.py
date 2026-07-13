import logging
import uuid
from pathlib import Path

from fastapi import UploadFile
from pydub import AudioSegment

from ..config import settings
from ..errors import FfmpegMissingError

logger = logging.getLogger(__name__)


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
        raw_path = self.upload_dir / f"{file_id}{file_extension}"

        # Save uploaded file
        contents = await file.read()
        with open(raw_path, "wb") as f:
            f.write(contents)
        logger.info(f"Uploaded {file.filename} -> {raw_path.name} ({len(contents)} bytes)")

        # Microphone recordings arrive as webm (browser MediaRecorder).
        # librosa/soundfile can't decode webm directly and silently falls
        # back to a deprecated, flaky audioread path — convert once here so
        # the rest of the pipeline always sees a wav (B2a).
        final_extension = file_extension
        if file_extension == ".webm":
            wav_path = self.upload_dir / f"{file_id}.wav"
            try:
                AudioSegment.from_file(raw_path, format="webm").export(wav_path, format="wav")
            except Exception as exc:
                logger.error(
                    f"webm->wav conversion failed for {raw_path.name}: {exc}", exc_info=True
                )
                raise FfmpegMissingError(
                    "Could not decode the recording. Is ffmpeg installed? (brew install ffmpeg)"
                ) from exc
            raw_path.unlink(missing_ok=True)
            final_extension = ".wav"
            logger.info(f"Converted {file_id}.webm -> {file_id}.wav")

        # For now, return basic info without loading audio
        # TODO: Add audio loading with librosa when available
        return {
            "file_id": file_id,
            "duration_sec": 0.0,  # Placeholder
            "sample_rate": 44100,  # Default
            "format": final_extension[1:]  # Remove the dot
        }
