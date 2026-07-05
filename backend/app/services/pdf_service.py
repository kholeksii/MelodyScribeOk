import logging

from music21 import key, metadata, meter, note, stream, tempo

from ..models.note import NoteData
from ..models.project import Project

logger = logging.getLogger(__name__)

DURATION_MAP = {
    "whole": 4.0,
    "half": 2.0,
    "quarter": 1.0,
    "eighth": 0.5,
    "sixteenth": 0.25,
}


class PDFService:
    """Service for exporting musical notation to MusicXML via music21."""

    def export_musicxml(self, project: Project) -> str:
        """
        Export project to MusicXML string.

        Returns:
            MusicXML content as a string
        """
        score = self._build_score(project)
        return score.write("musicxml").read_text(encoding="utf-8")

    def export_musicxml_bytes(self, project: Project) -> bytes:
        """
        Export project to MusicXML bytes.

        Returns:
            MusicXML content as bytes
        """
        score = self._build_score(project)
        return score.write("musicxml").read_bytes()

    def _build_score(self, project: Project) -> stream.Score:
        """Build a music21 Score from project data."""
        score = stream.Score()

        md = metadata.Metadata()
        md.title = project.metadata.title or "Untitled"
        md.composer = project.metadata.instrument.title()
        score.metadata = md

        part = stream.Part()

        ts = meter.TimeSignature(project.metadata.time_signature)
        part.append(ts)

        ks = self._parse_key(project.metadata.key)
        if ks:
            part.append(ks)

        mm = tempo.MetronomeMark(number=project.metadata.tempo)
        part.append(mm)

        for nd in project.notes:
            el = self._note_data_to_element(nd)
            part.append(el)

        part.makeMeasures(inPlace=True)
        score.append(part)

        return score

    def _note_data_to_element(self, nd: NoteData):
        """Convert NoteData to a music21 note or rest."""
        ql = DURATION_MAP.get(nd.duration, 1.0)

        if nd.pitch == "rest":
            r = note.Rest(quarterLength=ql)
            return r

        n = note.Note(nd.pitch, quarterLength=ql)
        n.volume.velocity = nd.velocity
        return n

    def _parse_key(self, key_str: str):
        """Parse key string like 'C', 'G Major', 'A minor'."""
        try:
            return key.Key(key_str)
        except Exception:
            try:
                return key.Key(key_str.split()[0])
            except Exception:
                logger.warning(f"Could not parse key: {key_str}")
                return None
