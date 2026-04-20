from pydantic import BaseModel
from typing import List
from .note import NoteData

class ProjectMetadata(BaseModel):
    title: str
    instrument: str
    tempo: int
    time_signature: str = "4/4"
    key: str = "C"

class Project(BaseModel):
    version: str = "1.0"
    metadata: ProjectMetadata
    notes: List[NoteData]