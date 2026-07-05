"""Unit tests for the context-aware quantizer."""
from app.core.quantizer import Quantizer


def _make_notes(start_beats: list[float]) -> list[dict]:
    return [
        {"start_beat": sb, "duration_sec": 0.0, "measure": 1}
        for sb in start_beats
    ]


class TestQuantizeDuration:
    def test_quarter_at_120_bpm(self) -> None:
        # 0.5s at 120 BPM = exactly one beat
        assert Quantizer().quantize_duration(0.5, bpm=120) == "quarter"

    def test_eighth_at_120_bpm(self) -> None:
        assert Quantizer().quantize_duration(0.25, bpm=120) == "eighth"

    def test_slightly_off_duration_snaps(self) -> None:
        # 0.55s at 120 BPM = 1.1 beats -> still a quarter
        assert Quantizer().quantize_duration(0.55, bpm=120) == "quarter"


class TestQuantizeNotes:
    def test_clean_quarters_in_4_4(self) -> None:
        notes = Quantizer().quantize_notes(_make_notes([0.0, 1.0, 2.0, 3.0]), bpm=120)
        assert [n["duration"] for n in notes] == ["quarter"] * 4
        assert all(n["measure"] == 1 for n in notes)

    def test_dotted_rhythm_survives(self) -> None:
        # quarter. + eighth + quarter + quarter
        notes = Quantizer().quantize_notes(_make_notes([0.0, 1.5, 2.0, 3.0]), bpm=120)
        assert [n["duration"] for n in notes] == ["quarter.", "eighth", "quarter", "quarter"]

    def test_off_grid_starts_are_snapped(self) -> None:
        notes = Quantizer().quantize_notes(_make_notes([0.03, 1.02, 1.97, 3.05]), bpm=120)
        assert [n["start_beat"] for n in notes] == [0.0, 1.0, 2.0, 3.0]

    def test_measure_sums_in_4_4(self) -> None:
        notes = Quantizer().quantize_notes(
            _make_notes([0.0, 1.0, 2.0, 3.0, 4.0, 6.0]), bpm=120, time_signature="4/4"
        )
        by_measure: dict[int, float] = {}
        for n in notes:
            by_measure[n["measure"]] = by_measure.get(n["measure"], 0.0) + Quantizer.DURATION_MAP[n["duration"]]
        assert by_measure == {1: 4.0, 2: 4.0}

    def test_measure_sums_in_3_4(self) -> None:
        notes = Quantizer().quantize_notes(
            _make_notes([0.0, 1.0, 2.0, 3.0, 4.0, 5.0]), bpm=120, time_signature="3/4"
        )
        by_measure: dict[int, float] = {}
        for n in notes:
            by_measure[n["measure"]] = by_measure.get(n["measure"], 0.0) + Quantizer.DURATION_MAP[n["duration"]]
        assert by_measure == {1: 3.0, 2: 3.0}
        assert [n["measure"] for n in notes] == [1, 1, 1, 2, 2, 2]

    def test_empty_input(self) -> None:
        assert Quantizer().quantize_notes([], bpm=120) == []
