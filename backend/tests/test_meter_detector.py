"""Meter detector tests: synthetic-harness accuracy + targeted unit cases."""
from app.core.meter_detector import MeterDetector, MeterResult

from .meter_cases import build_case, case_correct, generate_cases


def test_harness_accuracy() -> None:
    """The fitted detector must hold ≥ 80% on the full labeled suite (the
    degraded tiers simulate rubato + missed onsets and are deliberately
    hard) and ≥ 90% on the clean tier."""
    detector = MeterDetector()
    cases = generate_cases(seed=7)
    hits = sum(1 for c in cases if case_correct(c, detector.detect(c.notes, bpm=c.bpm)))
    accuracy = hits / len(cases)
    assert accuracy >= 0.8, f"harness accuracy {accuracy:.3f} < 0.8"

    clean = [
        build_case(ts, 8, pickup, level, jitter=0.02, seed=s)
        for ts in ("2/4", "3/4", "4/4", "6/8")
        for pickup in (False, True)
        for level in (1.0, 0.5)
        for s in (1, 2, 3)
    ]
    hits = sum(1 for c in clean if case_correct(c, detector.detect(c.notes, bpm=c.bpm)))
    accuracy = hits / len(clean)
    assert accuracy >= 0.9, f"clean-tier accuracy {accuracy:.3f} < 0.9"


def test_habanera_pickup_detected_as_2_4() -> None:
    """The Que-Lindo failure mode: habanera with an eighth pickup arriving at
    the doubled tempo level must come back as 2/4 with the level halved and
    the phase pointing at the anacrusis."""
    case = build_case("2/4", n_bars=8, pickup=True, level=0.5, jitter=0.01, seed=42)
    result = MeterDetector().detect(case.notes, bpm=case.bpm)
    assert result.time_signature == "2/4"
    assert result.level == 0.5
    assert abs(result.phase - 1.5) <= 0.25  # bar 2.0 − pickup 0.5


def test_march_without_pickup_stays_4_4() -> None:
    case = build_case("4/4", n_bars=8, pickup=False, level=1.0, jitter=0.01, seed=42)
    result = MeterDetector().detect(case.notes, bpm=case.bpm)
    assert result.time_signature == "4/4"
    assert result.level == 1.0
    assert result.phase == 0.0


def test_too_few_notes_falls_back_to_4_4() -> None:
    notes = [{"note": "C4", "start_beat": float(i), "velocity": 80} for i in range(3)]
    result = MeterDetector().detect(notes)
    assert result.time_signature == "4/4"
    assert result.confidence == 0.0


def test_apply_scales_shifts_and_inserts_leading_rest() -> None:
    notes = [
        {"note": "G3", "start_beat": 0.0, "velocity": 70},
        {"note": "C4", "start_beat": 1.0, "velocity": 100},
    ]
    result = MeterResult("2/4", level=0.5, phase=1.5, confidence=1.0, score=1.0)
    out = MeterDetector.apply(notes, result)
    # leading rest fills the bar before the pickup
    assert out[0]["note"] == "rest" and out[0]["start_beat"] == 0.0
    # pickup lands at 0·0.5 + 1.5 = 1.5; next note at the bar boundary 2.0
    assert out[1]["start_beat"] == 1.5
    assert out[2]["start_beat"] == 2.0


def test_apply_identity_adds_nothing() -> None:
    notes = [{"note": "C4", "start_beat": 0.0, "velocity": 100}]
    result = MeterResult("4/4", level=1.0, phase=0.0, confidence=1.0, score=1.0)
    out = MeterDetector.apply(notes, result)
    assert len(out) == 1 and out[0]["start_beat"] == 0.0
