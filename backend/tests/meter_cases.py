"""Labeled symbolic cases for fitting and testing the meter detector.

Melodies are generated directly as segmentation-style note dicts (no audio):
meter, tempo level and anacrusis are known BY CONSTRUCTION, which makes this
a free labeled dataset. Realistic imperfection is simulated with seeded
timing jitter and velocity noise, so results are reproducible.

Each melody template encodes the accent structure of its meter the way a
human plays it: agogic length on strong beats, louder attacks on downbeats,
phrase-final long note on a downbeat, bar-level repetition.
"""
import random
from dataclasses import dataclass, field

VEL_STRONG = 100
VEL_MEDIUM = 85
VEL_WEAK = 70

# (pitch, duration_beats, is_strong) per bar; melodies end on the tonic C.
# Pitches stay diatonic in C so the tonal feature sees stable degrees.
HABANERA_2_4_BAR = [
    ("C4", 0.75, True), ("E4", 0.25, False), ("G4", 0.5, False), ("E4", 0.5, False),
]
WALTZ_3_4_BAR = [("G4", 1.5, True), ("E4", 0.5, False), ("C4", 1.0, False)]
MARCH_4_4_BAR = [
    ("C4", 1.0, True), ("E4", 0.5, False), ("E4", 0.5, False),
    ("G4", 1.0, True), ("E4", 1.0, False),
]
JIG_6_8_BAR = [
    ("C4", 0.5, True), ("D4", 0.5, False), ("E4", 0.5, False),
    ("G4", 0.5, True), ("F4", 0.5, False), ("D4", 0.5, False),
]

TEMPLATES = {
    "2/4": (2.0, HABANERA_2_4_BAR),
    "3/4": (3.0, WALTZ_3_4_BAR),
    "4/4": (4.0, MARCH_4_4_BAR),
    "6/8": (3.0, JIG_6_8_BAR),
}
PICKUP_NOTE = ("G3", 0.5)  # eighth-note anacrusis, dominant below the tonic


@dataclass
class MeterCase:
    name: str
    notes: list[dict] = field(default_factory=list)
    true_ts: str = "4/4"
    true_level: float = 1.0
    true_phase: float = 0.0
    bpm: int = 100  # incoming tempo estimate (already at the wrong level)


def _velocity(
    is_strong: bool, pos_in_bar: float, rng: random.Random, flat_dynamics: bool = False
) -> int:
    """Velocity with metric accents; `flat_dynamics` imitates lyrical playing
    where loudness barely follows the meter (real piano recordings)."""
    if flat_dynamics:
        return max(1, min(127, int(VEL_MEDIUM + rng.gauss(0, 8))))
    base = VEL_STRONG if pos_in_bar < 1e-6 else (VEL_MEDIUM if is_strong else VEL_WEAK)
    return max(1, min(127, int(base + rng.gauss(0, 4))))


def build_case(
    ts: str,
    n_bars: int,
    pickup: bool,
    level: float,
    jitter: float,
    seed: int,
    dropout: float = 0.0,
    flat_dynamics: bool = False,
) -> MeterCase:
    """Render a melody template into segmentation-style note dicts.

    `level` simulates the tempo detector locking one level too fast: the
    start_beats are multiplied by 1/level (e.g. level=0.5 → beats doubled),
    and the detector is expected to recover `level` exactly. `dropout`
    randomly deletes non-downbeat notes, imitating onsets the audio pipeline
    misses on real recordings.
    """
    rng = random.Random(seed)
    bar_beats, bar_template = TEMPLATES[ts]
    notes: list[dict] = []
    beat = 0.0
    phase = 0.0

    if pickup:
        pitch, dur = PICKUP_NOTE
        notes.append({"note": pitch, "start_beat": 0.0, "velocity": VEL_WEAK, "duration_sec": 0.0})
        beat = dur
        phase = (bar_beats - dur) % bar_beats

    for bar in range(n_bars):
        pos = 0.0
        for pitch, dur, strong in bar_template:
            # phrase-final downbeat: last bar holds a long tonic instead
            if bar == n_bars - 1 and pos > 1e-6:
                break
            actual_pitch = "C4" if bar == n_bars - 1 else pitch
            actual_dur = bar_beats if bar == n_bars - 1 else dur
            skip = pos > 1e-6 and rng.random() < dropout
            if not skip:
                notes.append({
                    "note": actual_pitch,
                    "start_beat": beat + rng.gauss(0, jitter),
                    "velocity": _velocity(strong, pos, rng, flat_dynamics),
                    "duration_sec": 0.0,
                })
            beat += actual_dur
            pos += actual_dur

    # simulate the wrong tempo level the detector must undo
    for n in notes:
        n["start_beat"] = max(0.0, n["start_beat"] / level)

    # notated pulse in the comfortable range; the incoming estimate arrives
    # at the (possibly doubled) detector level, like the real tempo detector
    notated_bpm = rng.randrange(60, 92)
    return MeterCase(
        name=f"{ts.replace('/', '')}_{'pickup' if pickup else 'plain'}_lv{level}_s{seed}",
        notes=notes,
        true_ts=ts,
        true_level=level,
        true_phase=phase,
        bpm=round(notated_bpm / level),
    )


def generate_cases(seed: int = 7) -> list[MeterCase]:
    """The fitting/CI suite: every meter × pickup × level, three noise tiers
    per combination — clean, loose (rubato-like jitter) and degraded (loose
    plus onset dropout, like real recordings through the audio pipeline)."""
    cases: list[MeterCase] = []
    rng = random.Random(seed)
    noise_tiers = [
        (0.02, 0.0, False),   # clean studio take
        (0.06, 0.0, False),   # expressive rubato
        (0.06, 0.0, True),    # lyrical: loudness barely follows the meter
        (0.08, 0.12, True),   # rubato + missed onsets + flat dynamics
    ]
    for ts in TEMPLATES:
        for pickup in (False, True):
            for level in (1.0, 0.5):
                for jitter, dropout, flat in noise_tiers:
                    case_seed = rng.randrange(1_000_000)
                    cases.append(
                        build_case(
                            ts, 8, pickup, level, jitter, case_seed, dropout, flat
                        )
                    )
    return cases


def case_correct(case: MeterCase, result) -> bool:
    """A hypothesis is correct when meter, level and phase all match.
    3/4 vs 6/8 share a bar length — accept either for those templates,
    matching how ambiguous the distinction is for a bare melody."""
    compatible = {case.true_ts}
    if case.true_ts in ("3/4", "6/8"):
        compatible = {"3/4", "6/8"}
    return (
        result.time_signature in compatible
        and abs(result.level - case.true_level) < 1e-6
        and abs(result.phase - case.true_phase) <= 0.25
    )
