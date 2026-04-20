from typing import List, Dict

class Quantizer:
    DURATION_MAP = {
        "whole": 4.0,
        "half": 2.0,
        "quarter": 1.0,
        "eighth": 0.5,
        "sixteenth": 0.25,
        "half.": 3.0,  # dotted half
        "quarter.": 1.5,  # dotted quarter
        "eighth.": 0.75,  # dotted eighth
    }

    def quantize_duration(self, duration_sec: float, bpm: int) -> str:
        # Convert duration to beats
        beats = duration_sec * bpm / 60.0

        # Find closest duration
        min_diff = float('inf')
        best_duration = "quarter"

        for name, beat_value in self.DURATION_MAP.items():
            diff = abs(beats - beat_value)
            if diff < min_diff:
                min_diff = diff
                best_duration = name

        return best_duration

    def quantize_notes(self, raw_notes: List[Dict], bpm: int) -> List[Dict]:
        # For now, just quantize each note's duration
        # In a real implementation, this would handle measure alignment, etc.
        for note in raw_notes:
            if 'duration_sec' in note:
                note['duration'] = self.quantize_duration(note['duration_sec'], bpm)
                del note['duration_sec']
        return raw_notes