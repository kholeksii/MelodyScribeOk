import React, { useEffect, useRef, useState } from 'react';
import { NoteData } from '../../types';
import { useProjectStore } from '../../store/projectStore';

interface NotationEditorProps {
  notes: NoteData[];
  timeSignature: string;
  keySignature: string;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const NotationDisplay: React.FC<NotationEditorProps> = ({
  notes,
  timeSignature,
  keySignature,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const noteBoundingBoxes = useRef<Map<string, BoundingBox>>(new Map());
  const selectedNoteId = useProjectStore((state) => state.selectedNoteId);
  const playingNoteId = useProjectStore((state) => state.playingNoteId);
  const setSelectedNote = useProjectStore((state) => state.setSelectedNote);
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);

  // Calculate bounding boxes from SVG elements
  const calculateBoundingBoxes = () => {
    if (!svgRef.current) return;

    noteBoundingBoxes.current.clear();
    const noteheads = svgRef.current.querySelectorAll('.vf-notehead');
    
    noteheads.forEach((element, index) => {
      if (index < notes.length) {
        const rect = element.getBoundingClientRect();
        const svgRect = svgRef.current!.getBoundingClientRect();
        
        const noteId = notes[index].id;
        const bbox: BoundingBox = {
          x: rect.left - svgRect.left,
          y: rect.top - svgRect.top,
          width: rect.width,
          height: rect.height,
        };
        
        noteBoundingBoxes.current.set(noteId, bbox);
      }
    });

    console.log('📍 Bounding boxes calculated:', noteBoundingBoxes.current.size);
  };

  // Find note at coordinates
  const findNoteAtCoordinates = (x: number, y: number): string | null => {
    for (const [noteId, bbox] of noteBoundingBoxes.current.entries()) {
      if (
        x >= bbox.x &&
        x <= bbox.x + bbox.width &&
        y >= bbox.y &&
        y <= bbox.y + bbox.height
      ) {
        return noteId;
      }
    }
    return null;
  };

  // Handle SVG click
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;

    const noteId = findNoteAtCoordinates(x, y);
    
    if (noteId) {
      console.log('🎵 Clicked note:', noteId);
      setSelectedNote(noteId);
      setHighlightedNoteId(noteId);
    } else {
      console.log('❌ No note clicked');
      setSelectedNote(null);
      setHighlightedNoteId(null);
    }
  };

  // Handle mouse move for hover effect
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;

    const noteId = findNoteAtCoordinates(x, y);
    if (noteId && noteId !== highlightedNoteId) {
      setHighlightedNoteId(noteId);
      svgRef.current.style.cursor = 'pointer';
    } else if (!noteId) {
      setHighlightedNoteId(null);
      svgRef.current.style.cursor = 'default';
    }
  };

  useEffect(() => {
    if (!containerRef.current || !notes.length) {
      console.log('NotationEditor: container or notes empty', { containerRef: !!containerRef.current, notesLength: notes.length });
      return;
    }

    console.log('NotationEditor: rendering notes', { notesLength: notes.length, firstNote: notes[0] });

    // Clear previous content
    containerRef.current.innerHTML = '';

    // Dynamic import to avoid SSR issues
    const loadVexFlow = async () => {
      try {
        const Vex = await import('vexflow');
        console.log('VexFlow imported successfully');
        
        const { Renderer, Stave, StaveNote, Voice, Formatter } = Vex.Flow;

        if (!Renderer || !Stave || !StaveNote) {
          console.error('VexFlow components not found');
          return;
        }

        // Try to get Rest class - may not be available in all versions
        const Rest = (Vex.Flow as any).Rest || null;

        // Create a wrapper div for SVG with click handling
        const svgWrapper = document.createElement('div');
        svgWrapper.style.width = '100%';
        svgWrapper.style.position = 'relative';
        containerRef.current!.appendChild(svgWrapper);

        // Create renderer with the div
        const renderer = new Renderer(svgWrapper, Renderer.Backends.SVG);
        renderer.resize(1200, 250);
        const context = renderer.getContext();

        // Get SVG element and add interactivity
        const svg = svgWrapper.querySelector('svg') as SVGSVGElement;
        if (svg) {
          (svgRef as any).current = svg;
          svg.addEventListener('click', handleSvgClick as any);
          svg.addEventListener('mousemove', handleSvgMouseMove as any);
          svg.style.cursor = 'default';
        }

        // Create stave
        const stave = new Stave(10, 40, 1100);
        stave.addClef('treble');
        stave.addTimeSignature(timeSignature);
        
        // Convert key signature to VexFlow format
        const vexKeySignature = convertKeySignatureToVexFlow(keySignature);
        if (vexKeySignature) {
          stave.addKeySignature(vexKeySignature);
        }
        
        stave.setContext(context).draw();

        // Convert notes to VexFlow format
        const vexNotes = notes.map((note, idx) => {
          const duration = convertDurationToVexFlow(note.duration);
          
          // Handle rests differently from regular notes
          if (note.pitch === 'rest') {
            console.log(`Rest ${idx}: duration=${note.duration} -> ${duration}`);
            // Try to use Rest class if available, otherwise use fallback
            if (Rest) {
              try {
                const rest = new Rest({ duration });
                (rest as any).noteDataId = note.id;
                return rest;
              } catch (e) {
                console.warn(`Failed to create Rest with Rest class, using fallback: ${e}`);
              }
            }
            
            // Fallback: create a StaveNote with rest marker
            const vexNote = new StaveNote({
              keys: ['b/4'],
              duration: duration,
            });
            (vexNote as any).noteDataId = note.id;
            (vexNote as any).isRest = true;
            // Hide the rest note visually as a rest
            return vexNote;
          }

          const pitch = convertPitchToVexFlow(note.pitch);
          console.log(`Note ${idx}: pitch=${note.pitch} -> ${pitch}, duration=${note.duration} -> ${duration}`);

          const vexNote = new StaveNote({
            keys: [pitch],
            duration: duration,
          });

          // Store note ID in userData for reference
          (vexNote as any).noteDataId = note.id;

          return vexNote;
        });

        // Create voice WITHOUT strict beat requirement
        const voice = new Voice();
        voice.setStrict(false); // Allow incomplete voices
        voice.addTickables(vexNotes);

        // Format and draw
        const formatter = new Formatter();
        formatter.joinVoices([voice]).format([voice], 900);
        voice.draw(context, stave);

        // Add highlighting for selected/hovered notes
        setTimeout(() => {
          calculateBoundingBoxes();
          highlightSelectedNote();
        }, 100);
        
        console.log('✅ Notation rendered successfully');
      } catch (error) {
        console.error('❌ Error rendering notation:', error);
      }
    };

    loadVexFlow();
  }, [notes, timeSignature, keySignature]);

  // Confidence → base color: green ≥0.9, yellow 0.7–0.9, red <0.7
  const confidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return '#16a34a'; // green-600
    if (confidence >= 0.7) return '#d97706'; // amber-600
    return '#dc2626';                         // red-600
  };

  // Priority: playing > selected > hovered > confidence heatmap
  const highlightSelectedNote = () => {
    if (!svgRef.current) return;

    const noteheads = svgRef.current.querySelectorAll('.vf-notehead');
    noteheads.forEach((element, index) => {
      if (index >= notes.length) return;
      const note = notes[index];
      const isPlaying = note.id === playingNoteId;
      const isSelected = note.id === selectedNoteId;
      const isHovered = note.id === highlightedNoteId;

      let color: string;
      let opacity = '1';

      if (isPlaying) {
        color = '#16a34a';       // green — currently playing
      } else if (isSelected) {
        color = '#2563eb';       // blue — selected by user
      } else if (isHovered) {
        color = '#6b7280';       // gray — hovered
        opacity = '0.8';
      } else {
        color = confidenceColor(note.confidence ?? 1);
      }

      (element as SVGElement).setAttribute('fill', color);
      (element as SVGElement).setAttribute('opacity', opacity);

      const stem = element.parentElement?.querySelector('.vf-stem');
      if (stem) {
        (stem as SVGElement).setAttribute('stroke', color);
        (stem as SVGElement).setAttribute('opacity', opacity);
      }
    });
  };

  // Update highlighting when playing/selection/hover changes
  useEffect(() => {
    highlightSelectedNote();
  }, [playingNoteId, selectedNoteId, highlightedNoteId]);

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold mb-2">
        Notation Editor - {notes.length} notes
        {selectedNoteId && (
          <span className="ml-3 text-sm text-blue-600 font-normal">
            (Selected: {notes.find((n) => n.id === selectedNoteId)?.pitch})
          </span>
        )}
      </h2>
      <div className="mb-2 text-sm text-gray-600">
        Time: {timeSignature} | Key: {keySignature}
      </div>
      <div className="border border-gray-200 rounded-lg p-4 bg-white min-h-48">
        <div ref={containerRef} className="w-full" />
        {notes.length > 0 && (
          <div className="mt-4 text-xs text-gray-500">
            <p className="font-semibold mb-1">Notes loaded:</p>
            <ul>
              {notes.slice(0, 3).map((note) => (
                <li
                  key={note.id}
                  className={`cursor-pointer py-1 px-2 rounded ${
                    selectedNoteId === note.id
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedNote(note.id)}
                >
                  {note.pitch} ({note.duration}) - confidence: {(note.confidence * 100).toFixed(0)}%
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
        <span className="font-medium">Confidence:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#16a34a' }} />
          High (&ge;90%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#d97706' }} />
          Medium (70–90%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: '#dc2626' }} />
          Low (&lt;70%)
        </span>
        <span className="ml-2 text-gray-400">· Click a note to select</span>
      </div>
    </div>
  );
};

// Helper function to convert key signature from backend format to VexFlow format
function convertKeySignatureToVexFlow(key: string): string {
  // "B major" -> "B", "A minor" -> "Am"
  if (!key) return '';
  
  const parts = key.split(' ');
  const note = parts[0]; // "B", "A#", "Db", etc.
  const mode = parts[1]?.toLowerCase(); // "major", "minor"
  
  if (mode === 'minor') {
    return note + 'm';
  }
  return note;
}

// Helper functions for pitch and duration conversion
function convertPitchToVexFlow(pitch: string): string {
  // Convert "C4" to "c/4", "C#4" to "c#/4", etc.
  const note = pitch.slice(0, -1).toLowerCase();
  const octave = pitch.slice(-1);
  return `${note}/${octave}`;
}

function convertDurationToVexFlow(duration: string): string {
  const durationMap: { [key: string]: string } = {
    whole: 'w',
    half: 'h',
    quarter: 'q',
    eighth: '8',
    sixteenth: '16',
  };

  return durationMap[duration] || 'q'; // Default to quarter note
}