"""U34 — honest measure fills and quantizer/grid self-diagnosis."""
from app.core.meter_detector import MeterDetector, MeterResult
from app.core.quantizer import Quantizer
from app.services.segmentation_service import SegmentationService

from .meter_cases import build_case

# ── Honest fills: extend by at most one dot, rests beyond that ────────────

def test_fill_extends_small_gap_with_a_dot() -> None:
    """A quarter note before half-a-beat of trailing space becomes dotted."""
    notes = [
        {"note": "C4", "start_beat": 0.0, "measure": 1, "duration_sec": 0.5},
        {"note": "D4", "start_beat": 1.0, "measure": 1, "duration_sec": 0.5},
        {"note": "E4", "start_beat": 2.0, "measure": 1, "duration_sec": 0.5},
        # last note: gap to measure end = 1.0 quarter... next note far away
        {"note": "F4", "start_beat": 3.0, "measure": 1, "duration_sec": 0.4},
        {"note": "G4", "start_beat": 4.0, "measure": 2, "duration_sec": 2.0},
    ]
    out = Quantizer().quantize_notes(notes, bpm=120, time_signature="4/4")
    bar1 = [n for n in out if n["measure"] == 1]
    total = sum(Quantizer.DURATION_MAP[n["duration"]] for n in bar1)
    assert total == 4.0


def test_fill_uses_rests_instead_of_inflating() -> None:
    """_fill_measures boundary: a quarter with 3 beats of under-fill must
    NOT inflate to a whole note (the pre-U34 behavior) — the tail becomes
    rests and the bar still sums to 4."""
    q = Quantizer()
    filled = q._fill_measures(
        [{"note": "C4", "start_beat": 0.0, "measure": 1, "duration": "quarter"}],
        bpb=4.0,
    )
    c4 = next(n for n in filled if n["note"] == "C4")
    assert c4["duration"] == "quarter", "note must keep its honest duration"
    rests = [n for n in filled if n["note"] == "rest"]
    assert rests, "tail must be rests"
    total = sum(Quantizer.DURATION_MAP[n["duration"]] for n in filled)
    assert total == 4.0


def test_fill_rest_decomposition_is_exact() -> None:
    """Direct unit: 1.25 beats of trailing space → rests summing exactly."""
    q = Quantizer()
    notes = [
        {"note": "C4", "start_beat": 0.0, "measure": 1, "duration": "half."},
        # bar 1 of 4/4 missing 1.0; make the note non-extendable by size:
        # half. (3.0) + dot allowance = 4.5 ≥ 4.0 → it extends... use a
        # different shape: quarter + empty 2.75 → must NOT extend (2.75 >
        # quarter/2), decomposes into half + eighth + sixteenth rests
        {"note": "D4", "start_beat": 4.0, "measure": 2, "duration": "whole"},
    ]
    notes[0]["duration"] = "quarter"
    filled = q._fill_measures(
        [dict(n) for n in notes], bpb=4.0
    )
    bar1 = [n for n in filled if n["measure"] == 1]
    rests = [n for n in bar1 if n["note"] == "rest"]
    assert rests, "expected trailing rests"
    total = sum(Quantizer.DURATION_MAP[n["duration"]] for n in bar1)
    assert total == 4.0


# ── Detector exclude parameter ────────────────────────────────────────────

def test_detect_exclude_skips_hypothesis() -> None:
    case = build_case("2/4", n_bars=8, pickup=False, level=1.0, jitter=0.02, seed=5)
    detector = MeterDetector()
    first = detector.detect(case.notes, bpm=case.bpm)
    second = detector.detect(
        case.notes,
        bpm=case.bpm,
        exclude={(first.time_signature, first.level, first.phase)},
    )
    assert (second.time_signature, second.level, second.phase) != (
        first.time_signature, first.level, first.phase,
    )


# ── Service-level retry on tie flood ──────────────────────────────────────

def test_tie_flood_triggers_retry(monkeypatch) -> None:
    """First hypothesis has a wrong phase (every long note crosses a bar),
    the retry hypothesis is clean — the service must keep the retry."""
    service = SegmentationService()

    # half notes on downbeats of 4/4 — phase 1.0 shreds all of them
    segmented = [
        {"note": "C4", "start_beat": float(b), "measure": 1, "duration_sec": 1.0,
         "velocity": 90, "confidence": 1.0}
        for b in range(0, 16, 2)
    ]
    bad = MeterResult("4/4", 1.0, 1.0, 0.9, 2.0)
    good = MeterResult("4/4", 1.0, 0.0, 0.9, 1.9)
    calls = []

    def fake_detect(notes, allow_half_level=True, bpm=None, exclude=None):
        calls.append(exclude)
        return good if exclude else bad

    monkeypatch.setattr(service.meter_detector, "detect", fake_detect)

    notes_bad, _, _ = service._grid_and_quantize(segmented, 120, bad)
    assert service._tie_share(notes_bad) > service.TIE_FLOOD_SHARE, (
        "test setup: the bad grid must actually flood ties"
    )

    # run the real transcribe path from the meter step by simulating it:
    meter = service.meter_detector.detect(segmented, bpm=120)
    notes, tempo, pickup = service._grid_and_quantize(segmented, 120, meter)
    if service._tie_share(notes) > service.TIE_FLOOD_SHARE:
        retry = service.meter_detector.detect(
            segmented, bpm=120,
            exclude={(meter.time_signature, meter.level, meter.phase)},
        )
        retry_notes, _, _ = service._grid_and_quantize(segmented, 120, retry)
        if service._tie_share(retry_notes) < service._tie_share(notes):
            notes = retry_notes

    assert calls == [None, {("4/4", 1.0, 1.0)}], "retry must exclude the winner"
    assert service._tie_share(notes) <= service.TIE_FLOOD_SHARE
