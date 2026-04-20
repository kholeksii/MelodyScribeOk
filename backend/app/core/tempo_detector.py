class TempoDetector:
    def detect(self, audio, sr: int) -> int:
        import librosa
        import numpy as np

        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
        
        # Convert numpy scalar/array to Python int
        if hasattr(tempo, 'item'):
            tempo = tempo.item()
        
        return int(round(float(tempo)))
