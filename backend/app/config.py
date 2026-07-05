from pathlib import Path


class Settings:
    max_audio_length_sec: int = 600

    def __init__(self) -> None:
        self.upload_dir: Path = Path("./uploads")
        self.upload_dir.mkdir(exist_ok=True)


settings = Settings()
