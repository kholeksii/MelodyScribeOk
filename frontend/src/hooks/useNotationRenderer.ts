import { useEffect, useRef, useState } from 'react';
import { NoteData } from '../types';
import { useProjectStore } from '../store/projectStore';
import { confidenceColor } from '../utils/vexflowConverter';
import { renderScore } from '../utils/vexflowRenderer';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseNotationRendererArgs {
  notes: NoteData[];
  timeSignature: string;
  keySignature: string;
}

/** Renders the score into the returned container, wires click/hover
 * hit-testing to the project store selection, and repaints note colors
 * for playing/selected/hovered/confidence states. */
export function useNotationRenderer({ notes, timeSignature, keySignature }: UseNotationRendererArgs) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
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
        noteBoundingBoxes.current.set(noteId, {
          x: rect.left - svgRect.left,
          y: rect.top - svgRect.top,
          width: rect.width,
          height: rect.height,
        });
      }
    });

    console.log('📍 Bounding boxes calculated:', noteBoundingBoxes.current.size);
  };

  const findNoteAtCoordinates = (x: number, y: number): string | null => {
    for (const [noteId, bbox] of noteBoundingBoxes.current.entries()) {
      if (x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height) {
        return noteId;
      }
    }
    return null;
  };

  // Attached as native listeners on the VexFlow-created SVG
  const handleSvgClick = (e: MouseEvent) => {
    if (!svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const noteId = findNoteAtCoordinates(e.clientX - svgRect.left, e.clientY - svgRect.top);

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

  const handleSvgMouseMove = (e: MouseEvent) => {
    if (!svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const noteId = findNoteAtCoordinates(e.clientX - svgRect.left, e.clientY - svgRect.top);
    if (noteId && noteId !== highlightedNoteId) {
      setHighlightedNoteId(noteId);
      svgRef.current.style.cursor = 'pointer';
    } else if (!noteId) {
      setHighlightedNoteId(null);
      svgRef.current.style.cursor = 'default';
    }
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
        color = '#16a34a'; // green — currently playing
      } else if (isSelected) {
        color = '#2563eb'; // blue — selected by user
      } else if (isHovered) {
        color = '#6b7280'; // gray — hovered
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

  useEffect(() => {
    if (!containerRef.current || !notes.length) {
      console.log('NotationEditor: container or notes empty', {
        containerRef: !!containerRef.current,
        notesLength: notes.length,
      });
      return;
    }

    console.log('NotationEditor: rendering notes', {
      notesLength: notes.length,
      firstNote: notes[0],
    });

    // Clear previous content
    containerRef.current.innerHTML = '';

    renderScore(containerRef.current, notes, timeSignature, keySignature, {
      onClick: handleSvgClick,
      onMouseMove: handleSvgMouseMove,
    }).then((svg) => {
      svgRef.current = svg;
      if (!svg) return;
      // Add highlighting for selected/hovered notes
      setTimeout(() => {
        calculateBoundingBoxes();
        highlightSelectedNote();
      }, 100);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- render only on score changes; handlers/highlight are stable per render
  }, [notes, timeSignature, keySignature]);

  // Update highlighting when playing/selection/hover changes
  useEffect(() => {
    highlightSelectedNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repaint only on highlight-relevant state
  }, [playingNoteId, selectedNoteId, highlightedNoteId]);

  return { containerRef };
}
