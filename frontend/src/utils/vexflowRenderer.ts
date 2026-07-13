import { NoteData } from '../types';
import {
  convertDurationSpec,
  convertKeySignatureToVexFlow,
  convertPitchToVexFlow,
  groupNotesByMeasure,
} from './vexflowConverter';

export interface RenderListeners {
  onClick: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
}

// Multi-system layout: measures wrap into lines so long scores stack
// vertically (readable on screen and paginatable in the PDF export).
// Tier breakpoints and internal render widths mirror SPEC.md §3/§2.
const LINE_HEIGHT = 150;
const STAVE_X = 10;
const STAVE_Y0 = 40;

/** Measures/line and internal SVG render width for a given container width. */
function tierFor(containerWidth: number): { measuresPerLine: number; renderW: number } {
  if (containerWidth < 640) return { measuresPerLine: 2, renderW: 640 };
  if (containerWidth < 1024) return { measuresPerLine: 3, renderW: 900 };
  return { measuresPerLine: 4, renderW: 1200 };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Full-slot tap targets so touch never needs to hit the tiny glyph itself
 * (SPEC.md §3): one transparent rect per note, spanning the horizontal
 * midpoint-to-midpoint gap between neighbours and the full stave height,
 * tagged with `data-note-id` for hit-testing. Relies on `.vf-notehead`
 * elements being drawn in the same order as `noteTickables` (also assumed
 * by the highlight/hover logic in useNotationRenderer). */
function injectHitZones(
  svg: SVGSVGElement,
  noteTickables: { data: { id: string }; line: number }[],
  staveX: number,
  staveW: number,
  staveY0: number,
): void {
  const noteheads = svg.querySelectorAll<SVGGraphicsElement>('.vf-notehead');
  if (noteheads.length === 0) return;

  const centers: { x: number; line: number }[] = [];
  noteheads.forEach((el, i) => {
    if (i >= noteTickables.length) return;
    const bbox = el.getBBox();
    centers.push({ x: bbox.x + bbox.width / 2, line: noteTickables[i].line });
  });

  const zoneTop = (line: number) => staveY0 + line * LINE_HEIGHT - 25;
  const zoneHeight = 110;

  centers.forEach((center, i) => {
    const { data } = noteTickables[i];
    const prev = i > 0 && centers[i - 1].line === center.line ? centers[i - 1] : null;
    const next = i < centers.length - 1 && centers[i + 1].line === center.line ? centers[i + 1] : null;
    const left = prev ? (prev.x + center.x) / 2 : staveX;
    const right = next ? (center.x + next.x) / 2 : staveX + staveW;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(left));
    rect.setAttribute('y', String(zoneTop(center.line)));
    rect.setAttribute('width', String(Math.max(0, right - left)));
    rect.setAttribute('height', String(zoneHeight));
    rect.setAttribute('fill', 'transparent');
    rect.setAttribute('data-note-id', data.id);
    rect.classList.add('vf-hit-zone');
    (rect.style as CSSStyleDeclaration).cursor = 'pointer';
    svg.appendChild(rect);
  });
}

/** Draw the score into `container` (imperative VexFlow API, dynamic import
 * to avoid SSR issues). Returns the created SVG element, with the given
 * listeners attached, or null when rendering failed. `containerWidth` picks
 * the responsive tier (measures/line, glyph scale) — see SPEC.md §3. */
export async function renderScore(
  container: HTMLDivElement,
  notes: NoteData[],
  timeSignature: string,
  keySignature: string,
  listeners: RenderListeners,
  containerWidth: number,
): Promise<SVGSVGElement | null> {
  try {
    const Vex = await import('vexflow');
    console.log('VexFlow imported successfully');

    const { Renderer, Stave, StaveNote, Voice, Formatter } = Vex.Flow;

    if (!Renderer || !Stave || !StaveNote) {
      console.error('VexFlow components not found');
      return null;
    }

    // Notes get tagged with their NoteData id for click hit-testing
    type Tickable = InstanceType<typeof StaveNote>;
    type TaggedTickable = Tickable & { noteDataId?: string };

    // Rest/BarNote/Dot/Tuplet/StaveTie may not exist in all VexFlow versions
    const flowExtras = Vex.Flow as unknown as {
      Rest?: new (opts: { duration: string }) => Tickable;
      BarNote?: new () => Tickable;
      Dot?: { buildAndAttach: (notes: Tickable[], opts?: { all?: boolean }) => void };
      Tuplet?: new (notes: Tickable[]) => {
        setContext: (ctx: unknown) => { draw: () => void };
      };
      StaveTie?: new (opts: { first_note?: Tickable; last_note?: Tickable }) => {
        setContext: (ctx: unknown) => { draw: () => void };
      };
    };
    const Rest = flowExtras.Rest ?? null;
    const BarNote = flowExtras.BarNote ?? null;

    const { measuresPerLine, renderW } = tierFor(containerWidth);
    const STAVE_W = renderW - 100;
    const FORMAT_W = STAVE_W - 150;

    // Create a wrapper div for SVG with click handling
    const svgWrapper = document.createElement('div');
    svgWrapper.style.width = '100%';
    svgWrapper.style.position = 'relative';
    container.appendChild(svgWrapper);

    const measures = groupNotesByMeasure(notes);
    const lines: NoteData[][][] = [];
    for (let i = 0; i < measures.length; i += measuresPerLine) {
      lines.push(measures.slice(i, i + measuresPerLine));
    }
    if (lines.length === 0) lines.push([]);

    const renderH = STAVE_Y0 + lines.length * LINE_HEIGHT + 30;
    const renderer = new Renderer(svgWrapper, Renderer.Backends.SVG);
    renderer.resize(renderW, renderH);
    const context = renderer.getContext();

    const svg = svgWrapper.querySelector('svg');
    if (svg) {
      svg.addEventListener('click', listeners.onClick);
      svg.addEventListener('mousemove', listeners.onMouseMove);
      svg.style.cursor = 'default';
      // Fluid scaling: the SVG fills its container at any tier instead of
      // rendering at a fixed pixel size (SPEC.md §3).
      svg.setAttribute('viewBox', `0 0 ${renderW} ${renderH}`);
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.display = 'block';
    }

    const vexKeySignature = convertKeySignatureToVexFlow(keySignature);

    // Helper: convert a single NoteData to a VexFlow tickable
    const makeVexNote = (note: NoteData, idx: number): TaggedTickable => {
      const { code: duration, dots } = convertDurationSpec(note.duration);

      const applyDots = (tickable: TaggedTickable): TaggedTickable => {
        if (dots > 0 && flowExtras.Dot) {
          try {
            flowExtras.Dot.buildAndAttach([tickable], { all: true });
          } catch (e) {
            console.warn('Dot failed:', e);
          }
        }
        return tickable;
      };

      if (note.pitch === 'rest') {
        console.log(`Rest ${idx}: duration=${note.duration} -> ${duration}`);
        if (Rest) {
          try {
            const rest = new Rest({ duration }) as TaggedTickable;
            rest.noteDataId = note.id;
            return applyDots(rest);
          } catch (e) {
            console.warn(`Failed to create Rest with Rest class, using fallback: ${e}`);
          }
        }
        const vexRest = new StaveNote({ keys: ['b/4'], duration }) as TaggedTickable;
        vexRest.noteDataId = note.id;
        return applyDots(vexRest);
      }

      const pitch = convertPitchToVexFlow(note.pitch);
      console.log(
        `Note ${idx}: pitch=${note.pitch} -> ${pitch}, duration=${note.duration} -> ${duration}`,
      );
      const vexNote = new StaveNote({ keys: [pitch], duration }) as TaggedTickable;
      vexNote.noteDataId = note.id;
      return applyDots(vexNote);
    };

    // One stave (system) per line of measures; BarNote between measures
    // within a line. noteTickables keeps global note order for hit-testing,
    // triplets and ties.
    const noteTickables: { data: NoteData; tickable: TaggedTickable; line: number }[] = [];
    let globalIdx = 0;
    lines.forEach((lineMeasures, lineIdx) => {
      const stave = new Stave(STAVE_X, STAVE_Y0 + lineIdx * LINE_HEIGHT, STAVE_W);
      stave.addClef('treble');
      if (lineIdx === 0) stave.addTimeSignature(timeSignature);
      if (vexKeySignature) stave.addKeySignature(vexKeySignature);
      stave.setContext(context).draw();

      const lineTickables: Tickable[] = [];
      lineMeasures.forEach((measureNotes, measureIdx) => {
        if (measureIdx > 0 && BarNote) {
          try {
            lineTickables.push(new BarNote());
          } catch (e) {
            console.warn('BarNote failed:', e);
          }
        }
        measureNotes.forEach((note) => {
          const tickable = makeVexNote(note, globalIdx++);
          lineTickables.push(tickable);
          noteTickables.push({ data: note, tickable, line: lineIdx });
        });
      });
      if (lineTickables.length === 0) return;

      const voice = new Voice();
      voice.setStrict(false);
      voice.addTickables(lineTickables);
      // Short last lines take proportionally less width instead of stretching
      const width = Math.max(200, (FORMAT_W * lineMeasures.length) / measuresPerLine);
      new Formatter().joinVoices([voice]).format([voice], width);
      voice.draw(context, stave);
    });

    const tripletGroups: Tickable[][] = [];
    let currentTriplet: Tickable[] = [];
    noteTickables.forEach(({ data, tickable }) => {
      if (data.tuplet === 'triplet') {
        currentTriplet.push(tickable);
        if (currentTriplet.length === 3) {
          tripletGroups.push(currentTriplet);
          currentTriplet = [];
        }
      } else {
        currentTriplet = [];
      }
    });

    if (flowExtras.Tuplet) {
      for (const group of tripletGroups) {
        try {
          new flowExtras.Tuplet(group).setContext(context).draw();
        } catch (e) {
          console.warn('Tuplet draw failed:', e);
        }
      }
    }

    if (flowExtras.StaveTie) {
      for (let i = 0; i < noteTickables.length - 1; i++) {
        const current = noteTickables[i];
        const next = noteTickables[i + 1];
        if (current.data.tieStart && next.data.tieEnd) {
          try {
            if (current.line === next.line) {
              new flowExtras.StaveTie({
                first_note: current.tickable,
                last_note: next.tickable,
              })
                .setContext(context)
                .draw();
            } else {
              // Tie across a line break: draw two hanging halves
              new flowExtras.StaveTie({ first_note: current.tickable })
                .setContext(context)
                .draw();
              new flowExtras.StaveTie({ last_note: next.tickable })
                .setContext(context)
                .draw();
            }
          } catch (e) {
            console.warn('StaveTie draw failed:', e);
          }
        }
      }
    }

    if (svg) injectHitZones(svg, noteTickables, STAVE_X, STAVE_W, STAVE_Y0);

    console.log('✅ Notation rendered successfully');
    return svg;
  } catch (error) {
    console.error('❌ Error rendering notation:', error);
    return null;
  }
}
