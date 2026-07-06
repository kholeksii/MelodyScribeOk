"""Key detection: circular Krumhansl rotation + note-based estimation (U30)."""
import pytest
import soundfile as sf

from app.core.key_detector import KeyDetector

C_MAJOR_SCALE = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
A_HARMONIC_MINOR = ["A3", "B3", "C4", "D4", "E4", "F4", "G#4", "A4"]
# G-major phrase ending on the tonic (Que Lindo contour, simplified)
G_MAJOR_MELODY = ["D4", "B4", "B4", "G4", "E4", "D4", "B4", "A4", "G4", "F#4", "G4"]


class TestDetectFromNotes:
    def test_c_major_scale(self) -> None:
        assert KeyDetector().detect_from_notes(C_MAJOR_SCALE) == "C major"

    def test_a_harmonic_minor_scale(self) -> None:
        assert KeyDetector().detect_from_notes(A_HARMONIC_MINOR) == "A minor"

    def test_g_major_melody_ending_on_tonic(self) -> None:
        assert KeyDetector().detect_from_notes(G_MAJOR_MELODY) == "G major"

    @pytest.mark.parametrize("semitones,expected", [(2, "D major"), (5, "F major"), (7, "G major")])
    def test_transposition_maps_to_transposed_key(self, semitones: int, expected: str) -> None:
        import librosa

        transposed = [
            librosa.midi_to_note(librosa.note_to_midi(p) + semitones, unicode=False)
            for p in C_MAJOR_SCALE
        ]
        assert KeyDetector().detect_from_notes(transposed) == expected

    def test_long_mid_melody_dominant_does_not_flip_the_key(self) -> None:
        # A held G (dominant) mid-melody must not flip C major to G major
        pitches = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]
        durations = [1.0, 1.0, 1.0, 1.0, 4.0, 1.0, 1.0, 2.0]
        assert KeyDetector().detect_from_notes(pitches, durations) == "C major"

    def test_rests_and_garbage_are_ignored(self) -> None:
        pitches = ["rest", *C_MAJOR_SCALE, "not-a-pitch"]
        assert KeyDetector().detect_from_notes(pitches) == "C major"

    def test_empty_input_defaults(self) -> None:
        assert KeyDetector().detect_from_notes([]) == "C major"
        assert KeyDetector().detect_from_notes(["rest"]) == "C major"


class TestDetectFromAudio:
    def test_c_major_scale_from_chroma(self, synth_melody) -> None:
        path = synth_melody([(p, 1.0) for p in C_MAJOR_SCALE], bpm=120)
        audio, sr = sf.read(path, dtype="float32")
        assert KeyDetector().detect(audio, sr) == "C major"
