
BEAT_VALUES: list[tuple[str, float]] = [
    ("whole",    4.0),
    ("half.",    3.0),
    ("half",     2.0),
    ("quarter.", 1.5),
    ("quarter",  1.0),
    ("eighth.",  0.75),
    ("eighth",   0.5),
    ("sixteenth",0.25),
]

GRID = 0.25  # sixteenth-note grid


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
    Context-aware quantizer that aligns notes to a beat grid and
    ensures durations sum correctly within each measure.
    """

    DURATION_MAP = {name: val for name, val in BEAT_VALUES}

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
        'duration_sec', and 'start_beat' / 'measure' are corrected.
        """
        if not raw_notes:
            return raw_notes

        bpb = _beats_per_measure(time_signature)  # beats per measure
        notes = [dict(n) for n in raw_notes]

        # 1. Snap start beats to grid
        for n in notes:
            n["start_beat"] = _snap(float(n.get("start_beat", 0.0)))

        # 2. Sort by start beat
        notes.sort(key=lambda n: n["start_beat"])

        # 3. Assign durations based on gap to the next note (or measure end)
        for i, note in enumerate(notes):
            sb = note["start_beat"]

            # Measure boundary this note belongs to
            measure_idx = int(sb // bpb)          # 0-based
            measure_end = (measure_idx + 1) * bpb  # beat at which measure ends

            # Gap to next note or measure boundary (whichever comes first)
            if i + 1 < len(notes):
                next_sb = notes[i + 1]["start_beat"]
                gap = min(next_sb - sb, measure_end - sb)
            else:
                gap = measure_end - sb

            gap = max(GRID, _snap(gap))
            note["duration"] = _closest_duration(gap)

            # Update measure number (1-based)
            note["measure"] = measure_idx + 1

            # Remove raw duration_sec if present
            note.pop("duration_sec", None)

        # 4. Fill any leftover space inside each measure with rests
        #    (optional — keeps measures complete without modifying notes)
        notes = self._fill_measures(notes, bpb)

        return notes

    def _fill_measures(self, notes: list[dict], bpb: float) -> list[dict]:
        """
        If a measure is under-filled, extend the last note in it to fill
        the remaining beats (capped at a whole note).
        """
        measures: dict[int, list[int]] = {}
        for i, n in enumerate(notes):
            m = n["measure"]
            measures.setdefault(m, []).append(i)

        for m_num, indices in measures.items():
            used = sum(self.DURATION_MAP.get(notes[i]["duration"], 1.0) for i in indices)
            remaining = round(bpb - used, 6)

            if remaining > GRID / 2:
                # Extend the last note in this measure
                last_idx = indices[-1]
                current = self.DURATION_MAP.get(notes[last_idx]["duration"], 1.0)
                notes[last_idx]["duration"] = _closest_duration(current + remaining)

        return notes
