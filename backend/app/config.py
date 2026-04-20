from pathlib import Path

class Settings:
    upload_dir: str = "./uploads"
    max_audio_length_sec: int = 600
    ollama_url: str = "http://localhost:11434"

    def __init__(self) -> None:
        self.upload_dir = Path(self.upload_dir)
        self.upload_dir.mkdir(exist_ok=True)

settings = Settings()