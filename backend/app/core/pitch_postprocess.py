"""Pitch trajectory post-processing: octave-error cleanup (U12).

pyin occasionally locks onto a harmonic for a single note, producing an
octave jump the player never made (the audit found a B3 surrounded by B4s
in the violin take). These are folded back toward their neighbors.
"""
OCTAVE = 12
# after folding, the note must land this close to both neighbors
CONTEXT_FIT_SEMITONES = 4
# before folding, the outlier must be at least this far from both neighbors
OUTLIER_MIN_DISTANCE = 8
FOLD_CONFIDENCE_PENALTY = 0.7  # flag folded notes for review in the heatmap


def fold_octave_outliers(notes: list[dict]) -> list[dict]:
    """Fold isolated octave outliers toward their neighbors.

    A note is folded when moving it an octave toward its neighbors makes it
    FIT their local context while the original sits far from both — and the
    outlier pitch does not recur nearby (a genuine octave alternation like
    C4-C5-C4-C5 must survive).
    """
    import librosa

    sounding = [
        (i, int(librosa.note_to_midi(n["note"])))
        for i, n in enumerate(notes)
        if n["note"] != "rest"
    ]
    if len(sounding) < 3:
        return notes

    midis = [m for _, m in sounding]
    result = [dict(n) for n in notes]

    for k in range(1, len(sounding) - 1):
        prev_midi, midi, next_midi = midis[k - 1], midis[k], midis[k + 1]
        folded = midi - OCTAVE if midi > prev_midi else midi + OCTAVE

        fits_context = (
            abs(folded - prev_midi) <= CONTEXT_FIT_SEMITONES
            and abs(folded - next_midi) <= CONTEXT_FIT_SEMITONES
        )
        is_outlier = (
            abs(midi - prev_midi) >= OUTLIER_MIN_DISTANCE
            and abs(midi - next_midi) >= OUTLIER_MIN_DISTANCE
        )
        if not (fits_context and is_outlier):
            continue
        # recurrence guard: the same pitch nearby means a real alternation
        window = midis[max(0, k - 2) : k] + midis[k + 1 : k + 3]
        if midi in window:
            continue

        note_index = sounding[k][0]
        note = result[note_index]
        note["note"] = librosa.midi_to_note(folded, unicode=False)
        note["confidence"] = round(note["confidence"] * FOLD_CONFIDENCE_PENALTY, 4)
        midis[k] = folded  # later checks see the corrected trajectory

    return result
