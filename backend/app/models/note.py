
from pydantic import AliasChoices, BaseModel, Field


class NoteData(BaseModel):
    id: str
    pitch: str
    duration: str
    start_beat: float
    measure: int
    velocity: int
    confidence: float
    # "llm_corrected" accepted on input for pre-rename project files
    theory_corrected: bool = Field(
        default=False,
        validation_alias=AliasChoices("theory_corrected", "llm_corrected"),
    )
    articulation: str | None = None  # "staccato" | "legato" | None
    tuplet: str | None = None  # "triplet" | None
    tie_start: bool = False  # tied to the next note (across a barline)
    tie_end: bool = False  # continuation of the previous note

class TranscriptionData(BaseModel):
    notes: list[NoteData]
    tempo: int
    key: str
    time_signature: str
    instrument: str
    # None when the user supplied the meter explicitly (U31 auto-detection)
    time_signature_confidence: float | None = None
    # Length of the anacrusis (implicit measure 0) in beats, if any (U32)
    pickup_beats: float | None = None