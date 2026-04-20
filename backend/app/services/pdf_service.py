import subprocess
import tempfile
import os
import logging
from pathlib import Path
from typing import Dict
from ..models.project import Project
from ..models.note import NoteData

logger = logging.getLogger(__name__)


class PDFService:
    """Service for exporting musical notation to PDF via LilyPond."""
    
    def __init__(self):
        """Initialize PDF service."""
        self.lilypond_cmd = "lilypond"
        # Check if lilypond is available
        self._check_lilypond()
    
    def _check_lilypond(self) -> bool:
        """Check if lilypond is installed and available."""
        try:
            result = subprocess.run(
                [self.lilypond_cmd, "--version"],
                capture_output=True,
                timeout=5
            )
            if result.returncode == 0:
                logger.info("LilyPond found")
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            logger.warning("LilyPond not found - PDF export will be unavailable")
            return False
    
    def export(self, project: Project) -> bytes:
        """
        Export project to PDF using LilyPond.
        
        Args:
            project: Project object with notes and metadata
        
        Returns:
            PDF file as bytes
        
        Raises:
            RuntimeError: If LilyPond is unavailable or conversion fails
        """
        try:
            # Convert to LilyPond notation
            lilypond_str = self._to_lilypond(project)
            logger.info(f"Generated LilyPond string ({len(lilypond_str)} chars)")
            
            # Create temp directory
            with tempfile.TemporaryDirectory() as tmpdir:
                tmp_path = Path(tmpdir)
                
                # Write .ly file
                ly_file = tmp_path / "score.ly"
                ly_file.write_text(lilypond_str, encoding='utf-8')
                logger.info(f"Wrote LilyPond file: {ly_file}")
                
                # Run lilypond to generate PDF
                output_dir = tmp_path / "output"
                output_dir.mkdir(exist_ok=True)
                
                cmd = [
                    self.lilypond_cmd,
                    "-dbackend=ps",
                    "-dno-gs-load-fonts",
                    "-dinclude-eps-fonts",
                    "-o", str(output_dir / "score"),
                    "--pdf",
                    str(ly_file)
                ]
                
                logger.info(f"Running: {' '.join(cmd)}")
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    timeout=30,
                    text=True
                )
                
                if result.returncode != 0:
                    logger.error(f"LilyPond error: {result.stderr}")
                    raise RuntimeError(f"LilyPond conversion failed: {result.stderr}")
                
                # Read PDF file
                pdf_file = output_dir / "score.pdf"
                if not pdf_file.exists():
                    raise RuntimeError("LilyPond did not generate PDF file")
                
                pdf_bytes = pdf_file.read_bytes()
                logger.info(f"Generated PDF ({len(pdf_bytes)} bytes)")
                
                return pdf_bytes
        
        except subprocess.TimeoutExpired:
            logger.error("LilyPond conversion timeout")
            raise RuntimeError("PDF generation timeout (>30s)")
        except Exception as e:
            logger.error(f"PDF export error: {e}", exc_info=True)
            raise RuntimeError(f"PDF export failed: {str(e)}")
    
    def _to_lilypond(self, project: Project) -> str:
        """
        Convert project notes to LilyPond notation.
        
        Args:
            project: Project object
        
        Returns:
            LilyPond notation string
        """
        # Note mappings
        note_map = {
            'C': 'c', 'C#': 'cis', 'D': 'd', 'D#': 'dis', 'E': 'e',
            'F': 'f', 'F#': 'fis', 'G': 'g', 'G#': 'gis', 'A': 'a',
            'A#': 'ais', 'B': 'b'
        }
        
        # Duration mappings
        duration_map = {
            'whole': '1',
            'half': '2',
            'quarter': '4',
            'eighth': '8',
            'sixteenth': '16'
        }
        
        # Build notes string
        notes_ly = []
        for note in project.notes:
            if note.pitch == 'rest':
                # Rest
                duration = duration_map.get(note.duration, '4')
                notes_ly.append(f"r{duration}")
            else:
                # Parse pitch (e.g., "C4" -> C in octave 4)
                pitch_note = note.pitch[:-1]  # Remove octave digit
                octave = int(note.pitch[-1])  # Get octave
                
                # Convert to LilyPond note format
                ly_note = note_map.get(pitch_note, 'c')
                
                # LilyPond octave notation: c = middle C
                # Our C4 = middle C, so no modifier needed for octave 4
                # C3 = one octave lower = c (with comma)
                # C5 = one octave higher = c' (with apostrophe)
                if octave < 4:
                    octave_mod = ',' * (4 - octave)
                    ly_note = f"{ly_note}{octave_mod}"
                elif octave > 4:
                    octave_mod = "'" * (octave - 4)
                    ly_note = f"{ly_note}{octave_mod}"
                
                duration = duration_map.get(note.duration, '4')
                notes_ly.append(f"{ly_note}{duration}")
        
        notes_str = ' '.join(notes_ly)
        
        # Get metadata
        title = project.metadata.title or "Untitled"
        composer = f"{project.metadata.instrument.title()}"  # Use instrument as composer
        
        # Build LilyPond file
        lilypond = f'''\\version "2.24.0"

\\header {{
  title = "{title}"
  composer = "{composer}"
}}

\\score {{
  \\new Staff {{
    \\relative c' {{
      {notes_str}
    }}
  }}
  
  \\layout {{ }}
  \\midi {{
    \\tempo 4 = {project.metadata.tempo}
  }}
}}
'''
        
        return lilypond
