class FfmpegMissingError(Exception):
    """Raised when M4A/MP3 transcription fails due to missing ffmpeg."""

    def __init__(self, message: str = "M4A and MP3 require ffmpeg. Install: brew install ffmpeg"):
        super().__init__(message)
