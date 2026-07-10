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


@pytest.mark.parametrize("instrument", ["piano", "violin"])
def test_tempo_level_corrected_to_quarter_pulse(
    transcriptions: dict, instrument: str
) -> None:
    """U31: the engine used to report 133 BPM (the eighth-note level, because
    BPM_MIN made ~66 unreachable). The joint search must fold it back to the
    notated quarter pulse."""
    tempo = transcriptions[instrument].tempo
    assert 55 <= tempo <= 85, f"{instrument}: tempo {tempo} is not the quarter pulse"


@pytest.mark.xfail(
    strict=False,
    reason="2/4 vs 3/4-or-doubled-4/4 on heavy solo rubato is beyond the "
    "symbolic accent features — timing drift flattens every grid-based "
    "signal (bar-lag autocorrelation measured ~equal for bars 2/3/4). "
    "Needs tempo-curve tracking: U31b learned downbeat model / U33 strict "
    "ground truth.",
)
@pytest.mark.parametrize("instrument", ["piano", "violin"])
def test_meter_detected_as_2_4(transcriptions: dict, instrument: str) -> None:
    """The printed part is 2/4."""
    result = transcriptions[instrument]
    assert result.time_signature == "2/4", (
        f"{instrument}: detected {result.time_signature} "
        f"(confidence {result.time_signature_confidence})"
    )


# ── U33: tiered ground-truth assertions ────────────────────────────────────

DURATION_BEATS = {
    "whole": 4.0, "half.": 3.0, "half": 2.0, "quarter.": 1.5, "quarter": 1.0,
    "eighth.": 0.75, "eighth": 0.5, "sixteenth": 0.25,
}


@pytest.mark.parametrize("instrument", ["piano", "violin"])
def test_long_note_anchors_spacing(
    transcriptions: dict, ground_truth: dict, instrument: str
) -> None:
    """Tier 1 (meter-independent rhythm truth): the held D4 («cer») and the
    held F#4 («biar») are 4 quarters apart in the printed part. start_beats
    are quarter units once U31 folds the tempo level, so their spacing is a
    strict assertion however the meter itself was labeled."""
    notes = transcriptions[instrument].notes
    d4 = next(
        (n for n in notes if n.pitch == "D4"
         and DURATION_BEATS.get(n.duration, 0) >= 1.0),
        None,
    )
    assert d4 is not None, f"{instrument}: held D4 anchor not found"
    f_sharp = next(
        (n for n in notes if n.pitch == "F#4" and n.start_beat > d4.start_beat
         and DURATION_BEATS.get(n.duration, 0) >= 1.0),
        None,
    )
    assert f_sharp is not None, f"{instrument}: held F#4 anchor not found"

    spacing = f_sharp.start_beat - d4.start_beat
    expected = ground_truth["anchors"][1]["quarters_after_prev_anchor"]
    tol = ground_truth["anchor_spacing_tolerance"]
    assert abs(spacing - expected) <= tol, (
        f"{instrument}: anchor spacing {spacing} vs printed {expected}±{tol}"
    )


@pytest.mark.parametrize("instrument", ["piano", "violin"])
def test_consensus_pitch_sequence_lcs(
    transcriptions: dict, ground_truth: dict, instrument: str
) -> None:
    """Tier 2: the whole-take merged pitch sequence must cover the
    cross-recording consensus (U33) — far stronger than the 4-note phrase."""
    consensus = ground_truth["consensus_pitches"]
    pitches = merged_confident_pitches(transcriptions[instrument])
    ratio = lcs_length(pitches, consensus) / len(consensus)
    assert ratio >= ground_truth["consensus_lcs_min"], (
        f"{instrument}: consensus LCS {ratio:.2f} < "
        f"{ground_truth['consensus_lcs_min']} (got {pitches})"
    )


def test_reference_musicxml_matches_ground_truth() -> None:
    """The committed reference MusicXML (for the musician's proofread) must
    stay in sync with full_score in the yml: same pitches, same bar sums."""
    import yaml
    from music21 import converter, stream

    gt = yaml.safe_load((FIXTURES / "que_lindo.yml").read_text())
    score = converter.parse(str(FIXTURES / "que_lindo_reference.musicxml"))
    measures = list(score.parts[0].getElementsByClass(stream.Measure))

    assert measures[0].number == 0, "reference must start with the pickup bar"
    ref_pitches = [
        n.nameWithOctave.replace("-", "b")
        for m in measures for n in m.notes
    ]
    gt_pitches = [item["pitch"] for item in gt["full_score"]]
    assert ref_pitches == gt_pitches
    # every full bar sums to the printed 2/4
    for m in measures[1:]:
        assert float(m.duration.quarterLength) == pytest.approx(2.0)


@pytest.mark.parametrize("instrument", ["piano", "violin"])
def test_no_cross_barline_tie_flood(transcriptions: dict, instrument: str) -> None:
    """A wrong grid shreds notes at barlines; with the right meter the share
    of tied notes must be small (the printed opening has no ties at all)."""
    notes = transcriptions[instrument].notes
    tied = sum(1 for n in notes if n.tie_start)
    assert tied / max(len(notes), 1) <= 0.15, (
        f"{instrument}: {tied}/{len(notes)} notes tied across barlines"
    )
