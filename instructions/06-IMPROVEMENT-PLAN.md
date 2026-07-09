# MelodyScribe — Improvement Plan (U1–U28)

**Status:** proposed. Authored 2026-07-05.
**Scope:** improves the existing Mac Electron MVP (Track A is complete). Does NOT replace Tracks B/C from `04-ROADMAP.md` — it hardens the shared backend and desktop app they both depend on.
**Executor:** each task below is a self-contained prompt for a smaller model (Sonnet-class) with the repo loaded. Same rules as `05-SONNET-PROMPTS.md`:

1. Execute in order within a phase; phases U-A → U-B → U-C → U-D (see dependency notes for the few exceptions)
2. One prompt = one task = one commit (`feat(...)`, `fix(...)`, `refactor(...)`, `test(...)`, `chore(...)`)
3. Read the affected files BEFORE writing changes
4. Run the verification check under each task before moving on
5. PR titles and descriptions in **English**

**System prompt to pass to the executor model once per session:**

```
You are a Senior Full-Stack Developer on the MelodyScribe project.
Stack: Python 3.11 + FastAPI + librosa + music21 (backend); React 18 + TypeScript strict + VexFlow + Tone.js + Zustand + TailwindCSS (frontend); Electron (desktop).
Rules: type hints (Python), strict TS with no `any`, functional React components, max ~200 lines/file.
Read the current code in files affected by the task BEFORE writing changes.
One prompt = one commit. Do not mix tasks. Run the verification listed in the task.
Reply with code and a short summary only.
```

---

## 0. Assessment — why these tasks

Audit of the codebase (2026-07-05) found:

**Engineering debt (blocks safe iteration):**
- **Zero tests.** `backend/tests/` does not exist, frontend has no test files — despite `01-ARCHITECTURE.md` §15 requiring pytest + Vitest. Every algorithm change is currently verified by ear.
- **No CI, no linters.** No `.github/`, no ESLint/Prettier, no ruff/mypy. `any` is used in at least 3 frontend files despite the "no any" rule.
- **Dead code:** `backend/src/` (entire legacy module tree), `backend/app/services/llm_service.py` (271 lines, imported by nothing — `verify.py` uses `TheoryChecker`), `aubio` in `requirements.txt` (never imported), `LLMPanel/` folder name and `llmCorrected` field survive from the removed Ollama design.
- **Oversized files:** `NotationDisplay.tsx` is 391 lines (limit: 200).

**Transcription quality (the product's core value):**
- Tempo detection is a bare `librosa.beat.beat_track` call (`tempo_detector.py`) — known to report 42 BPM on a ~120 BPM melody (`04-ROADMAP.md` §3). Beat tracking is the wrong tool for sparse monophonic input; inter-onset intervals are the signal.
- Onset detection uses librosa defaults — no adaptive threshold, no double-trigger merging.
- Quantizer has no triplet support and no ties across barlines.
- No octave-jump smoothing on the pitch trajectory (manual ±octave shift exists, but the detector still produces jumps).
- Noise gate / bandpass per instrument (architecture doc §11) was never implemented.

**Real-recording audit (2026-07-05).** Two recordings of the same piece — *¡Qué lindo atardecer!* (habanera, G major, one sharp), played from the printed score on piano and on violin — were run through `SegmentationService.transcribe()` (`tests/Que Lindo Atardecee Piano.m4a`, `tests/Que Lindo Atardecee Violin.m4a`). Findings:
- **Key detection is wrong on both** (reported "B major" for a G-major piece). Root cause found in `backend/app/core/key_detector.py`: it uses `np.correlate(mode='full')` against the Krumhansl profiles — a linear cross-correlation, not the required comparison of the chroma vector against **12 circular rotations** of each profile, so the detected root is offset. → U30
- **Pitch contour is largely correct and consistent across both instruments** (B-B-B-B-G-E… phrase shapes match the score) — the pyin core is sound.
- **Repeated-note splitting:** single held/repeated notes come out as e.g. `B4:quarter + B4:sixteenth + B4:eighth` — false onset double-triggers. → U11
- **Low-confidence phantom notes survive** (e.g. `B4:quarter.(0.10)`, `D4:quarter(0.34)`) — no confidence-based note filtering after segmentation. → U11
- **Octave error in context:** violin take contains `B3` surrounded by `B4`s — exactly the U12 case.
- **Note-count instability:** 35 notes (piano) vs 50 (violin) for the same melody — rhythm segmentation varies heavily with instrument timbre. The benchmark (U10) must include these files. → U29
- Tempo came out consistent (129 vs 126 BPM) — plausible for this piece; verify against a metronome take.

**UX / design:**
- UI is functional but generic (default Tailwind grays, single vertical column). No visual identity for a music tool.
- English-only UI — the primary user is a Ukrainian-speaking music teacher.
- Editing is mouse-only; no keyboard note entry, no drag-to-change-pitch.
- Recent-projects list is display-only (can't click to open).
- No autosave — a crash loses the session.
- No native Electron menu (File/Edit), no `.melody` file association.

Each finding maps to a task below. Priorities: **P0** = do first, high value/risk-reduction; **P1** = high value; **P2** = nice to have.

---

# Phase U-A — Engineering foundation

> Goal: make the codebase safe for a smaller model to modify. Everything later relies on these tests and checks.

### U1 (P0): Remove dead code

```
Task: delete unused legacy code left over from the pre-Phase-0 design.

Changes:
- Delete backend/src/ entirely (legacy module tree: audio_input, pitch_detect, note_segment, llm_verifier, pdf_generator; superseded by backend/app/)
- Delete backend/app/services/llm_service.py (unused — verify.py uses TheoryChecker; grep to confirm nothing imports it before deleting)
- Remove aubio==0.4.9 from backend/requirements.txt (grep backend/ for "aubio" to confirm it is never imported)
- Rename frontend/src/components/LLMPanel/ → TheoryPanel/ and update imports
- Rename the llmCorrected field to theoryCorrected in: frontend/src/types/note.ts, backend/app/models/note.py, and every usage (grep -rn "llmCorrected" and "llm_corrected"). Keep the MusicXML/.melody import path backward-compatible: when loading a project JSON, accept the old key as an alias.
- Update 01-ARCHITECTURE.md §4.2 and §14: remove aubio row/line (onset detection is librosa-only in reality)

Verify:
- grep -rn "llm\|aubio" backend/app frontend/src --include="*.py" --include="*.ts*" -i returns only intentional matches (none, or the backward-compat alias)
- Backend starts: uvicorn app.main:app; GET /api/health returns success
- Frontend builds: cd frontend && npm run build
```

### U2 (P0): Backend test infrastructure + synthesized audio fixtures

```
Task: set up pytest with programmatically synthesized WAV fixtures so transcription accuracy becomes measurable.

Changes:
- Add to backend/requirements-dev.txt (new file): pytest, pytest-cov, soundfile
- Create backend/tests/__init__.py, backend/tests/conftest.py
- In conftest.py, add a fixture factory `synth_melody(notes: list[tuple[str, float]], bpm: int, sr: int = 44100) -> Path`:
    - notes = [("C4", 1.0), ("E4", 0.5), ...] — (pitch, duration_in_beats)
    - Synthesize each note as a sine wave at librosa.note_to_hz(pitch) with a 10ms fade-in/out envelope and 60ms of silence between notes (simulates detached playing so onsets are detectable)
    - Write to a tmp_path WAV via soundfile
- First tests, backend/tests/test_quantizer.py:
    - quantize a clean sequence of quarter notes at 120 BPM → all durations "quarter"
    - dotted rhythm (1.5 + 0.5 beats) survives quantization
    - measure sums respect 4/4 and 3/4
- backend/tests/test_tempo_detector.py:
    - synth "C4,D4,E4,F4" quarters at 120 BPM → detected tempo in [110, 130] — mark this test xfail(strict=False) with reason "beat_track unreliable on monophonic input; fixed in U9"

Verify:
- cd backend && source .venv/bin/activate && pip install -r requirements-dev.txt && python -m pytest tests/ -v → passes (xfail allowed)
```

### U3 (P0): End-to-end transcription accuracy tests

```
Task: pin current transcription behavior with accuracy tests over synthesized melodies, so U9–U14 changes prove themselves.

Changes:
- backend/tests/test_transcription_accuracy.py using the synth_melody fixture from U2:
    - Helper `pitch_accuracy(expected, actual) -> float` (fraction of expected notes whose pitch appears at the right ordinal position; ignore octave errors in a second, looser metric)
    - Test: "Do-Mi-Re-Do" quarters at 120 BPM, instrument=piano, bpm hint supplied → pitch accuracy == 1.0, note count == 4
    - Test: same melody, no bpm hint → pitch accuracy == 1.0 (tempo may be wrong — do not assert tempo here)
    - Test: violin-range melody (A4–E5) with instrument=violin → all pitches within violin range
    - Test: melody with a 1-beat gap between notes → a rest is produced
- Call SegmentationService.transcribe() directly (no HTTP) for speed.
- If any test fails against current behavior, mark it xfail with a reason referencing the U-task that should fix it — do NOT change algorithm code in this task.

Verify:
- python -m pytest tests/ -v → green (xfails documented)
```

### U4 (P0): Frontend test infrastructure

```
Task: set up Vitest + React Testing Library; first tests for the Zustand store.

Changes:
- Add devDependencies: vitest, @testing-library/react, @testing-library/user-event, jsdom, @vitest/coverage-v8
- vite.config.ts: add test config (environment: 'jsdom', globals: true)
- package.json scripts: "test": "vitest run", "test:watch": "vitest"
- frontend/src/store/projectStore.test.ts:
    - updateNote pushes history; undo restores previous notes; redo reapplies
    - history is capped at MAX_HISTORY (50)
    - shiftAllOctaves: C4→C5 on +1; rests untouched; octave clamped to [1,8]
    - deleteNote clears selectedNoteId when the selected note is deleted
    - loadFromProject resets past/future/corrections
- frontend/src/store/recentProjectsStore.test.ts: add + dedupe + cap behavior (read the store first to learn its API)

Verify:
- cd frontend && npm run test → all green
```

### U5 (P1): Linters and formatters

```
Task: add ruff + mypy (backend) and ESLint + Prettier (frontend), fix or explicitly ignore all findings.

Backend:
- Add ruff and mypy to requirements-dev.txt; create backend/pyproject.toml with [tool.ruff] (line-length 100, target py311, rules: E,F,I,UP) and [tool.mypy] (python_version 3.11, ignore_missing_imports true — librosa/music21 lack stubs)
- Fix all ruff findings; get mypy clean on backend/app (add annotations where missing; `# type: ignore[...]` only with a comment why)

Frontend:
- eslint + typescript-eslint + eslint-plugin-react-hooks + prettier, flat config (eslint.config.js)
- Rules: no-explicit-any = error, react-hooks/rules-of-hooks = error, react-hooks/exhaustive-deps = warn
- package.json scripts: "lint": "eslint src", "format": "prettier --write src"
- Remove every `any` (currently in apiClient.ts, NotationDisplay.tsx, SuggestionsPanel.tsx at least) by adding proper types

Verify:
- cd backend && ruff check app && mypy app → clean
- cd frontend && npm run lint && npm run build → clean
```

### U6 (P1): CI pipeline

```
Task: GitHub Actions workflow running lint + tests on every PR and push to main.

Changes:
- .github/workflows/ci.yml with two jobs:
    backend: ubuntu-latest, python 3.11, cache pip, install requirements.txt + requirements-dev.txt + libsndfile1 (apt) for soundfile, run: ruff check app, mypy app, pytest tests/ -v
    frontend: ubuntu-latest, node 20, cache npm, run: npm ci, npm run lint, npm run test, npm run build
- Badge in README.md

Verify:
- Push a branch, open a draft PR, both jobs green
```

### U7 (P1): Refactor NotationDisplay.tsx (391 lines → modules)

```
Task: split NotationDisplay.tsx to respect the 200-line rule and isolate VexFlow conversion logic for future testing. Pure refactor — zero behavior change.

Read frontend/src/components/NotationEditor/NotationDisplay.tsx first, then extract:
- frontend/src/utils/vexflowConverter.ts — pure functions mapping NoteData[] → VexFlow-ready structures (key conversion, duration mapping, measure grouping, confidence→color). No React imports.
- frontend/src/hooks/useNotationRenderer.ts — the imperative VexFlow render effect (stave creation, formatting, draw, click hit-testing registration)
- NotationDisplay.tsx keeps: props, container ref, selection/playing-note wiring — under 150 lines
- Add frontend/src/utils/vexflowConverter.test.ts: duration mapping (incl. dotted), measure grouping for 4/4 and 3/4, confidence color thresholds

Verify:
- npm run test && npm run build
- Manual: transcribe or load a project — notation renders identically, click-to-select still works, playback highlighting still works
```

### U8 (P2): API contract consistency

```
Task: one response envelope + one error shape across all endpoints; typed apiClient.

Changes:
- backend/app/models/api.py (new): `ApiResponse` generic pydantic model {success: bool, data: T | None, error: {code: str, message: str} | None}
- Refactor routes (audio.py, transcribe.py, verify.py, export.py) to return it; register exception handlers in main.py mapping FfmpegMissingError→422, ValueError→400, Exception→500, all in the same envelope
- frontend/src/services/apiClient.ts: single `request<T>()` helper that unwraps the envelope and throws a typed ApiError{code, message}; remove per-method duplication
- Update Toast/error handling call sites if the thrown shape changes

Verify:
- Backend tests still pass; add backend/tests/test_api_contract.py hitting /api/health and a failing /api/transcribe (bad file id) via fastapi TestClient, asserting the envelope shape
- Manual smoke: upload → transcribe → export still works from the UI
```

---

# Phase U-B — Transcription quality

> Goal: the melody the wife plays at 120 BPM comes out as one measure of quarters, not three measures of mush. U2/U3 tests are the safety net; every task here must improve or preserve the accuracy metrics.
> Execution order in this phase: **U29 → U9 → U30 → U10 → U11 → U12 → U13 → U14** (U29/U30 were added after the real-recording audit; numbers are labels, the order here is authoritative).

### U29 (P0): Real-audio regression fixtures — ¡Qué lindo atardecer!

```
Task: turn the two real recordings of the same piece into permanent regression fixtures with ground truth, so algorithm changes are measured on real audio, not only synthesized sines.

Source files (already on disk, untracked):
- tests/Que Lindo Atardecee Piano.m4a   (~130 KB)
- tests/Que Lindo Atardecee Violin.m4a  (~152 KB)

Changes:
- Create backend/tests/fixtures/real/ and move both files there as que_lindo_piano.m4a / que_lindo_violin.m4a (git mv from tests/ if tracked, plain move otherwise; commit the binaries — they are small)
- backend/tests/fixtures/real/que_lindo.yml — ground truth metadata:
    piece: "¡Qué lindo atardecer!" (Ricardo Lafuente, arr. Manuel M. Guirao)
    key: "G major"          # one sharp in the printed score
    final_note: "G"          # phrase ends on the tonic
    # Consensus pitch contour of the opening phrase, confirmed by BOTH independent
    # recordings against the printed part (lyrics: "¡Que lin-do a-tar-de-cer…"):
    opening_pitches: [D4, B4, B4, B4, B4, G4, E4]
    # NOTE: full note-by-note ground truth (durations, complete pitch list) must be
    # entered by a musician reading the printed score before strict assertions are
    # added; until then only contour-level assertions below are used.
- backend/tests/test_real_recordings.py (skipif ffmpeg is not on PATH — shutil.which("ffmpeg")):
    For each recording:
    - transcription succeeds; note count within [25, 60]
    - opening pitch contour: the sequence of the first notes with confidence >= 0.6,
      after merging consecutive same-pitch notes, starts with opening_pitches (octave-exact)
    - detected tempo within ±15% between the two recordings (cross-consistency, no absolute claim)
    - key assertion: EXPECT "G major"; while U30 is not merged, mark this single assert
      xfail(strict=True, reason="KeyDetector rotation bug, fixed in U30") so it flips to
      a hard failure-to-remove reminder once U30 lands
    Cross-instrument check: merged pitch sequences of piano vs violin agree on >= 70%
    of aligned positions (simple longest-common-subsequence ratio)
- .github/workflows/ci.yml (from U6): add ffmpeg to the backend job's apt packages so m4a decoding works in CI

Verify:
- cd backend && python -m pytest tests/test_real_recordings.py -v → green (key assert xfail)
- CI run green with the new fixtures committed
```

### U9 (P0): Tempo estimation v2 — inter-onset intervals

```
Task: replace bare librosa.beat.beat_track with an IOI-based estimator suited to sparse monophonic melodies. Fixes the known 42-vs-120 BPM failure (04-ROADMAP.md §3).

Changes in backend/app/core/tempo_detector.py:
- detect(audio, sr, onsets: list[float] | None = None) -> int
- Algorithm:
    1. If onsets (seconds) are provided and len(onsets) >= 4: compute inter-onset intervals; take the median IOI as the base pulse candidate
    2. Cluster IOIs: round each IOI to the nearest simple ratio (0.5x, 1x, 1.5x, 2x) of the median to absorb eighths/dotted values; the pulse = weighted mode
    3. BPM = 60 / pulse; fold into [70, 180] by doubling/halving (musical prior: teacher demos live in this range)
    4. Fallback: if onsets absent or < 4, keep librosa.beat.beat_track, then apply the same [70, 180] folding
- backend/app/services/segmentation_service.py: pass the already-computed onset list into tempo detection (read the current flow first — onsets are detected there)

Verify:
- Remove the xfail from test_tempo_detector.py (U2); add cases: quarters at 90, 120, 150 BPM → within ±8%; eighth-note melody at 120 BPM → 120 not 240
- python -m pytest tests/ -v → green, accuracy tests from U3 unchanged or better
- Manual: transcribe tests/ДоМіРеДо-2ї.m4a (if present locally) without a BPM hint → notes land in ~1 measure, not 3
```

### U30 (P0): Key detection fix — circular profile rotation + note-based fallback

```
Task: fix the wrong-root bug in KeyDetector (confirmed on real recordings: G-major piece reported as "B major") and make key detection use the transcribed notes, not only raw chroma.

Root cause (backend/app/core/key_detector.py): np.correlate(chroma_avg, profile, mode='full')
is a linear cross-correlation; Krumhansl–Schmuckler requires scoring the chroma vector against
each of the 12 CIRCULAR rotations of the major/minor profiles and picking the best (root, mode).

Changes in backend/app/core/key_detector.py:
- Rewrite detect():
    for root in range(12):
        score_major[root] = pearson_r(chroma_avg, np.roll(major_profile, root))
        score_minor[root] = pearson_r(chroma_avg, np.roll(minor_profile, root))
    best (root, mode) by score; np.corrcoef for pearson_r
- Add detect_from_notes(pitches: list[str]) -> str: build a weighted pitch-class histogram
  from the segmented notes (weight = note duration in beats), score the same way; this is
  more robust than raw chroma (ignores overtones/room noise)
- backend/app/services/segmentation_service.py: after segmentation, call detect_from_notes()
  on the final note list; fall back to the chroma path only if there are < 8 notes.
  Tie-break relative major/minor (same sharps/flats) toward the FINAL note of the melody
  if it equals either candidate tonic.

Verify:
- backend/tests/test_key_detector.py (new): synthesized C-major scale → "C major";
  A-minor (harmonic) scale → "A minor"; G-major melody ending on G → "G major";
  transposed copies of the same melody map to transposed keys (parametrize over 3 roots)
- Remove the xfail from test_real_recordings.py (U29) — both recordings now → "G major"
- python -m pytest tests/ -v → green
```

### U10 (P1): Accuracy benchmark report

```
Task: a benchmark script producing an accuracy table over a suite of synthesized melodies — the yardstick for U11–U14.

Changes:
- backend/tests/benchmark_accuracy.py (runnable module, not collected by pytest): 8–10 synthesized cases across instruments/BPMs/rhythms (quarters, eighths, dotted, with rests, wide leaps) PLUS the two real recordings from U29 (fixtures/real/)
- For each synthesized case print: pitch accuracy, octave-tolerant pitch accuracy, note-count delta, detected vs true BPM
- For the real recordings print: detected key vs "G major", note count, tempo, and the piano↔violin cross-agreement ratio from U29
- Markdown table output; document the command in README.md (Development section)

Verify:
- cd backend && python -m tests.benchmark_accuracy → table prints; commit current numbers in the module docstring as a baseline
```

### U11 (P1): Onset detection v2

```
Task: harden onset detection: adaptive threshold, double-trigger merging, instrument-aware minimum gap.

Changes in backend/app/core/onset_detector.py:
- Use librosa.onset.onset_detect with backtrack=True and an explicit onset envelope (librosa.onset.onset_strength with detrend); expose delta (threshold) as a parameter
- Merge onsets closer than min_gap_ms (default 80; per-instrument override: piano 60, guitar 60, violin 100 — legato bowing false-triggers)
- Drop onsets whose local RMS is below noise_floor_db (default -40 dBFS) relative to peak — kills breath/room noise
- Keep the public detect(audio, sr) signature; add optional keyword args with defaults so callers don't break
- In segmentation_service.py, after note assembly: (a) merge consecutive notes with identical pitch when the gap between them is < 40ms (real-recording audit: held notes split into quarter+sixteenth+eighth chains); (b) drop notes whose confidence < 0.3 — convert to a rest if the hole is >= 1 beat (audit found phantom notes at confidence 0.10)

Verify:
- backend/tests/test_onset_detector.py (new): synth melody with 60ms inter-note silence → exactly N onsets; melody with -45 dB noise segment → no extra onsets; two notes 30ms apart merge into one
- pytest green; benchmark (U10) note-count deltas not worse
```

### U12 (P1): Pitch trajectory post-processing — octave-jump smoothing

```
Task: remove spurious octave jumps from the pitch track before segmentation (pyin octave errors are the #1 reason the manual ±octave button exists).

Changes:
- backend/app/core/pitch_detector.py (read first — post-processing octave correction partially exists): add a median-filter pass over the per-frame MIDI-number track (window ~5 frames), then: any single note whose median pitch is ~±12 semitones from BOTH neighbors while |neighbor_a - neighbor_b| <= 4 semitones → fold it an octave toward them
- Apply after per-note pitch assignment in segmentation_service.py, not on raw frames only
- Confidence of folded notes *= 0.7 (so the heatmap flags them for review)

Verify:
- backend/tests/test_pitch_postprocess.py: sequence C4 E4 [E5 spike] G4 → spike folded to E4-ish octave, confidence reduced; a genuine octave passage (C4 C5 C4 C5) is NOT folded
- pytest green; U3 accuracy not worse; benchmark octave-tolerant vs strict accuracy gap narrows
```

### U13 (P2): Quantizer v2 — triplets and ties

```
Task: extend the quantizer with triplet detection and tie-over-barline instead of duration truncation.

Changes in backend/app/core/quantizer.py (+ models if needed):
- Triplets: when three consecutive IOIs each ≈ 1/3 beat (±15%), snap them to a triplet group; NoteData gets optional field `tuplet: "triplet" | None` (add to backend/app/models/note.py and frontend/src/types/note.ts)
- Ties: a note crossing a barline splits into two NoteData entries with `tieStart: true` / `tieEnd: true` instead of being truncated to fit the measure
- frontend/src/utils/vexflowConverter.ts (from U7): render VexFlow Tuplet for triplet groups and StaveTie for tied pairs
- MusicXML export (backend/app/api/routes/export.py / music21 build): map tuplet and tie fields

Verify:
- backend/tests/test_quantizer.py: triplet trio at 120 BPM → three notes marked triplet summing to 1 beat; a half note starting on beat 4 of 4/4 → two tied quarters across the barline
- Frontend: npm run test (converter tests updated); manual render check of a triplet + tie project
- MusicXML opens in MuseScore with correct triplet/tie (manual check)
```

### U14 (P2): Per-instrument noise gate + bandpass

```
Task: implement the pre-filtering promised in 01-ARCHITECTURE.md §11 — bandpass to the instrument range + noise gate before pitch/onset detection.

Changes:
- backend/app/core/audio_preprocess.py (new): `preprocess(audio, sr, instrument) -> np.ndarray`
    - Butterworth bandpass (scipy.signal, order 4) to the instrument's frequency range from INSTRUMENT_RANGES, widened by half an octave both sides
    - Noise gate: frames with RMS < (noise floor estimated from the quietest 10% of frames + 6 dB) → zeroed
    - librosa.effects.trim at the end
- scipy is already a librosa dependency — import directly, add scipy to requirements.txt explicitly
- segmentation_service.py: run preprocess() once, feed the result to pitch + onset + RMS/velocity paths

Verify:
- backend/tests/test_audio_preprocess.py: melody + added white noise at -30 dB → same note count as clean melody after preprocessing; a 50 Hz hum under a violin recording is attenuated (compare band energy)
- pytest + benchmark: accuracy on clean fixtures unchanged, noisy fixture improves
```

---

# Phase U-C — UX & design overhaul

> Goal: from "developer-gray demo" to a warm, keyboard-friendly tool a music teacher enjoys daily. Design concept: **«цифровий нотний зошит»** — a digital manuscript notebook: warm paper tones, engraving-style typography for headings, generous whitespace around the score, and the score always the visual hero of the screen.

### U15 (P0): Design system — tokens and Tailwind theme

```
Task: define the visual language once, in Tailwind config, so all later UI tasks reuse tokens instead of ad-hoc grays.

Changes in frontend/tailwind.config.js + frontend/src/index.css:
- Palette (extend.colors):
    paper:   #FAF6EF (app background), paper-dark: #F3EDE2 (panels)
    ink:     #2B2A26 (primary text), ink-soft: #6B675E (secondary)
    accent:  #7C5CBF (primary actions — violet, replaces blue-600), accent-hover: #6A4BAD
    valid:   #4C8C6A, warn: #C98A2D, danger: #B4533F
    staff:   #3D3A33 (notation lines/glyphs on paper)
- Typography: headings 'Fraunces' (serif, bundled via @fontsource-variable/fraunces — offline, no Google CDN), body 'Inter' (@fontsource-variable/inter); wire into fontFamily.heading / fontFamily.sans
- Component classes in index.css via @layer components: .btn-primary, .btn-secondary, .btn-ghost, .card, .input-field — extracted from the styles currently repeated inline in App.tsx / FileUpload / NoteToolbar
- Replace bg-gray-50 body background with bg-paper; DO NOT restyle every component yet (that is U16) — only App.tsx header/footer/buttons as the reference implementation

Verify:
- npm run build; app renders with paper background, violet primary button, new fonts (offline — kill network and reload to confirm no CDN fetch)
- Screenshot before/after for the PR description
```

### U16 (P0): Editor layout restructure

```
Task: reorganize the post-transcription screen from a single vertical stack into a focused editor layout. Uses tokens from U15.

Target layout (single window, min 1100px wide):
- Top bar (sticky): app name, project title (inline-editable text input bound to metadata.title), Toolbar actions (save/open/export), undo/redo
- Main area: the score (NotationDisplay) on paper-dark card, max width ~900px centered, generous padding — the hero
- Below score: WaveformDisplay, collapsed to 96px tall, toggleable via a "Waveform" chip
- Bottom bar (sticky): PlaybackControls (transport left, BPM + metronome right)
- NoteToolbar: floating card that appears near/above the score when a note is selected (position: sticky under top bar is acceptable if floating is complex), hidden when nothing is selected
- Metadata (instrument/tempo/key/time) moves from the footer into the top bar as small chips; footer removed

Changes: App.tsx (split the editor screen into frontend/src/components/EditorScreen.tsx to respect the 200-line rule), adjust the touched components' outer classes only — no logic changes.

Verify:
- npm run build && npm run test; manual: transcribe → score centered, playback bar sticky at bottom, NoteToolbar appears on selection, undo/redo in the top bar works, window resize down to 1000px doesn't break layout
```

### U17 (P0): Ukrainian localization

```
Task: dictionary-based i18n with Ukrainian as the default UI language (primary user is a Ukrainian-speaking teacher), English as fallback. No i18n library — a tiny typed helper.

Changes:
- frontend/src/i18n/uk.ts and en.ts: flat typed dictionaries (satisfies Record<TranslationKey, string>); frontend/src/i18n/index.ts: useT() hook reading language from a new uiStore (zustand, persisted to localStorage, default 'uk')
- Extract EVERY user-facing string from: App.tsx, EditorScreen, FileUpload, InstrumentSelector, TranscribeOptions, NoteToolbar, PlaybackControls, ExportButton, Toolbar, Tour, Toast call sites, ErrorBoundary, SuggestionsPanel
- Musical terms in uk.ua: use Ukrainian conventions — Інструмент, Темп, Тональність, Розмір, Чвертна/Восьма/Шістнадцята, Пауза, Дієз/Бемоль, Скрипка/Фортепіано/Гітара
- Language switcher (UA/EN) in the top bar
- relativeTime() in App.tsx: use the active locale in Intl.RelativeTimeFormat
- Backend error messages stay English; frontend maps known error codes (from U8) to localized messages, falls back to raw message

Verify:
- npm run build && npm run test; manual: whole flow in Ukrainian by default; switch to EN persists after reload; no hardcoded English strings left on visible screens (grep the components for common words like "Transcribe", "Export")
```

### U18 (P1): Keyboard-first note editing

```
Task: full keyboard editing so corrections don't require the mouse. Builds on the selection model in projectStore.

Shortcuts (active when a note is selected and no input is focused):
- ← / → : select previous/next note (wraps at ends: stop, don't wrap)
- ↑ / ↓ : pitch ±1 semitone (reuse/extract the semitone logic from NoteToolbar — put shared pitch math in frontend/src/utils/noteUtils.ts)
- Shift+↑ / Shift+↓ : ±1 octave (single note)
- 1..5 : duration whole/half/quarter/eighth/sixteenth; . toggles dotted
- R : toggle note ↔ rest; Backspace/Delete : delete note; Enter : insert note after selection (copy of selected, quarter)
- Escape : deselect; Space : play/pause (guard against page scroll)
- ? : shortcut help overlay (modal, localized via U17)
Implementation: one useKeyboardEditing() hook in frontend/src/hooks/, registered in EditorScreen; all mutations go through existing store actions so undo/redo works for free.

Verify:
- npm run test: unit tests for the new noteUtils pitch math (semitone across octave boundary: B4+1→C5, Cb edge cases)
- Manual: select note → arrows navigate, pitch changes render immediately, undo reverts each step, shortcuts dead while typing in the BPM input
```

### U19 (P1): Autosave and session recovery

```
Task: never lose work — autosave the working session and offer recovery on launch.

Changes:
- frontend/src/services/autosave.ts: subscribe to projectStore; debounce 2s after any notes/metadata change; persist {notes, metadata, savedAt} to localStorage key melodyscribe.autosave (audio blob NOT persisted — too big; keep audioFileId)
- On app start, if autosave exists and is < 7 days old and the store is empty: show a toast/banner "Відновити останню сесію?" with Restore / Discard (localized)
- Restore: load notes+metadata into the store (playback disabled until audio re-uploaded — show a hint chip)
- Clear autosave on explicit Save Project and on Start New Transcription

Verify:
- npm run test: autosave module test with fake timers (debounce, age check)
- Manual: transcribe → edit → kill the app → relaunch → banner → Restore shows the edited notes
```

### U20 (P1): Clickable recent projects

```
Task: make the recent-projects list actually open projects (today it is display-only text).

Changes:
- frontend/electron/main.ts + preload.ts: IPC handler readFile(path) -> ArrayBuffer (guard: only .melody extension, return typed error if missing/unreadable); expose via contextBridge as window.electronAPI.readProjectFile
- frontend/src/store/recentProjectsStore.ts: store the absolute file path with each entry (Electron save/open dialogs — read services/projectFile.ts first to see where paths surface); keep max 5, dedupe by path
- App.tsx empty state: recent entries become buttons → read file via IPC → existing .melody load path (loadFromProject); file gone → toast "Файл не знайдено" + remove the entry
- Browser (non-Electron) fallback: entries stay non-clickable with the current hint text

Verify:
- Manual in electron:dev — save a project, Start New, click the recent entry → project reopens with audio and notes; delete the file on disk, click → friendly toast, entry removed
- npm run test: recentProjectsStore path dedupe/cap tests updated
```

### U21 (P2): Waveform interactivity

```
Task: click-to-seek and playhead on the waveform, synced with playback.

Changes in frontend/src/components/WaveformDisplay.tsx + frontend/src/hooks/usePlayback.ts (read both first):
- Draw a playhead line at the current transport position (share position via projectStore or a playback store — follow whatever usePlayback already exposes for the notation cursor)
- Click on waveform → seek transport to that time; if playing, continue from there; also select the note whose time range contains the click
- Hover: show mm:ss.ms tooltip

Verify:
- Manual: play → playhead moves in sync with the notation highlight; click mid-waveform → audio jumps, corresponding note selected
- npm run build clean
```

### U22 (P2): PDF export polish + dark mode

```
Task: professional print output and an optional dark editor theme.

PDF (read frontend/src/components/ExportButton.tsx PDF path first):
- Title block: title (from metadata.title), instrument + tempo + key + time signature line, date; Fraunces for the title
- Margins 15mm, A4; multi-line layout: wrap staves at page width, correct vertical spacing, page numbers when > 1 page
- PDF is always light (paper) regardless of app theme

Dark mode:
- Tailwind darkMode: 'class'; extend U15 tokens with dark variants (bg #1E1C19, panels #2A2723, ink→#E8E4DC; score stays on a light "paper" card — sheet music must remain black-on-light)
- Toggle in top bar, persisted in uiStore (U17); default follows system via prefers-color-scheme

Verify:
- Export a 20-measure melody → PDF has title block, no clipped staves, readable at print size (manual check in Preview.app)
- Manual: toggle dark mode — all screens legible, score card still light, persists on reload
```

### U23 (P2): First-run experience upgrade

```
Task: friendlier empty state: drag-and-drop anywhere + a built-in demo melody.

Changes:
- Full-window drag-and-drop: dragging an audio file anywhere over the empty state highlights a drop zone and routes into the existing FileUpload flow (read FileUpload.tsx first; extract shared upload logic if needed)
- "Спробувати демо" button: bundle a short public-domain WAV (frontend/src/assets/demo-do-mi-re-do.wav, ~5s, generate with the U2 synth if no recording available) → runs the normal upload+transcribe pipeline so the user sees real results in one click
- Update Tour.tsx copy to mention drag-and-drop and the demo (localized)

Verify:
- Manual: drag a .wav onto the window → uploads; click demo → notes appear within seconds; Tour reflects reality
- npm run build; bundle size increase < 1 MB
```

---

# Phase U-D — Desktop platform maturity

> Goal: behaves like a real Mac app, not a web page in a frame.

### U24 (P1): Native application menu + file associations

```
Task: real macOS menu bar and .melody file association.

Changes in frontend/electron/main.ts / preload.ts:
- Menu (localized labels can stay English at menu level for v1): File → Open Project… (⌘O), Save Project (⌘S), Export PDF (⌘E), Export MusicXML; Edit → Undo (⌘Z), Redo (⇧⌘Z), plus standard roles; View → Toggle Dark Mode; Help → Show Tour
- Menu items send IPC events; renderer listens (frontend/src/services/electronBridge.ts, new) and calls the same handlers the buttons use — no duplicated logic
- electron-builder config (package.json "build" key or electron-builder.yml): fileAssociations for .melody (name "MelodyScribe Project"); handle open-file event on macOS (app launched by double-clicking a .melody) → load via the U20 read path; also handle the event while the app is already running

Verify:
- electron:dev — ⌘Z/⇧⌘Z drive editor undo/redo; ⌘S opens save dialog
- Packaged build: double-click a .melody file in Finder → app opens with the project loaded
```

### U25 (P1): Backend lifecycle hardening

```
Task: make the Electron↔Python handshake robust: retries, port conflicts, visible startup state.

Changes:
- frontend/electron/main.ts (read the current PyInstaller spawn logic first):
    - Pick a free port at spawn (portfinder or manual net.createServer probe) instead of hardcoded 8000; pass to backend via env/argv; expose to renderer via preload (apiClient reads it instead of a hardcoded base URL, with 5173-dev fallback)
    - Poll /api/health with exponential backoff (250ms → 4s, max 30s); until healthy, renderer shows a "Запускаю аудіодвигун…" splash state (App-level, localized)
    - On backend crash (process exit): show a Toast with a Restart button that respawns and re-polls
    - Kill the child process reliably on app quit (before-quit handler)
- backend/run_server.py: accept --port argv

Verify:
- Manual: occupy port 8000 with another process → app still starts on another port and works
- Kill the python process while the app runs → toast appears, Restart recovers
- Quit the app → no orphan python process (ps aux | grep melodyscribe)
```

### U26 (P2): App identity — icon and DMG polish

```
Task: proper app icon and installer appearance.

Changes:
- Design an icon (SVG source in frontend/assets/icon.svg: a treble clef merged with a sound-wave, ink-on-paper palette from U15) → generate icon.icns (1024px master, iconutil) — commit both SVG and .icns plus the generation script frontend/scripts/make-icons.sh
- electron-builder: mac.icon, dmg settings (background, icon positions: app left, /Applications symlink right), productName "MelodyScribe", appId ua.melodyscribe.app
- Window: min size 1000×700, titleBarStyle hiddenInset with the top bar from U16 acting as the drag region (-webkit-app-region: drag on the bar, no-drag on its buttons)

Verify:
- ./build.sh → DMG shows the icon and drag-to-Applications layout; installed app has the icon in Dock; window drags by the top bar
```

### U27 (P2): Signing, notarization and update strategy (document + wire what's free)

```
Task: document the path to distribution beyond "wife's laptop" and wire what doesn't require a paid certificate.

Changes:
- instructions/07-DISTRIBUTION.md: steps for Apple Developer ID signing + notarization (electron-builder afterSign notarize hook, required env vars), cost note ($99/yr), and the unsigned fallback (right-click→Open / xattr -cr) documented for current users
- electron-builder: add hardenedRuntime: true, gatekeeperAssess: false, entitlements file (microphone access! com.apple.security.device.audio-input + NSMicrophoneUsageDescription in Info.plist extendInfo — recording already exists, packaged builds need this)
- Auto-update: document electron-updater + GitHub Releases as the chosen mechanism in 07-DISTRIBUTION.md; do NOT wire it until signing exists (unsigned updates fail on macOS)

Verify:
- ./build.sh still succeeds; packaged app prompts for microphone permission and recording works in the packaged build
```

### U28 (P2): Dependency currency audit

```
Task: a measured upgrade pass — currency without churn.

Changes:
- Backend: bump patch/minor versions in requirements.txt (librosa 0.10.x latest, fastapi/uvicorn/pydantic minors); run pytest + benchmark after each bump; pin exact versions
- Frontend: npm outdated → upgrade patch/minor only (React stays 18, VexFlow stays 4.x — v5 changes the API, out of scope; Electron: bump to the latest minor of the current major only, note the latest major + its breaking changes in the PR description)
- npm audit / pip-audit: fix criticals if any
- Record decisions (kept-back majors and why) in the PR description

Verify:
- Full suite: backend pytest + benchmark numbers unchanged, frontend npm run lint && test && build, manual smoke: upload → transcribe → edit → play → export PDF → save/open .melody
```

---

# Phase U-E — Metric accuracy (meter, tempo level, anacrusis)

> Goal: the score's barlines match the printed original. Found on the real
> Que-Lindo comparison (2026-07): engine wrote 4/4 @ 133 BPM with the pickup on
> a downbeat and ~4 invented cross-barline ties, while the printed part is
> 2/4 @ ~66 with an eighth-note D4 anacrusis. Root causes in code: the frontend
> always sends 4/4 (no meter detection exists), BPM_MIN=70 makes the true
> quarter-note pulse unreachable (so the eighth level wins), and
> start_beat = onset·bpm/60 counts from audio t=0 (first onset ≡ bar 1 beat 1,
> so an anacrusis is unrepresentable). Wrong grid then cascades: quantizer
> splits/ties notes at wrong barlines and _fill_measures inflates durations.

### U31 (P0): Joint meter + tempo-level + phase detection

```
Task: detect (time signature, BPM metrical level, grid phase) jointly from accent
features instead of trusting the 4/4 default, and apply the result to the grid.

Changes:
- backend/app/core/meter_detector.py (new): search meter ∈ {2/4, 3/4, 4/4, 6/8} ×
  tempo level ∈ {bpm, bpm/2} × phase ∈ sixteenth-grid offsets within one bar;
  score each hypothesis with accent features computed from data the pipeline
  already has:
    1. agogic (long IOI on strong beats), 2. dynamic (RMS/velocity on strong
    beats), 3. phrase-final note on a downbeat, 4. bar-length parallelism
    (autocorrelation of the onset pattern), 5. tonal accent (stable degrees of
    the detected key on downbeats), 6. anti-syncopation penalty (hypotheses
    that force many cross-barline ties lose). Weights are FITTED, not guessed —
    see the harness below.
- Weight-fitting harness: tests/meter_cases.py generates labeled cases with the
  U2 synth (same melodies rendered in 2/4, 3/4, 4/4, with and without pickup,
  several tempi) — meter/phase known by construction; a small grid search picks
  the weights, which are committed as constants with the fitting script.
- Integration (backend/app/services/segmentation_service.py + API): the
  transcribe request's timeSignature becomes optional; when absent, use the
  detector and return the detected value + confidence. Phase is applied by
  offsetting start_beat so the first FULL bar starts at the detected downbeat;
  the anacrusis portion renders as leading rests within bar 1 (exactly how the
  printed part engraves it) — the implicit-pickup-bar notation is U32.
- tempo_detector.py: keep BPM_MIN=70 for the base pass, but the joint search
  may halve the result (half level reaches 50-89 effectively).
- Frontend: TranscribeOptions time signature default becomes "авто" (sends
  nothing); the editor metadata chip shows «2/4 (авто)» when detected.

Verify:
- Synthetic harness: meter+phase accuracy ≥ 90% across generated cases (CI)
- Real: both que_lindo recordings detect 2/4 (non-strict on CI if pyin differs
  on Linux, following the U29 xfail pattern); cross-barline tie count drops to
  ~0 on que_lindo; benchmark_accuracy.py numbers for U-B metrics unchanged
```

### U31b (P2, experiment): Learned downbeat model as an optional signal

```
Task: benchmark madmom DBNDownBeatTracking / beat_this on our fixtures vs U31.

Changes: experiment script only (backend/tests/experiment_downbeat.py, not in
CI); if the learned model beats the deterministic search on real recordings,
wire it as an extra scoring feature with a clean fallback when unavailable.
Document the verdict (accuracy, install pain, model size) in the PR.

Verify: script runs locally and prints a comparison table; no app dependency
is added unless the verdict says so.
```

### U32 (P1): True pickup-measure notation

```
Task: engrave the anacrusis as an implicit (incomplete) first measure instead
of leading rests.

Changes: quantizer emits measure 0 with only the pickup note(s); VexFlow
renderer draws the short first measure (voice is already non-strict); MusicXML
export marks it <measure implicit="yes">; playback cursor and measure numbers
account for the offset.

Verify: que_lindo renders pickup D4 eighth alone before bar 1, like the print;
MusicXML round-trips through import preserving the pickup
```

### U33 (P1): Full note-by-note Que-Lindo ground truth

```
Task: complete tests/fixtures/real/que_lindo.yml — the file itself says full
ground truth "must be entered by a musician"; enter it from the printed score.

Changes: full pitch+duration+measure sequence for the ~16-bar vocal part
(2/4, pickup D4, G major) entered from the printed part; strict per-note
assertions replace the contour-level ones for local runs (CI keeps the
non-strict tier per U29); benchmark_accuracy.py adds bar-alignment score,
cross-barline-tie delta and meter accuracy as reported metrics.

Verify: benchmark prints the new metrics for both recordings; local strict
suite green
```

### U34 (P1): Quantizer self-diagnosis and honest fills

```
Task: stop the quantizer from fabricating notation when the grid is wrong.

Changes: if > 20% of notes end up tied across barlines, flag the grid as
suspect and re-run the U31 search excluding the winning hypothesis;
_fill_measures may extend a note by at most one dot — longer gaps become
rests (no more inflated whole notes at bar ends).

Verify: unit tests for both rules; que_lindo tie count stays ~0; synthetic
suite unchanged
```

### U35 (P2): Meter confidence in the UI

```
Task: let the user fix a wrong auto-detection in one click.

Changes: transcribe response carries timeSignature confidence; the editor
metadata chip shows «2/4 (авто)» and opens a small popover offering 2/4, 3/4,
4/4, 6/8 → one click re-quantizes (existing re-transcribe flow) without
re-detecting pitch.

Verify: manual — switch meter on a transcription, notes re-bar instantly;
chip reflects the explicit choice (no «авто» suffix)
```

## Execution order & dependencies

```
U-A (foundation)  : U1 → U2 → U3 → U4 → U5 → U6 → U7 → U8
U-B (quality)     : U29 → U9 → U30 → U10 → U11 → U12 → U13 → U14   (needs U2/U3; U29 needs U6 for the CI ffmpeg step; U13 also needs U7)
U-C (UX/design)   : U15 → U16 → U17 → U18 → U19 → U20 → U21 → U22 → U23   (U16 needs U15; U18/U19 need U16; U20 is independent)
U-D (desktop)     : U24 → U25 → U26 → U27 → U28            (U24 needs U16/U17 only for localized labels — can start after U8 if needed)
U-E (metric)      : U31 → U32 → U33 → U34 → U35; U31b any time after U31   (U33 can run first if a measuring stick is wanted early)
```

**Recommended milestones:**
- **M1 «Safe to change»** = U1–U6 — tests + CI green. Do not skip; everything else leans on it.
- **M2 «Sounds right»** = U29, U9, U30, U10–U12 — the tempo/key/octave fixes the user actually feels, measured on the real Que-Lindo recordings.
- **M3 «Feels right»** = U15–U19 — design system, layout, Ukrainian UI, keyboard editing, autosave.
- **M4 «Ships right»** = U24–U27 — real Mac app behavior.

**Interaction with the roadmap:** Track B (Telegram bot) benefits directly from M1+M2 (shared backend gets tests and better accuracy). Start Track B any time after M2. Track C design work (C1) should wait for M3 — the design system and layout decisions made there are exactly the input Claude Design needs.

## Out of scope (unchanged from 04-ROADMAP.md §8)

Polyphony, LLM verification, real-time streaming transcription, LilyPond, Tauri, Android — still out. This plan does not reopen them.
