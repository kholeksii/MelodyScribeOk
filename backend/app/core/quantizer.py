
BEAT_VALUES: list[tuple[str, float]] = [
    ("whole",    4.0),
    ("half.",    3.0),
    ("half",     2.0),
    ("quarter.", 1.5),
    ("quarter",  1.0),
    ("eighth.",  0.75),
    ("eighth",   0.5),
    ("sixteenth", 0.25),
]

GRID = 0.25  # sixteenth-note grid
TRIPLET_BEAT = 1.0 / 3.0
TRIPLET_TOLERANCE = 0.05  # +-15% of a triplet eighth


def _snap(beat: float) -> float:
    """Snap a beat position to the nearest sixteenth-note grid."""
    return round(round(beat / GRID) * GRID, 6)


def _beats_per_measure(time_signature: str) -> float:
    parts = time_signature.split("/")
    if len(parts) != 2:
        return 4.0
    num, denom = int(parts[0]), int(parts[1])
    return num * (4.0 / denom)


def _closest_duration(beats: float) -> str:
    """Return the duration name whose beat value is closest to `beats`."""
    beats = max(GRID, beats)
    best, best_diff = "quarter", float("inf")
    for name, val in BEAT_VALUES:
        diff = abs(beats - val)
        if diff < best_diff:
            best_diff = diff
            best = name
    return best


class Quantizer:
    """
    Context-aware quantizer that aligns notes to a beat grid, detects
    triplet groups, ties notes across barlines and ensures durations sum
    correctly within each measure.
    """

    DURATION_MAP = {name: val for name, val in BEAT_VALUES}

    @classmethod
    def effective_beats(cls, note: dict) -> float:
        """Sounding length in beats, accounting for triplet compression."""
        nominal = cls.DURATION_MAP.get(note.get("duration", "quarter"), 1.0)
        if note.get("tuplet") == "triplet":
            return nominal * 2.0 / 3.0
        return nominal

    def quantize_duration(self, duration_sec: float, bpm: int) -> str:
        """Simple single-note quantization (used outside full pipeline)."""
        beats = duration_sec * bpm / 60.0
        return _closest_duration(beats)

    def quantize_notes(
        self,
        raw_notes: list[dict],
        bpm: int,
        time_signature: str = "4/4",
    ) -> list[dict]:
        """
        Quantize a list of notes with full measure-context awareness.

        Each note dict must have:
          - 'start_beat': float  (beat position from start of piece)
          - 'duration_sec': float  (raw duration in seconds)
          - 'measure': int  (1-based measure number, used as hint)

        After quantization each note has 'duration' (str) instead of
        'duration_sec'; 'start_beat' / 'measure' are corrected; triplet
        groups carry tuplet='triplet'; notes crossing a barline are split
        into tie_start/tie_end pairs.
        """
        if not raw_notes:
            return raw_notes

        bpb = _beats_per_measure(time_signature)  # beats per measure
        notes = [dict(n) for n in raw_notes]
        notes.sort(key=lambda n: float(n.get("start_beat", 0.0)))

        triplet_members = self._detect_triplets(notes)

        # Snap starts: triplet members to the 1/3 grid, the rest to sixteenths
        for i, n in enumerate(notes):
            raw_beat = float(n.get("start_beat", 0.0))
            if i in triplet_members:
                n["start_beat"] = round(round(raw_beat / TRIPLET_BEAT) * TRIPLET_BEAT, 6)
            else:
                n["start_beat"] = _snap(raw_beat)

        # Assign durations and split notes crossing barlines
        out: list[dict] = []
        for i, note in enumerate(notes):
            sb = note["start_beat"]
            measure_idx = int(sb // bpb)  # 0-based
            measure_end = (measure_idx + 1) * bpb
            note["measure"] = measure_idx + 1
            note.pop("duration_sec", None)

            if i in triplet_members:
                note["duration"] = "eighth"
                note["tuplet"] = "triplet"
                out.append(note)
                continue

            gap = (notes[i + 1]["start_beat"] - sb) if i + 1 < len(notes) else measure_end - sb
            gap = max(GRID, _snap(gap))

            if sb + gap <= measure_end + GRID / 2:
                note["duration"] = _closest_duration(min(gap, measure_end - sb))
                out.append(note)
                continue

            # Crosses the barline: split into tied segments (rests split too,
            # but rests are never tied notationally)
            is_rest = note.get("note") == "rest"
            remaining = gap
            seg_start = sb
            segments: list[dict] = []
            while remaining > GRID / 2:
                seg_measure_idx = int(seg_start // bpb)
                seg_end = min(seg_start + remaining, (seg_measure_idx + 1) * bpb)
                seg_beats = seg_end - seg_start
                segment = dict(note)
                segment["start_beat"] = round(seg_start, 6)
                segment["measure"] = seg_measure_idx + 1
                segment["duration"] = _closest_duration(seg_beats)
                segments.append(segment)
                remaining = round(remaining - seg_beats, 6)
                seg_start = seg_end
            if not is_rest:
                for k, segment in enumerate(segments):
                    segment["tie_start"] = k < len(segments) - 1
                    segment["tie_end"] = k > 0
            out.extend(segments)

        # Fill any leftover space inside each measure
        return self._fill_measures(out, bpb)

    @staticmethod
    def _detect_triplets(notes: list[dict]) -> set:
        """Indices of notes forming triplet groups: three consecutive raw
        inter-onset gaps of ~1/3 beat starting near a beat boundary."""
        members: set = set()
        i = 0
        while i + 2 < len(notes):
            if i in members:
                i += 1
                continue
            s0 = float(notes[i].get("start_beat", 0.0))
            g1 = float(notes[i + 1].get("start_beat", 0.0)) - s0
            g2 = float(notes[i + 2].get("start_beat", 0.0)) - float(
                notes[i + 1].get("start_beat", 0.0)
            )
            on_beat = abs(s0 - round(s0)) <= TRIPLET_TOLERANCE
            if (
                on_beat
                and abs(g1 - TRIPLET_BEAT) <= TRIPLET_TOLERANCE
                and abs(g2 - TRIPLET_BEAT) <= TRIPLET_TOLERANCE
            ):
                members.update({i, i + 1, i + 2})
                i += 3
            else:
                i += 1
        return members

    @classmethod
    def extract_pickup(
        cls, notes: list[dict], time_signature: str = "4/4"
    ) -> tuple[list[dict], float | None]:
        """Convert a leading-rest anacrusis into a true pickup measure (U32).

        The meter detector engraves a detected anacrusis as rests filling the
        start of bar 1 (how a mid-piece pickup is printed). For a piece that
        BEGINS with the pickup, engraving convention is an implicit short
        first measure instead. When quantized `notes` start with rest(s)
        covering [0, first_onset) inside bar 1 followed by sounding notes
        completing that bar, this: drops the rests, shifts every start_beat
        left so the pickup begins at beat 0 (which also restores the audio
        timeline for playback), renumbers the pickup as measure 0 and the
        rest downward. Returns (new_notes, pickup_beats) — pickup_beats is
        None when there is nothing to convert.
        """
        bpb = _beats_per_measure(time_signature)
        prefix_rests = 0
        for n in notes:
            if n.get("note") == "rest" and n["measure"] == 1:
                prefix_rests += 1
            else:
                break
        if prefix_rests == 0 or prefix_rests >= len(notes):
            return notes, None

        first = notes[prefix_rests]
        pad = float(first["start_beat"])
        pickup = round(bpb - pad, 6)
        # a pickup must start inside bar 1 and be shorter than the bar
        if not (GRID / 2 < pad < bpb - GRID / 2) or first["measure"] != 1:
            return notes, None
        # the sounding notes must reach the bar 2 downbeat (complete bar 1)
        bar1 = [n for n in notes[prefix_rests:] if n["measure"] == 1]
        filled = pad + sum(cls.effective_beats(n) for n in bar1)
        if abs(filled - bpb) > GRID / 2:
            return notes, None

        out = []
        for n in notes[prefix_rests:]:
            moved = dict(n)
            moved["start_beat"] = round(float(n["start_beat"]) - pad, 6)
            moved["measure"] = 0 if moved["start_beat"] < pickup - GRID / 2 else (
                int((moved["start_beat"] - pickup) // bpb) + 1
            )
            out.append(moved)
        return out, pickup

    def _fill_measures(self, notes: list[dict], bpb: float) -> list[dict]:
        """
        If a measure is under-filled, extend the last note in it to fill
        the remaining beats (capped at a whole note).
        """
        measures: dict[int, list[int]] = {}
        for i, n in enumerate(notes):
            m = n["measure"]
            measures.setdefault(m, []).append(i)

        for indices in measures.values():
            used = sum(self.effective_beats(notes[i]) for i in indices)
            remaining = round(bpb - used, 6)

            if remaining > GRID / 2:
                # Extend the last non-triplet note in this measure
                candidates = [i for i in indices if notes[i].get("tuplet") is None]
                if not candidates:
                    continue
                last_idx = candidates[-1]
                current = self.DURATION_MAP.get(notes[last_idx]["duration"], 1.0)
                notes[last_idx]["duration"] = _closest_duration(current + remaining)

        return notes
