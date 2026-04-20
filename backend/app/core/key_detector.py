class KeyDetector:
    def detect(self, audio, sr: int) -> str:
        import numpy as np
        import librosa

        # Compute chromagram
        chromagram = librosa.feature.chroma_cqt(y=audio, sr=sr, n_chroma=12)

        # Average over time
        chroma_avg = np.mean(chromagram, axis=1)

        # Key profiles (major and minor)
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

        # Normalize profiles
        major_profile = major_profile / np.linalg.norm(major_profile)
        minor_profile = minor_profile / np.linalg.norm(minor_profile)

        # Correlate with profiles
        major_corr = np.correlate(chroma_avg, major_profile, mode='full')
        minor_corr = np.correlate(chroma_avg, minor_profile, mode='full')

        # Find best match
        max_major = np.max(major_corr)
        max_minor = np.max(minor_corr)

        if max_major > max_minor:
            idx = np.argmax(major_corr)
            root = int(idx.item()) if hasattr(idx, 'item') else int(idx)
            root = root % 12
            mode = "major"
        else:
            idx = np.argmax(minor_corr)
            root = int(idx.item()) if hasattr(idx, 'item') else int(idx)
            root = root % 12
            mode = "minor"

        # Note names
        notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        return f"{notes[root]} {mode}"