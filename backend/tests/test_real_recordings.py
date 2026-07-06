"""Regression tests on real recordings of Que Lindo Atardecer.

Two independent recordings (piano + violin) of the same printed part,
with contour-level ground truth in fixtures/real/que_lindo.yml.
Requires ffmpeg for m4a decoding — skipped when it is not installed.
"""
import shutil
from pathlib import Path

import pytest
import yaml

from app.models.note import TranscriptionData
from app.services.segmentation_service import SegmentationService

FIXTURES = Path(__file__).parent / "fixtures" / "real"

pytestmark = pytest.mark.skipif(
    shutil.which("ffmpeg") is None, reason="ffmpeg required for m4a fixtures"
)

MIN_CONFIDENCE = 0.5


@pytest.fixture(scope="module")
def ground_truth() -> dict:
    with open(FIXTURES / "que_lindo.yml") as f:
        return yaml.safe_load(f)


@pytest.fixture(scope="module")
def transcriptions(ground_truth: dict) -> dict[str, TranscriptionData]:
    """Transcribe each recording once for the whole module."""
    service = SegmentationService()
    results: dict[str, TranscriptionData] = {}
    for recording in ground_truth["recordings"]:
        path = FIXTURES / recording["file"]
        results[recording["instrument"]] = service.transcribe(
            str(path), recording["instrument"]
        )
    return results


def merged_confident_pitches(result: TranscriptionData) -> list[str]:
    """Sounding pitches with confidence >= MIN_CONFIDENCE, consecutive duplicates merged."""
    out: list[str] = []
    for note in result.notes:
        if note.pitch == "rest" or note.confidence < MIN_CONFIDENCE:
            continue
        if not out or out[-1] != note.pitch:
            out.append(note.pitch)
    return out


def contains_contiguous(haystack: list[str], needle: list[str]) -> bool:
    n = len(needle)
    return any(haystack[i : i + n] == needle for i in range(len(haystack) - n + 1))


def lcs_length(a: list[str], b: list[str]) -> int:
    """Longest common subsequence length (classic DP)."""
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i, item_a in enumerate(a):
        for j, item_b in enumerate(b):
            dp[i + 1][j + 1] = (
                dp[i][j] + 1 if item_a == item_b else max(dp[i][j + 1], dp[i + 1][j])
            )
    return dp[len(a)][len(b)]


@pytest.mark.parametrize("instrument", ["piano", "violin"])
def test_transcription_produces_plausible_note_count(
    transcriptions: dict, instrument: str
) -> None:
    notes = transcriptions[instrument].notes
    assert 25 <= len(notes) <= 60, f"{instrument}: got {len(notes)} notes"


@pytest.mark.parametrize("instrument", ["piano", "violin"])
def test_opening_phrase_contour(
    transcriptions: dict, ground_truth: dict, instrument: str
) -> None:
    phrase = ground_truth["assertion_phrase"]
    pitches = merged_confident_pitches(transcriptions[instrument])
    assert contains_contiguous(pitches, phrase), (
        f"{instrument}: phrase {phrase} not found in {pitches[:12]}..."
    )


# Tempo estimation on loose real playing may lock onto a metrically related
# pulse level (half, two-thirds, three-quarters, ... of the notated beat) —
# that is acceptable; an unrelated value is not.
METRICAL_LEVELS = (0.5, 2 / 3, 0.75, 1.0, 4 / 3, 1.5, 2.0)


def test_tempo_metrically_consistent_across_recordings(transcriptions: dict) -> None:
    """Same piece, similar take — tempos must agree up to a metrical level."""
    piano = transcriptions["piano"].tempo
    violin = transcriptions["violin"].tempo
    deviations = [
        abs(piano - factor * violin) / (factor * violin) for factor in METRICAL_LEVELS
    ]
    assert min(deviations) <= 0.10, (
        f"piano={piano} BPM vs violin={violin} BPM are not metrically related"
    )


def test_cross_instrument_pitch_agreement(transcriptions: dict) -> None:
    """Merged pitch sequences of the two takes agree on >= 70% of positions (LCS)."""
    piano = merged_confident_pitches(transcriptions["piano"])
    violin = merged_confident_pitches(transcriptions["violin"])
    ratio = lcs_length(piano, violin) / max(len(piano), len(violin))
    assert ratio >= 0.7, f"agreement {ratio:.2f}: piano={piano} violin={violin}"


@pytest.mark.parametrize("instrument", ["piano", "violin"])
def test_key_detected_as_g_major(
    transcriptions: dict, ground_truth: dict, instrument: str
) -> None:
    """Fixed in U30: circular Krumhansl rotation + notes/chroma score averaging."""
    assert transcriptions[instrument].key == ground_truth["key"]
