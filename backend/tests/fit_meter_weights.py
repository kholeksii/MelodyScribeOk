"""Grid-search fitting for the meter detector's accent-feature weights.

Not collected by pytest (no test_ prefix) — run manually after changing
features or the case generator:

    cd backend && python -m tests.fit_meter_weights

Prints the best weight vector and its accuracy; paste the winner into
app/core/meter_detector.WEIGHTS with the accuracy noted in the comment.
"""
import itertools

from app.core import meter_detector
from app.core.meter_detector import MeterDetector

from .meter_cases import case_correct, generate_cases

# final_downbeat is capped: on real rubato recordings the last onset often
# drifts off any downbeat, and heavy weights there flipped the tempo level
# on both Que-Lindo takes (validated 2026-07-10)
SEARCH_SPACE = {
    "agogic": [0.7, 1.0, 1.3],
    "dynamic": [0.1, 0.3, 0.6],
    "final_downbeat": [0.3, 0.5],
    "parallelism": [0.5, 0.9, 1.3],
    "tonal": [0.15, 0.35, 0.6],
    "anti_syncopation": [0.4, 0.75, 1.1],
}
NEAR_BEST_MARGIN = 0.021  # vectors this close to the best go to the report


def evaluate(cases, detector: MeterDetector) -> float:
    hits = sum(
        1 for c in cases if case_correct(c, detector.detect(c.notes, bpm=c.bpm))
    )
    return hits / len(cases)


def main() -> None:
    cases = generate_cases(seed=7)
    detector = MeterDetector()
    baseline = evaluate(cases, detector)
    print(f"cases: {len(cases)}, committed weights accuracy: {baseline:.3f}")

    names = list(SEARCH_SPACE)
    results: list[tuple[float, dict]] = []
    for values in itertools.product(*(SEARCH_SPACE[n] for n in names)):
        candidate = dict(zip(names, values))
        meter_detector.WEIGHTS.update(candidate)
        results.append((evaluate(cases, detector), dict(candidate)))

    results.sort(key=lambda t: -t[0])
    best_acc = results[0][0]
    near_best = [r for r in results if best_acc - r[0] <= NEAR_BEST_MARGIN]
    print(f"\nbest accuracy: {best_acc:.3f} ({len(near_best)} vectors within "
          f"{NEAR_BEST_MARGIN} — validate these on the real recordings and "
          f"commit the one that also gets Que-Lindo right)")
    for acc, weights in near_best[:12]:
        print(f"  {acc:.3f}: {weights}")


if __name__ == "__main__":
    main()
