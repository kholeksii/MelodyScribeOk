import logging

from music21 import duration as m21duration
from music21 import key, metadata, meter, note, stream, tempo, tie

from ..models.note import NoteData
from ..models.project import Project

logger = logging.getLogger(__name__)

DURATION_MAP = {
    "whole": 4.0,
    "half.": 3.0,
    "half": 2.0,
    "quarter.": 1.5,
    "quarter": 1.0,
    "eighth.": 0.75,
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

        pickup_notes = [nd for nd in project.notes if nd.measure == 0]
        if pickup_notes:
            part = self._build_part_with_pickup(project, pickup_notes)
        else:
            part = stream.Part()
            self._append_signatures(part, project)
            for nd in project.notes:
                part.append(self._note_data_to_element(nd))
            part.makeMeasures(inPlace=True)

        score.append(part)
        return score

    def _append_signatures(self, target, project: Project) -> None:
        target.append(meter.TimeSignature(project.metadata.time_signature))
        ks = self._parse_key(project.metadata.key)
        if ks:
            target.append(ks)
        target.append(tempo.MetronomeMark(number=project.metadata.tempo))

    def _build_part_with_pickup(
        self, project: Project, pickup_notes: list[NoteData]
    ) -> stream.Part:
        """An anacrusis is an implicit short first measure (number 0 with
        paddingLeft), which MusicXML marks implicit="yes" — measure numbering
        of the full bars starts at 1, exactly like the printed part (U32)."""
        ts = meter.TimeSignature(project.metadata.time_signature)
        pickup_ql = sum(
            DURATION_MAP.get(nd.duration, 1.0) for nd in pickup_notes
        )

        m0 = stream.Measure(number=0)
        m0.paddingLeft = max(0.0, float(ts.barDuration.quarterLength) - pickup_ql)
        # music21 writes <measure implicit="yes"> from showNumber == NEVER
        m0.showNumber = stream.enums.ShowNumber.NEVER
        self._append_signatures(m0, project)
        for nd in pickup_notes:
            m0.append(self._note_data_to_element(nd))

        # Full bars start at the bar-2 downbeat; makeMeasures numbers them 1..n
        body = stream.Part()
        for nd in project.notes:
            if nd.measure != 0:
                body.append(self._note_data_to_element(nd))
        body.insert(0, meter.TimeSignature(project.metadata.time_signature))
        body.makeMeasures(inPlace=True)

        part = stream.Part()
        part.append(m0)
        offset = pickup_ql
        for m in body.getElementsByClass(stream.Measure):
            m.removeByClass(meter.TimeSignature)
            part.insert(offset, m)
            offset += float(m.duration.quarterLength)
        return part

    def _note_data_to_element(self, nd: NoteData):
        """Convert NoteData to a music21 note or rest."""
        ql = DURATION_MAP.get(nd.duration, 1.0)

        if nd.pitch == "rest":
            r = note.Rest(quarterLength=ql)
            return r

        n = note.Note(nd.pitch, quarterLength=ql)
        n.volume.velocity = nd.velocity

        if nd.tuplet == "triplet":
            n.duration.appendTuplet(m21duration.Tuplet(3, 2))
        if nd.tie_start and nd.tie_end:
            n.tie = tie.Tie("continue")
        elif nd.tie_start:
            n.tie = tie.Tie("start")
        elif nd.tie_end:
            n.tie = tie.Tie("stop")
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
