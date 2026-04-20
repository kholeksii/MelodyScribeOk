import httpx
import json
import logging
from typing import List, Dict, Any
from ..models.note import NoteData
from ..config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Service for LLM-based verification of transcribed notes."""
    
    def __init__(self):
        """Initialize LLM service with Ollama configuration."""
        self.ollama_url = settings.ollama_url
        self.model = "mistral"
        self.timeout = 30.0
    
    async def verify(
        self,
        notes: List[NoteData],
        instrument: str,
        tempo: int,
        key: str,
        time_signature: str = "4/4"
    ) -> Dict[str, Any]:
        """
        Verify transcribed notes using LLM.
        
        Args:
            notes: List of transcribed notes
            instrument: Instrument name (violin, piano, guitar)
            tempo: Tempo in BPM
            key: Key signature (e.g., "C Major")
            time_signature: Time signature (default "4/4")
        
        Returns:
            Dict with corrections, confidence, and optional error message
        """
        try:
            # Convert notes to ABC notation
            abc_notes = self._notes_to_abc(notes)
            logger.info(f"Generated ABC notation: {abc_notes[:100]}...")
            
            # Construct LLM prompt
            prompt = self._construct_prompt(
                abc_notes=abc_notes,
                instrument=instrument,
                tempo=tempo,
                key=key,
                time_signature=time_signature
            )
            logger.info(f"LLM Prompt length: {len(prompt)} chars")
            
            # Call Ollama API with shorter connect timeout
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
                    response = await client.post(
                        f"{self.ollama_url}/api/generate",
                        json={
                            "model": self.model,
                            "prompt": prompt,
                            "stream": False,
                        }
                    )
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                logger.warning(f"Cannot connect to Ollama at {self.ollama_url}: {e}")
                return self._demo_response()
            
            if response.status_code != 200:
                logger.error(f"Ollama error: {response.status_code} {response.text}")
                return self._demo_response()
            
            # Parse response
            result_data = response.json()
            response_text = result_data.get("response", "")
            logger.info(f"LLM Response: {response_text[:200]}...")
            
            # Extract JSON from response
            corrections_data = self._parse_llm_response(response_text)
            logger.info(f"Parsed corrections: {corrections_data}")
            
            return corrections_data
            
        except httpx.TimeoutException:
            logger.warning("LLM request timeout (30s)")
            return {
                "corrections": [],
                "confidence": 0.0,
                "error": "LLM request timeout"
            }
        except Exception as e:
            logger.error(f"LLM verification error: {e}", exc_info=True)
            return {
                "corrections": [],
                "confidence": 0.0,
                "error": str(e)
            }
    
    def _notes_to_abc(self, notes: List[NoteData]) -> str:
        """
        Convert NoteData list to ABC notation string.
        
        ABC notation basics:
        - C D E F G A B = notes
        - c d e f g a b = one octave lower
        - C' D' = one octave higher
        - 4 = quarter note, 2 = half, 1 = whole, 8 = eighth, 16 = sixteenth
        - z = rest
        """
        abc_notes = []
        
        for note in notes:
            if note.pitch == "rest":
                # Rest: use 'z' with duration
                duration_symbol = self._duration_to_abc(note.duration)
                abc_notes.append(f"z{duration_symbol}")
            else:
                # Parse pitch (e.g., "C4" -> "C" with octave adjustment)
                abc_pitch = self._pitch_to_abc(note.pitch)
                duration_symbol = self._duration_to_abc(note.duration)
                abc_notes.append(f"{abc_pitch}{duration_symbol}")
        
        return " ".join(abc_notes)
    
    def _pitch_to_abc(self, pitch: str) -> str:
        """
        Convert pitch string (e.g., "C4") to ABC notation.
        
        ABC octaves:
        - No modifier = C3-B3
        - lowercase = C2-B2
        - ' = C4-B4
        - '' = C5-B5
        """
        if len(pitch) < 2:
            return "C"
        
        note = pitch[0]  # C, D, E, etc.
        octave = int(pitch[1])  # 0-8
        
        # ABC reference: middle C = C (no modifier)
        # Our reference: C4 = middle C
        # So C4 should be "C", C3 should be "c", C5 should be "C'"
        
        if octave < 3:
            return note.lower()  # C2 → c
        elif octave == 3:
            return note  # C3 → C
        elif octave == 4:
            return note  # C4 → C (in ABC, default is C4)
        else:  # octave > 4
            return note + ("'" * (octave - 4))  # C5 → C', C6 → C''
    
    def _duration_to_abc(self, duration: str) -> str:
        """Convert duration string to ABC notation."""
        duration_map = {
            "whole": "1",
            "half": "2",
            "quarter": "4",
            "eighth": "8",
            "sixteenth": "16",
        }
        return duration_map.get(duration, "4")
    
    def _construct_prompt(
        self,
        abc_notes: str,
        instrument: str,
        tempo: int,
        key: str,
        time_signature: str
    ) -> str:
        """Construct the LLM prompt for verification."""
        prompt = f"""You are a music theory expert. Analyze the following transcription for a {instrument} melody.

Tempo: {tempo} BPM
Key: {key}
Time signature: {time_signature}

Notes (ABC notation):
{abc_notes}

Check for:
1. Notes outside the instrument range
2. Unrealistic pitch jumps (>octave in fast passages)
3. Incorrect durations that don't fit the time signature
4. Common transcription errors

Return ONLY valid JSON (no markdown, no explanations):
{{"corrections": [{{"noteIndex": 0, "field": "pitch|duration", "oldValue": "...", "newValue": "...", "reason": "..."}}], "confidence": 0.85}}"""
        
        return prompt
    
    def _demo_response(self) -> Dict[str, Any]:
        """
        Return demo corrections for testing without Ollama.
        """
        logger.info("Returning demo verification response (Ollama unavailable)")
        return {
            "corrections": [
                {
                    "noteIndex": 0,
                    "field": "pitch",
                    "oldValue": "C4",
                    "newValue": "D4",
                    "reason": "Jump from previous note seems too large; D4 more likely in violin range"
                },
                {
                    "noteIndex": 2,
                    "field": "duration",
                    "oldValue": "eighth",
                    "newValue": "sixteenth",
                    "reason": "Duration doesn't fit 4/4 measure alignment"
                }
            ],
            "confidence": 0.72,
            "demo": True  # Mark as demo for frontend awareness
        }
    
    def _parse_llm_response(self, response_text: str) -> Dict[str, Any]:
        """
        Extract JSON from LLM response text.
        
        Returns default structure if parsing fails.
        """
        try:
            # Try to find JSON in response (in case there's extra text)
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            
            if start == -1 or end == 0:
                logger.warning("No JSON found in LLM response")
                return {
                    "corrections": [],
                    "confidence": 0.0,
                    "error": "Invalid LLM response format"
                }
            
            json_str = response_text[start:end]
            data = json.loads(json_str)
            
            # Validate structure
            if "corrections" not in data or "confidence" not in data:
                logger.warning(f"Invalid JSON structure: {data}")
                return {
                    "corrections": [],
                    "confidence": 0.0,
                    "error": "Invalid LLM response structure"
                }
            
            return {
                "corrections": data.get("corrections", []),
                "confidence": float(data.get("confidence", 0.0)),
            }
        
        except json.JSONDecodeError as e:
            logger.warning(f"JSON decode error: {e}")
            return {
                "corrections": [],
                "confidence": 0.0,
                "error": "Failed to parse LLM response"
            }
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            return {
                "corrections": [],
                "confidence": 0.0,
                "error": str(e)
            }
