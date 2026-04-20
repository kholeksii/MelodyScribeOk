from pydantic import BaseModel
from typing import List

class NoteData(BaseModel):
    id: str
    pitch: str
    duration: str
    start_beat: float
    measure: int
    velocity: int
    confidence: float
    llm_corrected: bool = False

class TranscriptionResult(BaseModel):
    success: bool
    data: "TranscriptionData"

class TranscriptionData(BaseModel):
    notes: List[NoteData]
    tempo: int
    key: str
    time_signature: str
    instrument: str