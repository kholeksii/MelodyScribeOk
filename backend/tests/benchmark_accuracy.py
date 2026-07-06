"""Transcription accuracy benchmark — the yardstick for U-B algorithm work.

Run from backend/:  python -m tests.benchmark_accuracy

Not collected by pytest (no test_ prefix). Compares SegmentationService
output against synthesized ground truth plus the two real recordings.

Baseline (2026-07-06, after U14 pre-filtering, macOS):
| case                    | pitch acc | octave-tol | notes Δ | bpm (true) |
|-------------------------|-----------|------------|---------|------------|
| do_mi_re_do_120         | 1.00      | 1.00       | +0      | 120 (120)  |
| scale_up_90             | 1.00      | 1.00       | +0      | 90 (90)    |
| scale_eighths_140       | 1.00      | 1.00       | +0      | 143 (140)  |
| dotted_120              | 1.00      | 1.00       | +0      | 120 (120)  |
| habanera_120            | 1.00      | 1.00       | +0      | 172 (120)* |
| with_rests_100          | 1.00      | 1.00       | +0      | 100 (100)  |
| wide_leaps_violin_120   | 1.00      | 1.00       | +0      | 120 (120)  |
| guitar_low_110          | 1.00      | 1.00       | +0      | 110 (110)  |
| long_notes_80           | 1.00      | 1.00       | +0      | 80 (80)    |
Real: piano key=G major bpm=133 notes=39; violin key=G major bpm=133
notes=49; cross-agreement=0.95 — the two takes now agree on tempo exactly.

*habanera tempo locks onto a metrically related level through the full
pre-filtered pipeline (the raw-onset unit test detects ~118); dotted
figures remain the known ambiguity, the BPM hint is the override.

History: before U11 guitar_low was 0.14 (+6 phantom fragments), wide_leaps
0.83, with_rests tempo 91, cross-agreement 0.87; before U14 the real takes
disagreed on tempo (132 vs 107).
"""
import shutil
import tempfile
from pathlib import Path

from app.models.note import TranscriptionData
from app.services.segmentation_service import SegmentationService
from tests.synth import synth_melody_file

FIXTURES_REAL = Path(__file__).parent / "fixtures" / "real"

Case = tuple[str, list[tuple[str, float]], int, str]

CASES: list[Case] = [
    ("do_mi_re_do_120", [("C4", 1.0), ("E4", 1.0), ("D4", 1.0), ("C4", 1.0)], 120, "piano"),
    (
        "scale_up_90",
        [(p, 1.0) for p in ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]],
        90,
        "piano",
    ),
    (
        "scale_eighths_140",
        [(p, 0.5) for p in ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]],
        140,
        "piano",
    ),
    (
        "dotted_120",
        [("G4", 1.5), ("E4", 0.5), ("G4", 1.0), ("C5", 1.5), ("A4", 0.5), ("C5", 1.0)],
        120,
        "piano",
    ),
    (
        "habanera_120",
        [("B4", 0.75), ("B4", 0.25), ("G4", 0.5), ("E4", 0.5)] * 2,
        120,
        "violin",
    ),
    (
        "with_rests_100",
        [("C4", 1.0), ("rest", 1.0), ("E4", 1.0), ("G4", 1.0), ("rest", 1.0), ("C5", 1.0)],
        100,
        "piano",
    ),
    (
        "wide_leaps_violin_120",
        [("G3", 1.0), ("G4", 1.0), ("D5", 1.0), ("A4", 1.0), ("E5", 1.0), ("A4", 1.0)],
        120,
        "violin",
    ),
    (
        "guitar_low_110",
        [("E2", 1.0), ("G2", 1.0), ("A2", 1.0), ("B2", 1.0), ("D3", 1.0), ("E3", 1.0), ("G3", 1.0)],
        110,
        "guitar",
    ),
    ("long_notes_80", [("C4", 2.0), ("E4", 2.0), ("G4", 4.0), ("C5", 2.0)], 80, "piano"),
]


def sounding_pitches(result: TranscriptionData) -> list[str]:
    out: list[str] = []
    for note in result.notes:
        if note.pitch == "rest":
            continue
        if not out or out[-1] != note.pitch:
            out.append(note.pitch)
    return out


def pitch_accuracy(expected: list[str], actual: list[str]) -> float:
    if not expected:
        return 1.0
    hits = sum(1 for i, p in enumerate(expected) if i < len(actual) and actual[i] == p)
    return hits / len(expected)


def octave_tolerant_accuracy(expected: list[str], actual: list[str]) -> float:
    strip = lambda p: p.rstrip("0123456789")  # noqa: E731
    return pitch_accuracy([strip(p) for p in expected], [strip(p) for p in actual])


def lcs_length(a: list[str], b: list[str]) -> int:
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            dp[i + 1][j + 1] = dp[i][j] + 1 if x == y else max(dp[i][j + 1], dp[i + 1][j])
    return dp[len(a)][len(b)]


def run_synthetic(service: SegmentationService) -> None:
    print("## Synthesized cases\n")
    print("| case | pitch acc | octave-tol | notes Δ | bpm (true) |")
    print("|------|-----------|------------|---------|------------|")
    with tempfile.TemporaryDirectory() as tmp:
        for name, melody, bpm, instrument in CASES:
            path = synth_melody_file(Path(tmp) / f"{name}.wav", melody, bpm)
            result = service.transcribe(str(path), instrument)
            expected = [p for p, _ in melody if p != "rest"]
            # merge consecutive duplicates in expectation the same way
            expected_merged: list[str] = []
            for p in expected:
                if not expected_merged or expected_merged[-1] != p:
                    expected_merged.append(p)
            actual = sounding_pitches(result)
            acc = pitch_accuracy(expected_merged, actual)
            oct_acc = octave_tolerant_accuracy(expected_merged, actual)
            delta = len(actual) - len(expected_merged)
            print(
                f"| {name} | {acc:.2f} | {oct_acc:.2f} | {delta:+d} "
                f"| {result.tempo} ({bpm}) |"
            )
    print()


def run_real(service: SegmentationService) -> None:
    if shutil.which("ffmpeg") is None:
        print("## Real recordings: skipped (ffmpeg not installed)\n")
        return
    print("## Real recordings (Que Lindo Atardecer, true key G major)\n")
    print("| take | key | bpm | notes |")
    print("|------|-----|-----|-------|")
    results = {}
    for take, instrument in (("que_lindo_piano.m4a", "piano"), ("que_lindo_violin.m4a", "violin")):
        result = service.transcribe(str(FIXTURES_REAL / take), instrument)
        results[instrument] = result
        print(f"| {instrument} | {result.key} | {result.tempo} | {len(result.notes)} |")
    piano = sounding_pitches(results["piano"])
    violin = sounding_pitches(results["violin"])
    agreement = lcs_length(piano, violin) / max(len(piano), len(violin))
    print(f"\nCross-instrument pitch agreement (LCS): {agreement:.2f}\n")


if __name__ == "__main__":
    svc = SegmentationService()
    run_synthetic(svc)
    run_real(svc)
