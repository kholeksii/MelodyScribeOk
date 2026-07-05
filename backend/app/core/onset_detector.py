

class OnsetDetector:
    def detect(self, audio, sr: int) -> list[float]:
        import librosa
        import numpy as np

        # Ensure audio is float32 and mono
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        if audio.ndim > 1:
            audio = audio.mean(axis=0)

        hop_length = 512
        try:
            onset_frames = librosa.onset.onset_detect(
                y=audio, sr=sr, hop_length=hop_length, units="time"
            )
        except Exception as exc:
            raise RuntimeError(f"Onset detection failed: {exc}") from exc

        return sorted([float(t) for t in onset_frames])