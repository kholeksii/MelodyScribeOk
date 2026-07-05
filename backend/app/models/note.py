
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

class TranscriptionData(BaseModel):
    notes: list[NoteData]
    tempo: int
    key: str
    time_signature: str
    instrument: str