import { NoteData } from '../types';
import {
  convertDurationToVexFlow,
  convertKeySignatureToVexFlow,
  convertPitchToVexFlow,
  groupNotesByMeasure,
} from './vexflowConverter';

export interface RenderListeners {
  onClick: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
}

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

    // Rest and BarNote classes may not be available in all VexFlow versions
    const flowExtras = Vex.Flow as unknown as {
      Rest?: new (opts: { duration: string }) => Tickable;
      BarNote?: new () => Tickable;
    };
    const Rest = flowExtras.Rest ?? null;
    const BarNote = flowExtras.BarNote ?? null;

    // Create a wrapper div for SVG with click handling
    const svgWrapper = document.createElement('div');
    svgWrapper.style.width = '100%';
    svgWrapper.style.position = 'relative';
    container.appendChild(svgWrapper);

    const renderer = new Renderer(svgWrapper, Renderer.Backends.SVG);
    renderer.resize(1200, 250);
    const context = renderer.getContext();

    const svg = svgWrapper.querySelector('svg');
    if (svg) {
      svg.addEventListener('click', listeners.onClick);
      svg.addEventListener('mousemove', listeners.onMouseMove);
      svg.style.cursor = 'default';
    }

    const stave = new Stave(10, 40, 1100);
    stave.addClef('treble');
    stave.addTimeSignature(timeSignature);

    const vexKeySignature = convertKeySignatureToVexFlow(keySignature);
    if (vexKeySignature) {
      stave.addKeySignature(vexKeySignature);
    }

    stave.setContext(context).draw();

    // Helper: convert a single NoteData to a VexFlow tickable
    const makeVexNote = (note: NoteData, idx: number): TaggedTickable => {
      const duration = convertDurationToVexFlow(note.duration);

      if (note.pitch === 'rest') {
        console.log(`Rest ${idx}: duration=${note.duration} -> ${duration}`);
        if (Rest) {
          try {
            const rest = new Rest({ duration }) as TaggedTickable;
            rest.noteDataId = note.id;
            return rest;
          } catch (e) {
            console.warn(`Failed to create Rest with Rest class, using fallback: ${e}`);
          }
        }
        const vexRest = new StaveNote({ keys: ['b/4'], duration }) as TaggedTickable;
        vexRest.noteDataId = note.id;
        return vexRest;
      }

      const pitch = convertPitchToVexFlow(note.pitch);
      console.log(
        `Note ${idx}: pitch=${note.pitch} -> ${pitch}, duration=${note.duration} -> ${duration}`,
      );
      const vexNote = new StaveNote({ keys: [pitch], duration }) as TaggedTickable;
      vexNote.noteDataId = note.id;
      return vexNote;
    };

    // Group notes by measure, insert BarNote between measure groups
    const allTickables: Tickable[] = [];
    let globalIdx = 0;
    groupNotesByMeasure(notes).forEach((measureNotes, measureIdx) => {
      if (measureIdx > 0 && BarNote) {
        try {
          allTickables.push(new BarNote());
        } catch (e) {
          console.warn('BarNote failed:', e);
        }
      }
      measureNotes.forEach((note) => {
        allTickables.push(makeVexNote(note, globalIdx++));
      });
    });

    // Create voice WITHOUT strict beat requirement
    const voice = new Voice();
    voice.setStrict(false);
    voice.addTickables(allTickables);

    const formatter = new Formatter();
    formatter.joinVoices([voice]).format([voice], 900);
    voice.draw(context, stave);

    console.log('✅ Notation rendered successfully');
    return svg;
  } catch (error) {
    console.error('❌ Error rendering notation:', error);
    return null;
  }
}
