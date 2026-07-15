import logging

from ..core.audio_preprocess import preprocess
from ..core.key_detector import KeyDetector
from ..core.meter_detector import MeterDetector
from ..core.onset_detector import OnsetDetector
from ..core.pitch_detector import PitchDetector
from ..core.pitch_postprocess import fold_octave_outliers
from ..core.quantizer import Quantizer
from ..core.tempo_detector import TempoDetector
from ..errors import FfmpegMissingError
from ..models.note import NoteData, TranscriptionData

logger = logging.getLogger(__name__)

try:
    import librosa
except ImportError:
    librosa = None  # type: ignore

try:
    import numpy as np
except ImportError:
    np = None  # type: ignore


MIN_NOTE_CONFIDENCE = 0.3  # phantom-note filter (audit found notes at 0.10)
REST_MIN_BEATS = 0.5  # a silent tail shorter than this stays part of the note
# U51: onsets alone miss slurred (legato) pitch changes — a bowed note change
# under one stroke has no attack. A sustained semitone change inside a
# segment's own pyin trajectory is treated as a second note.
LEGATO_MEDIAN_WINDOW = 5  # ~30ms at the pitch detector's 256-sample hop
LEGATO_MIN_RUN_SEC = 0.06  # a pitch run shorter than this is noise/vibrato, not a new note


def _sounding_duration_sec(segment, sr: int, floor_amp: float) -> float:
    """How long the segment actually sounds before falling to the noise floor."""
    import numpy as np

    window = max(int(0.02 * sr), 1)
    last_sounding = 0
    for k in range(len(segment) // window):
        chunk = segment[k * window : (k + 1) * window]
        if float(np.sqrt(np.mean(chunk**2))) >= floor_amp:
            last_sounding = k + 1
    return last_sounding * window / sr


def _rms_to_velocity(rms: float, rms_max: float) -> int:
    """Map RMS amplitude to MIDI velocity 20–120."""
    if rms_max <= 0:
        return 80
    ratio = min(rms / rms_max, 1.0)
    return int(20 + ratio * 100)


def _split_segment_by_pitch(
    segment_pitches: list[dict],
    min_run_sec: float = LEGATO_MIN_RUN_SEC,
    median_window: int = LEGATO_MEDIAN_WINDOW,
) -> list[list[dict]]:
    """Split an onset segment's pitch frames wherever the trajectory holds a
    new semitone for at least `min_run_sec` (U51 — legato re-segmentation).

    Onsets alone cut notes only at attacks, so a slurred pitch change (one
    bow stroke, two notes) has no onset to split on and the whole slur
    collapses into a single, often-wrong note. This scans the segment's own
    pyin frames, smooths them with a small median filter to ignore vibrato
    and jitter, and looks for a sustained semitone change to split on.
    Returns `[segment_pitches]` unchanged when no such change is found.
    """
    import librosa
    import numpy as np

    if len(segment_pitches) < median_window:
        return [segment_pitches]

    freqs = np.array([p["frequency"] for p in segment_pitches])
    times = np.array([p["time_ms"] / 1000.0 for p in segment_pitches])

    half = median_window // 2
    filtered = np.array([
        np.median(freqs[max(0, i - half): i + half + 1])
        for i in range(len(freqs))
    ])
    semitones = np.round(librosa.hz_to_midi(filtered)).astype(int)

    # Collapse into runs of a stable semitone value
    runs: list[list[int]] = []
    start = 0
    for i in range(1, len(semitones) + 1):
        if i == len(semitones) or semitones[i] != semitones[start]:
            runs.append([start, i, int(semitones[start])])
            start = i

    # Merge runs shorter than min_run_sec into a neighbor — a blip mid-note
    # (vibrato overshoot, a single noisy frame) isn't a real pitch change
    merged: list[list[int]] = []
    for run_start, run_end, value in runs:
        duration = times[run_end - 1] - times[run_start]
        if duration < min_run_sec and merged:
            merged[-1][1] = run_end
        else:
            merged.append([run_start, run_end, value])
    if len(merged) > 1:
        run_start, run_end, _ = merged[0]
        duration = times[run_end - 1] - times[run_start]
        if duration < min_run_sec:
            merged[1][0] = run_start
            merged.pop(0)

    if len(merged) < 2:
        return [segment_pitches]

    return [segment_pitches[s:e] for s, e, _ in merged]


def _detect_articulation(duration_sec: float, gap_sec: float) -> str | None:
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
    # U34: above this share of tie_start notes the grid is considered wrong
    TIE_FLOOD_SHARE = 0.2

    def __init__(self):
        self.pitch_detector = PitchDetector()
        self.onset_detector = OnsetDetector()
        self.tempo_detector = TempoDetector()
        self.key_detector = KeyDetector()
        self.meter_detector = MeterDetector()
        self.quantizer = Quantizer()

    def transcribe(
        self,
        file_path: str,
        instrument: str,
        bpm: int | None = None,
        time_signature: str | None = None,
        key: str | None = None,
    ) -> TranscriptionData:
        if librosa is None:
            raise RuntimeError("Audio analysis libraries are not installed.")

        if np is None:
            raise RuntimeError("NumPy is not installed.")

        try:
            logger.info(f"Loading audio from {file_path}")
            audio, loaded_sr = librosa.load(file_path, sr=44100, mono=True)
            sr = int(loaded_sr)
            logger.info(f"Audio loaded: duration={len(audio)/sr:.2f}s, sr={sr}")
        except Exception as exc:
            err_str = str(exc).lower()
            if "audioread" in err_str or "ffmpeg" in err_str or "codec" in err_str:
                raise FfmpegMissingError() from exc
            logger.error(f"Audio load failed: {exc}", exc_info=True)
            raise RuntimeError(f"Audio load failed: {exc}") from exc

        try:
            # Onset/pitch detection runs on pre-filtered audio; key detection
            # keeps the raw signal — filtering skews the chroma balance
            raw_audio = audio
            logger.info("Pre-filtering audio (bandpass + noise gate)...")
            audio = preprocess(audio, sr, instrument)

            logger.info("Detecting onsets...")
            onsets = self.onset_detector.detect(audio, sr, instrument=instrument)
            logger.info(f"Detected {len(onsets)} onsets")

            if bpm is not None:
                logger.info(f"Using user-supplied BPM: {bpm}")
                tempo = bpm
            else:
                logger.info("Detecting tempo from inter-onset intervals...")
                tempo = self.tempo_detector.detect(audio, sr, onsets=onsets)
            logger.info(f"Detected tempo: {tempo} (type={type(tempo).__name__})")

            logger.info("Detecting pitch...")
            pitches = self.pitch_detector.detect(audio, sr, instrument)
            logger.info(f"Detected {len(pitches)} pitch values")

            logger.info("Segmenting notes...")
            notes = self._segment_notes(onsets, pitches, tempo, audio, sr)
            logger.info(f"Segmented into {len(notes)} notes")

            # Meter: trust the user's explicit choice; otherwise run the joint
            # (meter × tempo-level × phase) search on the segmented notes (U31)
            ts_confidence: float | None = None
            if time_signature is not None:
                ts = time_signature
                logger.info("Quantizing notes...")
                notes = self.quantizer.quantize_notes(notes, tempo, time_signature=ts)
                notes, pickup_beats = self.quantizer.extract_pickup(notes, ts)
            else:
                logger.info("Detecting meter (joint meter/level/phase search)...")
                segmented = notes
                meter = self.meter_detector.detect(
                    segmented, allow_half_level=(bpm is None), bpm=int(tempo)
                )
                notes, quantized_tempo, pickup_beats = self._grid_and_quantize(
                    segmented, tempo, meter
                )

                # Self-diagnosis (U34): a flood of cross-barline ties means
                # the grid is almost certainly wrong — retry once with the
                # winning hypothesis excluded and keep the cleaner result
                tie_share = self._tie_share(notes)
                if tie_share > self.TIE_FLOOD_SHARE:
                    logger.info(
                        f"Grid suspect: {tie_share:.0%} notes tied across "
                        f"barlines — retrying without {meter.time_signature}/"
                        f"lv{meter.level}/ph{meter.phase}"
                    )
                    retry = self.meter_detector.detect(
                        segmented,
                        allow_half_level=(bpm is None),
                        bpm=int(tempo),
                        exclude={(meter.time_signature, meter.level, meter.phase)},
                    )
                    retry_notes, retry_tempo, retry_pickup = self._grid_and_quantize(
                        segmented, tempo, retry
                    )
                    if self._tie_share(retry_notes) < tie_share:
                        logger.info(
                            f"Retry grid is cleaner: {retry.time_signature} "
                            f"({self._tie_share(retry_notes):.0%} ties)"
                        )
                        meter, notes = retry, retry_notes
                        quantized_tempo, pickup_beats = retry_tempo, retry_pickup

                ts = meter.time_signature
                ts_confidence = meter.confidence
                tempo = quantized_tempo
                logger.info(
                    f"Meter: {ts} (level={meter.level}, phase={meter.phase}, "
                    f"confidence={meter.confidence:.2f}, tempo {tempo})"
                )

            logger.info(f"Quantized {len(notes)} notes")
            logger.info(f"Duration distribution: {self._duration_histogram(notes)}")
            if pickup_beats is not None:
                logger.info(f"Pickup measure extracted: {pickup_beats} beats")

            if key is not None:
                logger.info(f"Using user-supplied key: {key}")
                detected_key = key
            else:
                # Segmented notes are cleaner than raw chroma (no overtones);
                # fall back to the chroma path only for very short takes
                pitches_seq = [n.get("note", "rest") for n in notes]
                durations_seq = [
                    self.quantizer.DURATION_MAP.get(n.get("duration", "quarter"), 1.0)
                    for n in notes
                ]
                if sum(1 for p in pitches_seq if p != "rest") >= 8:
                    logger.info("Detecting key from segmented notes + chroma...")
                    detected_key = self.key_detector.detect_combined(
                        raw_audio, sr, pitches_seq, durations_seq
                    )
                else:
                    logger.info("Detecting key from chroma (short take)...")
                    detected_key = self.key_detector.detect(raw_audio, sr)
                logger.info(f"Detected key: {detected_key}")
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
                    theory_corrected=False,
                    articulation=note.get("articulation"),
                    tuplet=note.get("tuplet"),
                    tie_start=bool(note.get("tie_start", False)),
                    tie_end=bool(note.get("tie_end", False)),
                )
                note_data.append(note_obj)
            except Exception as e:
                logger.warning(f"Failed to create NoteData for note {i}: {e}, note={note}")
                raise

        logger.info(f"Created {len(note_data)} NoteData objects")
        result = TranscriptionData(
            notes=note_data,
            tempo=int(tempo),
            key=str(detected_key),
            time_signature=ts,
            time_signature_confidence=ts_confidence,
            pickup_beats=pickup_beats,
            instrument=instrument,
        )
        logger.info("Transcription completed successfully")
        return result

    def _grid_and_quantize(
        self, segmented: list[dict], tempo: int, meter
    ) -> tuple[list[dict], int, float | None]:
        """Apply a meter hypothesis to freshly segmented notes and quantize:
        rescale/shift the grid (U31), quantize, extract the pickup (U32).
        Leaves `segmented` untouched so the U34 retry can re-use it."""
        if meter.level != 1.0 or meter.phase != 0.0:
            notes = self.meter_detector.apply(segmented, meter)
            new_tempo = max(1, int(round(tempo * meter.level)))
        else:
            notes = [dict(n) for n in segmented]
            new_tempo = int(tempo)
        notes = self.quantizer.quantize_notes(
            notes, new_tempo, time_signature=meter.time_signature
        )
        notes, pickup_beats = self.quantizer.extract_pickup(
            notes, meter.time_signature
        )
        return notes, new_tempo, pickup_beats

    @staticmethod
    def _duration_histogram(notes: list[dict]) -> dict[str, int]:
        """B2/B3 diagnostic: a lopsided count toward the shortest value
        (e.g. almost everything landing on "sixteenth") usually means the
        tempo used for quantization was wrong, not that the grid is."""
        counts: dict[str, int] = {}
        for n in notes:
            d = n.get("duration", "?")
            counts[d] = counts.get(d, 0) + 1
        return dict(sorted(counts.items(), key=lambda kv: kv[1], reverse=True))

    @staticmethod
    def _tie_share(notes: list[dict]) -> float:
        """Share of notes tied across a barline — the U34 grid-health metric."""
        if not notes:
            return 0.0
        return sum(1 for n in notes if n.get("tie_start")) / len(notes)

    def _segment_notes(
        self,
        onsets: list[float],
        pitches: list[dict],
        tempo: int,
        audio=None,
        sr: int = 44100,
    ) -> list[dict]:
        notes = []
        beats_per_measure = 4

        # Pre-compute per-segment RMS values for velocity mapping
        rms_values: list[float] = []
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
        pitch_times = (
            _np.array([p["time_ms"] / 1000.0 for p in pitches]) if pitches else _np.array([])
        )

        beat_sec = 60.0 / tempo
        peak = float(_np.max(_np.abs(audio))) if audio is not None and len(audio) else 0.0
        floor_amp = peak * (10.0 ** (-40.0 / 20.0)) if peak > 0 else 0.0

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

            velocity = _rms_to_velocity(rms_values[i], rms_max)

            # U51: a legato pitch change inside this onset segment (no
            # attack to split on) becomes a second/third note here
            partitions = _split_segment_by_pitch(segment_pitches)
            if len(partitions) > 1:
                logger.debug(
                    f"Onset {i} at {onset:.3f}s: split into {len(partitions)} "
                    f"notes by sustained pitch change (legato)"
                )

            for p_idx, partition in enumerate(partitions):
                is_last = p_idx == len(partitions) - 1
                part_start = onset if p_idx == 0 else partition[0]["time_ms"] / 1000.0
                part_end = next_onset if is_last else partitions[p_idx + 1][0]["time_ms"] / 1000.0

                freqs = _np.array([p['frequency'] for p in partition])
                median_pitch = float(_np.median(freqs))
                median_note = self.pitch_detector._frequency_to_note(median_pitch)

                # Confidence = pitch stability: low std relative to median → high confidence
                if len(freqs) > 1:
                    rel_std = float(_np.std(freqs) / median_pitch) if median_pitch > 0 else 1.0
                    confidence = float(_np.clip(1.0 - rel_std * 5, 0.1, 1.0))
                else:
                    confidence = 0.75  # single frame — medium confidence

                duration_sec = part_end - part_start
                start_beat = part_start * tempo / 60.0
                measure = int(start_beat // beats_per_measure) + 1

                articulation = _detect_articulation(duration_sec, duration_sec)

                # Split off a rest when the tail of the segment is silent
                # (only meaningful for the last note — legato splits are
                # continuous sound by construction)
                rest = None
                if is_last and audio is not None and floor_amp > 0:
                    segment = audio[int(part_start * sr) : int(part_end * sr)]
                    sounding_sec = _sounding_duration_sec(segment, sr, floor_amp)
                    silent_tail = duration_sec - sounding_sec
                    if sounding_sec > 0 and silent_tail >= REST_MIN_BEATS * beat_sec:
                        duration_sec = sounding_sec
                        rest_start = start_beat + sounding_sec * tempo / 60.0
                        rest = {
                            "note": "rest",
                            "start_beat": rest_start,
                            "measure": int(rest_start // beats_per_measure) + 1,
                            "duration_sec": silent_tail,
                            "confidence": 1.0,
                            "velocity": 0,
                            "articulation": None,
                        }

                logger.debug(
                    f"Onset {i} at {part_start:.3f}s → {median_note} (conf={confidence:.2f})"
                )
                notes.append({
                    "note": median_note,
                    "start_beat": start_beat,
                    "measure": measure,
                    "duration_sec": duration_sec,
                    "confidence": confidence,
                    "velocity": velocity,
                    "articulation": articulation,
                })
                if rest is not None:
                    notes.append(rest)

        notes = self._filter_phantom_notes(notes, tempo)
        notes = fold_octave_outliers(notes)

        logger.info(
            f"_segment_notes: {len(onsets)} onsets, {len(pitches)} pitches -> {len(notes)} notes"
        )
        return notes

    @staticmethod
    def _filter_phantom_notes(notes: list[dict], tempo: int) -> list[dict]:
        """Drop notes below the confidence floor (the audit found phantoms at
        0.10); a dropped note spanning a beat or more becomes a rest so the
        rhythm grid keeps its shape."""
        beat_sec = 60.0 / tempo
        filtered: list[dict] = []
        for note in notes:
            if note["note"] == "rest" or note["confidence"] >= MIN_NOTE_CONFIDENCE:
                filtered.append(note)
                continue
            if note["duration_sec"] >= beat_sec:
                filtered.append({**note, "note": "rest", "velocity": 0, "confidence": 1.0})
        return filtered
