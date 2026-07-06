"""Per-instrument audio pre-filtering: bandpass + noise gate (U14).

The time base is deliberately preserved (no trimming): the frontend syncs
playback and the waveform against the ORIGINAL audio, so gated frames are
zeroed in place and the bandpass is zero-phase.
"""
from .pitch_detector import INSTRUMENT_RANGES

RANGE_WIDENING = 1.414  # half an octave beyond the instrument range each side
GATE_HEADROOM = 2.0  # gate threshold: noise floor + 6 dB (x2)
GATE_FRAME_SEC = 0.02
# never gate above this fraction of the loud content — protects recordings
# where silence is rare and the floor estimate is unreliable
GATE_CEILING_VS_LOUD = 0.1


def preprocess(audio, sr: int, instrument: str):
    """Bandpass to the instrument's range and gate sub-noise-floor frames."""
    import numpy as np

    audio = np.asarray(audio, dtype=np.float32)
    if len(audio) == 0:
        return audio

    audio = _bandpass(audio, sr, instrument)
    return _noise_gate(audio, sr)


def _bandpass(audio, sr: int, instrument: str):
    """Zero-phase Butterworth bandpass to the widened instrument range."""
    import numpy as np
    from scipy.signal import butter, sosfiltfilt

    if instrument not in INSTRUMENT_RANGES:
        return audio

    fmin, fmax, _ = INSTRUMENT_RANGES[instrument]
    low = max(fmin / RANGE_WIDENING, 20.0)
    high = min(fmax * RANGE_WIDENING, sr * 0.45)
    if low >= high:
        return audio

    sos = butter(4, [low, high], btype="band", fs=sr, output="sos")
    return sosfiltfilt(sos, audio).astype(np.float32)


def _noise_gate(audio, sr: int):
    """Zero frames whose RMS sits below the recording's own noise floor.

    The floor is the quietest non-silent frame; anything within 6 dB of it
    is treated as room noise / breath and silenced in place. The threshold
    is capped well below the loud content so that recordings with little
    or no silence are never gated by a misestimated floor.
    """
    import numpy as np

    frame = max(int(GATE_FRAME_SEC * sr), 1)
    n_frames = len(audio) // frame
    if n_frames < 10:
        return audio

    rms = np.array(
        [
            float(np.sqrt(np.mean(audio[k * frame : (k + 1) * frame] ** 2)))
            for k in range(n_frames)
        ]
    )
    nonzero = rms[rms > 0]
    if len(nonzero) == 0:
        return audio
    floor = float(np.min(nonzero))
    loud = float(np.percentile(rms, 90))
    threshold = min(floor * GATE_HEADROOM, loud * GATE_CEILING_VS_LOUD)
    if threshold <= 0:
        return audio  # digitally silent floor — nothing to gate

    gated = audio.copy()
    for k in range(n_frames):
        if rms[k] < threshold:
            gated[k * frame : (k + 1) * frame] = 0.0
    return gated
