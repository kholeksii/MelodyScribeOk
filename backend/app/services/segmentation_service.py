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


def _rms_to_velocity(rms: float, rms_max: float) -> int:
    """Map RMS amplitude to MIDI velocity 20–120."""
    if rms_max <= 0:
        return 80
    ratio = min(rms / rms_max, 1.0)
    return int(20 + ratio * 100)


def _detect_articulation(duration_sec: float, gap_sec: float) -> Optional[str]:
    """staccato if note is short relative to gap; legato if gap is very small."""
    if gap_sec <= 0:
        return None
    ratio = duration_sec / gap_sec
    if ratio < 0.4:
        return "staccato"
    if gap_sec < 0.04:
        return "legato"
    return None


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
            audio, sr = librosa.load(file_path, sr=44100, mono=True)
            logger.info(f"Audio loaded: duration={len(audio)/sr:.2f}s, sr={sr}")
        except Exception as exc:
            logger.error(f"Audio load failed: {exc}", exc_info=True)
            raise RuntimeError(f"Audio load failed: {exc}") from exc

        try:
            logger.info("Detecting tempo...")
            tempo = self.tempo_detector.detect(audio, sr)
            logger.info(f"Detected tempo: {tempo} (type={type(tempo).__name__})")

            logger.info("Detecting key...")
            key = self.key_detector.detect(audio, sr)
            logger.info(f"Detected key: {key} (type={type(key).__name__})")

            logger.info("Detecting onsets...")
            onsets = self.onset_detector.detect(audio, sr)
            logger.info(f"Detected {len(onsets)} onsets")

            logger.info("Detecting pitch...")
            pitches = self.pitch_detector.detect(audio, sr, instrument)
            logger.info(f"Detected {len(pitches)} pitch values")

            logger.info("Segmenting notes...")
            notes = self._segment_notes(onsets, pitches, tempo, audio, sr)
            logger.info(f"Segmented into {len(notes)} notes")

            logger.info("Quantizing notes...")
            notes = self.quantizer.quantize_notes(notes, tempo, time_signature="4/4")
            logger.info(f"Quantized {len(notes)} notes")
        except Exception as exc:
            logger.error(f"Transcription analysis failed: {exc}", exc_info=True)
            raise RuntimeError(f"Transcription analysis failed: {exc}") from exc

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
                    velocity=int(note.get("velocity", 80)),
                    confidence=float(note.get("confidence", 0.0)),
                    llm_corrected=False,
                    articulation=note.get("articulation"),
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
            time_signature="4/4",
            instrument=instrument,
        )
        logger.info("Transcription completed successfully")
        return result

    def _segment_notes(
        self,
        onsets: List[float],
        pitches: List[Dict],
        tempo: int,
        audio=None,
        sr: int = 44100,
    ) -> List[Dict]:
        notes = []
        beats_per_measure = 4

        # Pre-compute per-segment RMS values for velocity mapping
        rms_values: List[float] = []
        for i, onset in enumerate(onsets):
            end = onsets[i + 1] if i + 1 < len(onsets) else onset + 0.5
            if audio is not None and np is not None:
                start_sample = int(onset * sr)
                end_sample = int(end * sr)
                segment = audio[start_sample:end_sample]
                rms = float(np.sqrt(np.mean(segment ** 2))) if len(segment) > 0 else 0.0
            else:
                rms = 0.0
            rms_values.append(rms)

        rms_max = max(rms_values) if rms_values else 1.0

        import numpy as _np

        # Build arrays for fast nearest-pitch lookup
        pitch_times = _np.array([p['time_ms'] / 1000.0 for p in pitches]) if pitches else _np.array([])

        for i, onset in enumerate(onsets):
            next_onset = onsets[i + 1] if i + 1 < len(onsets) else onset + 0.5

            # Prefer pitches strictly within the onset window
            segment_pitches = [
                p for p in pitches
                if onset <= (p['time_ms'] / 1000) < next_onset
            ]

            # Fallback: nearest pitch within 300 ms of the onset
            if not segment_pitches and len(pitch_times) > 0:
                dists = _np.abs(pitch_times - onset)
                nearest_idx = int(_np.argmin(dists))
                if dists[nearest_idx] < 0.3:
                    segment_pitches = [pitches[nearest_idx]]

            if not segment_pitches:
                logger.debug(f"Onset {i} at {onset:.3f}s: no pitch found, skipping")
                continue

            median_pitch = float(_np.median([p['frequency'] for p in segment_pitches]))
            median_note = self.pitch_detector._frequency_to_note(median_pitch)
            avg_confidence = float(_np.mean([p['confidence'] for p in segment_pitches]))

            duration_sec = next_onset - onset
            start_beat = onset * tempo / 60.0
            measure = int(start_beat // beats_per_measure) + 1

            velocity = _rms_to_velocity(rms_values[i], rms_max)
            articulation = _detect_articulation(duration_sec, duration_sec)

            logger.debug(f"Onset {i} at {onset:.3f}s → {median_note} (conf={avg_confidence:.2f})")
            notes.append({
                "note": median_note,
                "start_beat": start_beat,
                "measure": measure,
                "duration_sec": duration_sec,
                "confidence": avg_confidence,
                "velocity": velocity,
                "articulation": articulation,
            })

        logger.info(f"_segment_notes: {len(onsets)} onsets, {len(pitches)} pitch frames → {len(notes)} notes")
        return notes
