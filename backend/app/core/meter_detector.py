"""Joint meter + tempo-level + grid-phase detection for monophonic melodies.

The transcription pipeline historically trusted a hard-coded 4/4 and whatever
metrical level the tempo detector locked onto, and assumed the first onset is
bar 1 beat 1. On the real Que-Lindo recordings that produced 4/4 @ 133 BPM
with the pickup note on a downbeat, while the printed part is 2/4 @ ~66 with
an eighth-note anacrusis.

This module searches the small joint space

    meter ∈ {2/4, 3/4, 4/4, 6/8} × level ∈ {1, 1/2} × phase ∈ eighth offsets

and scores every hypothesis with accent features long established in the
music-cognition literature (Povel & Essen 1985; Lerdahl & Jackendoff, GTTM;
Temperley 2007). All features are computed from data the pipeline already
extracts: inter-onset intervals, RMS velocities and pitch names.

Feature weights are FITTED on labeled synthetic cases, not hand-tuned:
see tests/meter_cases.py (generator) and tests/fit_meter_weights.py (search).
"""
from dataclasses import dataclass

GRID = 0.25  # sixteenth grid, matches quantizer.GRID
PHASE_STEP = 0.5  # eighth-note phase resolution
POS_TOLERANCE = 0.13  # how far from a slot a snapped position may sit

# (name, bar length in quarter beats, beat-strength map within the bar).
# 3/4 and 6/8 share a bar length and differ only in internal accent slots.
METERS: list[tuple[str, float, dict[float, float]]] = [
    ("2/4", 2.0, {0.0: 1.0, 1.0: 0.55}),
    ("3/4", 3.0, {0.0: 1.0, 1.0: 0.3, 2.0: 0.3}),
    ("4/4", 4.0, {0.0: 1.0, 2.0: 0.65, 1.0: 0.3, 3.0: 0.3}),
    ("6/8", 3.0, {0.0: 1.0, 1.5: 0.65}),
]
LEVELS = (1.0, 0.5)  # 0.5 = the tempo detector locked one level too fast

# Fitted on the synthetic harness (tests/fit_meter_weights.py, seed 7, 64
# cases across clean/rubato/lyrical/degraded tiers): 0.828 full harness,
# 0.938 clean tier — under the constraint that BOTH real Que-Lindo
# recordings keep the correct tempo level (×0.5 → 66 BPM). Heavier
# final_downbeat vectors score better synthetically but flip the tempo
# level on real rubato. Do not hand-edit — refit and re-validate.
WEIGHTS = {
    "agogic": 0.7,
    "dynamic": 0.8,
    "final_downbeat": 0.5,
    "parallelism": 0.5,
    "tonal": 0.35,
    "anti_syncopation": 0.75,
}
# Occam priors: tiny bonuses so ambiguous input falls back to the common case
PRIOR_LEVEL_1 = 0.02  # used only when the BPM is unknown
PRIOR_4_4 = 0.015
PRIOR_PHASE_0 = 0.015
# Tactus plausibility: 2/4@66 and 4/4@133 describe the SAME physical grid
# (identical downbeat spacing), so accent contrasts cannot separate them —
# only the resulting tempo can. Prefer readings whose pulse lands in the
# comfortable tactus band (Temperley/Parncutt: ~55–125 BPM).
TACTUS_BAND = (55.0, 125.0)
PRIOR_TACTUS = 0.15  # swept 0.08–0.3 on the harness; plateau at ≥0.12

_PITCH_CLASSES = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
    "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10,
    "Bb": 10, "B": 11,
}


@dataclass
class MeterResult:
    time_signature: str
    level: float          # multiply BPM and start_beats by this
    phase: float          # shift (in target-level beats) so downbeats align
    confidence: float     # margin over the best differing time signature
    score: float


def _pitch_class(note_name: str) -> int | None:
    """'F#4' → 6; rests and unparsable names → None."""
    if not note_name or note_name == "rest":
        return None
    name = note_name.rstrip("0123456789-")
    return _PITCH_CLASSES.get(name)


def _strength(pos: float, bar: float, slots: dict[float, float]) -> float:
    """Metric strength of a bar position: mapped slot, weak beat, or offbeat."""
    for slot, value in slots.items():
        delta = abs(pos - slot)
        if min(delta, bar - delta) <= POS_TOLERANCE:
            return value
    if abs(pos - round(pos)) <= POS_TOLERANCE:
        return 0.15  # unmapped integer beat
    return 0.0


class MeterDetector:
    """Score-based joint search over (meter, tempo level, phase)."""

    def detect(
        self,
        raw_notes: list[dict],
        allow_half_level: bool = True,
        bpm: int | None = None,
    ) -> MeterResult:
        """raw_notes: segmentation output — dicts with 'start_beat' (float,
        at the incoming tempo level), 'note' and 'velocity'. Rests are used
        for gaps only. `bpm` (the incoming tempo estimate) enables the tactus
        prior that disambiguates metrically equivalent readings."""
        sounding = [n for n in raw_notes if n.get("note") != "rest"]
        if len(sounding) < 4:
            return MeterResult("4/4", 1.0, 0.0, 0.0, 0.0)

        starts = [float(n.get("start_beat", 0.0)) for n in sounding]
        vels = [float(n.get("velocity", 80)) for n in sounding]
        # IOI to the next sounding onset; the last note gets the median IOI
        iois = [starts[i + 1] - starts[i] for i in range(len(starts) - 1)]
        iois.append(sorted(iois)[len(iois) // 2] if iois else 1.0)

        tonic_pc = None
        for n in reversed(sounding):
            tonic_pc = _pitch_class(str(n.get("note", "")))
            if tonic_pc is not None:
                break
        pcs = [_pitch_class(str(n.get("note", ""))) for n in sounding]

        levels = LEVELS if allow_half_level else (1.0,)
        best: MeterResult | None = None
        best_other_ts = 0.0
        scored: list[tuple[str, float, float, float]] = []

        for name, bar, slots in METERS:
            for level in levels:
                n_phases = int(round(bar / PHASE_STEP))
                for k in range(n_phases):
                    phase = k * PHASE_STEP
                    score = self._score(
                        starts, iois, vels, pcs, tonic_pc, bar, slots, level, phase
                    )
                    if bpm is not None:
                        if TACTUS_BAND[0] <= bpm * level <= TACTUS_BAND[1]:
                            score += PRIOR_TACTUS
                    elif level == 1.0:
                        score += PRIOR_LEVEL_1
                    if name == "4/4":
                        score += PRIOR_4_4
                    if phase == 0.0:
                        score += PRIOR_PHASE_0
                    scored.append((name, level, phase, score))

        scored.sort(key=lambda t: -t[3])
        top_name, top_level, top_phase, top_score = scored[0]
        for name, _lv, _ph, sc in scored[1:]:
            if name != top_name:
                best_other_ts = sc
                break
        margin = max(0.0, top_score - best_other_ts)
        confidence = min(1.0, margin / max(top_score, 1e-9) * 4.0)
        best = MeterResult(top_name, top_level, top_phase, confidence, top_score)
        return best

    @staticmethod
    def _score(starts, iois, vels, pcs, tonic_pc, bar, slots, level, phase) -> float:
        """Weighted accent-feature score.

        The load-bearing design decision: accent features are CONTRASTS
        (downbeat mean minus elsewhere mean), not sums. Sum-based scoring is
        degenerate — every 4/4 downbeat is also a 2/4 downbeat, so folding to
        the shorter bar can only gain score. A contrast drops when the fold
        promotes weaker mid-bar notes into downbeats, which is exactly the
        evidence that separates 4/4 from 2/4.
        """
        positions = [((s * level + phase) % bar) for s in starts]
        scaled_iois = [max(GRID, i * level) for i in iois]
        strengths = [_strength(p, bar, slots) for p in positions]
        on_down = [st >= 0.99 for st in strengths]
        n_down = sum(on_down)
        n_other = len(starts) - n_down

        def contrast(values: list[float]) -> float:
            """(mean on downbeats − mean elsewhere) / overall mean → ~[-1, 1]."""
            if n_down == 0 or n_other == 0:
                return 0.0
            mean_down = sum(v for v, d in zip(values, on_down) if d) / n_down
            mean_other = sum(v for v, d in zip(values, on_down) if not d) / n_other
            overall = sum(values) / len(values)
            if overall <= 1e-9:
                return 0.0
            return max(-1.0, min(1.0, (mean_down - mean_other) / overall))

        # 1. Agogic contrast: notes on downbeats are longer than the rest
        capped = [min(i, bar) for i in scaled_iois]
        agogic = contrast(capped)

        # 2. Dynamic contrast: attacks on downbeats are louder than the rest
        dynamic = contrast(vels)

        # 3. Phrase-final accent: the last note should sit on a downbeat
        final_downbeat = strengths[-1]

        # 4. Parallelism: consecutive bars repeat the same in-bar onset
        # pattern — mean Jaccard similarity of per-bar eighth-grid sets.
        # (Unlike a position histogram, this does not reward short bars:
        # folding a 4/4 pattern to 2/4 makes consecutive "bars" differ.)
        bar_sets: dict[int, set[int]] = {}
        for s in starts:
            shifted = s * level + phase
            bar_idx = int(shifted // bar)
            slot = int(round((shifted % bar) / PHASE_STEP))
            bar_sets.setdefault(bar_idx, set()).add(slot)
        indices = sorted(bar_sets)
        sims = []
        for a, b in zip(indices, indices[1:]):
            if b == a + 1:
                sa, sb = bar_sets[a], bar_sets[b]
                sims.append(len(sa & sb) / max(len(sa | sb), 1))
        parallelism = sum(sims) / len(sims) if sims else 0.0

        # 5. Tonal contrast: stable degrees (1, ♭3/3, 5 of the final-note
        # tonic proxy) concentrate on downbeats
        tonal = 0.0
        if tonic_pc is not None:
            stable = {tonic_pc, (tonic_pc + 4) % 12, (tonic_pc + 3) % 12,
                      (tonic_pc + 7) % 12}
            tonal = contrast([1.0 if pc in stable else 0.0 for pc in pcs])

        # 6. Anti-syncopation: weight of notes that cross a barline
        crossing = 0.0
        for p, i in zip(positions, scaled_iois):
            if p > POS_TOLERANCE and p + i > bar + POS_TOLERANCE:
                crossing += i
        anti_sync = 1.0 - crossing / max(sum(scaled_iois), 1e-9)

        w = WEIGHTS
        return (
            w["agogic"] * agogic
            + w["dynamic"] * dynamic
            + w["final_downbeat"] * final_downbeat
            + w["parallelism"] * parallelism
            + w["tonal"] * tonal
            + w["anti_syncopation"] * anti_sync
        )

    @staticmethod
    def apply(raw_notes: list[dict], result: MeterResult) -> list[dict]:
        """Rescale start_beats to the detected level and shift by the phase so
        bar boundaries land on downbeats. The anacrusis gap before the first
        onset becomes a leading rest (engraved exactly like the printed part:
        rests filling bar 1 before the pickup note). Returns a new list."""
        notes = [dict(n) for n in raw_notes]
        for n in notes:
            n["start_beat"] = float(n.get("start_beat", 0.0)) * result.level + result.phase
        notes.sort(key=lambda n: n["start_beat"])
        if notes and notes[0]["start_beat"] >= PHASE_STEP - 1e-6:
            notes.insert(0, {
                "note": "rest",
                "start_beat": 0.0,
                "measure": 1,
                "duration_sec": 0.0,  # quantizer derives duration from the gap
                "confidence": 1.0,
                "velocity": 0,
                "articulation": None,
            })
        return notes
