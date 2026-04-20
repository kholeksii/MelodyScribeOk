from pathlib import Path
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

from ..core.pitch_detector import PitchDetector
from ..core.onset_detector import OnsetDetector
from ..core.tempo_detector import TempoDetector
from ..core.key_detector import KeyDetector
from ..core.quantizer import Quantizer
from ..models.note import TranscriptionData, NoteData
from ..config import settings

try:
    import librosa
except ImportError:
    librosa = None  # type: ignore

try:
    import numpy as np
except ImportError:
    np = None  # type: ignore

class SegmentationService:
    def __init__(self):
        self.pitch_detector = PitchDetector()
        self.onset_detector = OnsetDetector()
        self.tempo_detector = TempoDetector()
        self.key_detector = KeyDetector()
        self.quantizer = Quantizer()

    def transcribe(self, file_path: str, instrument: str) -> TranscriptionData:
        if librosa is None:
            raise RuntimeError("Audio analysis libraries are not installed.")

        if np is None:
            raise RuntimeError("NumPy is not installed.")

        try:
            logger.info(f"Loading audio from {file_path}")
            # Load audio
            audio, sr = librosa.load(file_path, sr=44100, mono=True)
            logger.info(f"Audio loaded: duration={len(audio)/sr:.2f}s, sr={sr}")
        except Exception as exc:
            logger.error(f"Audio load failed: {exc}", exc_info=True)
            raise RuntimeError(f"Audio load failed: {exc}") from exc

        try:
            # Detect tempo and key
            logger.info("Detecting tempo...")
            tempo = self.tempo_detector.detect(audio, sr)
            logger.info(f"Detected tempo: {tempo} (type={type(tempo).__name__})")
            
            logger.info("Detecting key...")
            key = self.key_detector.detect(audio, sr)
            logger.info(f"Detected key: {key} (type={type(key).__name__})")

            # Detect onsets
            logger.info("Detecting onsets...")
            onsets = self.onset_detector.detect(audio, sr)
            logger.info(f"Detected {len(onsets)} onsets")

            # Detect pitch
            logger.info("Detecting pitch...")
            pitches = self.pitch_detector.detect(audio, sr, instrument)
            logger.info(f"Detected {len(pitches)} pitch values")

            # Segment into notes
            logger.info("Segmenting notes...")
            notes = self._segment_notes(onsets, pitches, tempo)
            logger.info(f"Segmented into {len(notes)} notes")

            # Quantize notes
            logger.info("Quantizing notes...")
            notes = self.quantizer.quantize_notes(notes, tempo)
            logger.info(f"Quantized {len(notes)} notes")
        except Exception as exc:
            logger.error(f"Transcription analysis failed: {exc}", exc_info=True)
            raise RuntimeError(f"Transcription analysis failed: {exc}") from exc

        # Convert to NoteData objects
        logger.info("Converting notes to NoteData objects...")
        note_data = []
        for i, note in enumerate(notes):
            try:
                note_obj = NoteData(
                    id=f"n{i+1}",
                    pitch=note.get("note", "C4"),
                    duration=note.get("duration", "quarter"),
                    start_beat=float(note.get("start_beat", 0.0)),
                    measure=int(note.get("measure", 1)),
                    velocity=80,  # Default velocity
                    confidence=float(note.get("confidence", 0.0)),
                    llm_corrected=False
                )
                note_data.append(note_obj)
            except Exception as e:
                logger.warning(f"Failed to create NoteData for note {i}: {e}, note={note}")
                raise

        logger.info(f"Created {len(note_data)} NoteData objects")
        result = TranscriptionData(
            notes=note_data,
            tempo=int(tempo),
            key=str(key),
            time_signature="4/4",  # Default
            instrument=instrument
        )
        logger.info("Transcription completed successfully")
        return result

    def _segment_notes(self, onsets: List[float], pitches: List[Dict], tempo: int) -> List[Dict]:
        notes = []
        current_measure = 1
        beats_per_measure = 4  # Assuming 4/4

        for i, onset in enumerate(onsets):
            # Find pitches within this segment
            segment_pitches = [
                p for p in pitches
                if onset <= (p['time_ms'] / 1000) < (onsets[i+1] if i+1 < len(onsets) else float('inf'))
            ]

            if segment_pitches:
                import numpy as np

                # Use median pitch
                median_pitch = np.median([p['frequency'] for p in segment_pitches])
                median_note = self.pitch_detector._frequency_to_note(median_pitch)
                avg_confidence = np.mean([p['confidence'] for p in segment_pitches])

                # Calculate duration
                duration_sec = (onsets[i+1] if i+1 < len(onsets) else len(segment_pitches) * 0.01) - onset

                # Calculate start beat
                start_beat = onset * tempo / 60.0

                # Calculate measure
                measure = int(start_beat // beats_per_measure) + 1

                notes.append({
                    "note": median_note,
                    "start_beat": start_beat,
                    "measure": measure,
                    "duration_sec": duration_sec,
                    "confidence": avg_confidence
                })

        return notes