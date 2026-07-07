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
// vertically (readable on screen and paginatable in the PDF export)
const MEASURES_PER_LINE = 4;
const LINE_HEIGHT = 150;
const STAVE_X = 10;
const STAVE_Y0 = 40;
const STAVE_W = 1100;
const FORMAT_W = 950;

/** Draw the score into `container` (imperative VexFlow API, dynamic import
 * to avoid SSR issues). Returns the created SVG element, with the given
 * listeners attached, or null when rendering failed. */
export async function renderScore(
  container: HTMLDivElement,
  notes: NoteData[],
  timeSignature: string,
  keySignature: string,
  listeners: RenderListeners,
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

    // Create a wrapper div for SVG with click handling
    const svgWrapper = document.createElement('div');
    svgWrapper.style.width = '100%';
    svgWrapper.style.position = 'relative';
    container.appendChild(svgWrapper);

    const measures = groupNotesByMeasure(notes);
    const lines: NoteData[][][] = [];
    for (let i = 0; i < measures.length; i += MEASURES_PER_LINE) {
      lines.push(measures.slice(i, i + MEASURES_PER_LINE));
    }
    if (lines.length === 0) lines.push([]);

    const renderer = new Renderer(svgWrapper, Renderer.Backends.SVG);
    renderer.resize(1200, STAVE_Y0 + lines.length * LINE_HEIGHT + 30);
    const context = renderer.getContext();

    const svg = svgWrapper.querySelector('svg');
    if (svg) {
      svg.addEventListener('click', listeners.onClick);
      svg.addEventListener('mousemove', listeners.onMouseMove);
      svg.style.cursor = 'default';
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
      const width = Math.max(200, (FORMAT_W * lineMeasures.length) / MEASURES_PER_LINE);
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

    console.log('✅ Notation rendered successfully');
    return svg;
  } catch (error) {
    console.error('❌ Error rendering notation:', error);
    return null;
  }
}
