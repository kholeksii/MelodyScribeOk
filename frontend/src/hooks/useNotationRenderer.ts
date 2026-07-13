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

const ACCENT_RGB = '124, 92, 191';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Responsive tier, matching vexflowRenderer's breakpoints (SPEC.md §2/§3). */
function tierOf(width: number): number {
  if (width < 640) return 0;
  if (width < 1024) return 1;
  return 2;
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
  const [containerWidth, setContainerWidth] = useState(0);

  // Observe the container's width, debounced; the render effect below only
  // reacts to the derived tier (see deps), not every pixel (SPEC.md §3).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setContainerWidth(el.getBoundingClientRect().width);

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (!width) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setContainerWidth(width), 200);
    });
    observer.observe(el);

    return () => {
      if (timeout) clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  const tier = tierOf(containerWidth);

  // Hit zones injected by renderScore (one per note, full slot × stave height)
  const calculateBoundingBoxes = () => {
    if (!svgRef.current) return;

    noteBoundingBoxes.current.clear();
    const svgRect = svgRef.current.getBoundingClientRect();
    const hitZones = svgRef.current.querySelectorAll<SVGGraphicsElement>('.vf-hit-zone');

    hitZones.forEach((element) => {
      const noteId = element.getAttribute('data-note-id');
      if (!noteId) return;
      const rect = element.getBoundingClientRect();
      noteBoundingBoxes.current.set(noteId, {
        x: rect.left - svgRect.left,
        y: rect.top - svgRect.top,
        width: rect.width,
        height: rect.height,
      });
    });

    console.log('📍 Hit zones calculated:', noteBoundingBoxes.current.size);
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
    const svg = svgRef.current;

    const noteheads = svg.querySelectorAll<SVGGraphicsElement>('.vf-notehead');
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

    // Selection halo (SPEC.md §3): a soft accent ring so selection reads at
    // small scale, even when the notehead color change alone is subtle.
    svg.querySelectorAll('.vf-selection-halo').forEach((el) => el.remove());
    const selectedIndex = selectedNoteId ? notes.findIndex((n) => n.id === selectedNoteId) : -1;
    const selectedEl = selectedIndex >= 0 ? noteheads[selectedIndex] : null;
    if (selectedEl) {
      const bbox = selectedEl.getBBox();
      const halo = document.createElementNS(SVG_NS, 'circle');
      halo.setAttribute('cx', String(bbox.x + bbox.width / 2));
      halo.setAttribute('cy', String(bbox.y + bbox.height / 2));
      halo.setAttribute('r', '15');
      halo.setAttribute('fill', `rgba(${ACCENT_RGB}, 0.14)`);
      halo.setAttribute('stroke', `rgba(${ACCENT_RGB}, 0.45)`);
      halo.setAttribute('stroke-width', '1.5');
      halo.classList.add('vf-selection-halo');
      svg.insertBefore(halo, svg.firstChild);
    }
  };

  useEffect(() => {
    if (!containerRef.current || !notes.length || containerWidth === 0) {
      console.log('NotationEditor: container, notes, or width not ready', {
        containerRef: !!containerRef.current,
        notesLength: notes.length,
        containerWidth,
      });
      return;
    }

    console.log('NotationEditor: rendering notes', {
      notesLength: notes.length,
      firstNote: notes[0],
      tier,
    });

    // Clear previous content
    containerRef.current.innerHTML = '';

    renderScore(
      containerRef.current,
      notes,
      timeSignature,
      keySignature,
      { onClick: handleSvgClick, onMouseMove: handleSvgMouseMove },
      containerWidth,
    ).then((svg) => {
      svgRef.current = svg;
      if (!svg) return;
      // Add highlighting for selected/hovered notes
      setTimeout(() => {
        calculateBoundingBoxes();
        highlightSelectedNote();
      }, 100);
    });
    // Re-render on tier change (not every pixel of containerWidth) — see ResizeObserver above.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- render only on score/tier changes; handlers/highlight are stable per render
  }, [notes, timeSignature, keySignature, tier]);

  // Update highlighting when playing/selection/hover changes
  useEffect(() => {
    highlightSelectedNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repaint only on highlight-relevant state
  }, [playingNoteId, selectedNoteId, highlightedNoteId]);

  return { containerRef };
}
