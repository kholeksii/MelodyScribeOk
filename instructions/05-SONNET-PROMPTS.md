# MelodyScribe — Sonnet Prompts (P29+)

## How to use

Each prompt below is a **self-contained task** for a Sonnet model with the existing repo loaded.

**Rules:**
1. Execute prompts strictly in order (P29, P30, ...)
2. One prompt = one task = one commit (use `feat(...)` or `fix(...)` prefix)
3. Confirm the previous step works before starting the next
4. After each prompt, run the verification check listed under it

**Pass to Sonnet once at session start (system prompt):**

```
You are a Senior Full-Stack Developer on the MelodyScribe project.
Stack: Python 3.11 + FastAPI + librosa + music21 (backend); React 18 + TypeScript strict + VexFlow + Tone.js + Zustand + TailwindCSS (frontend); Electron (desktop).
Rules: type hints (Python), strict TS, functional React components, max ~200 lines/file.
Read the current code in files affected by the task BEFORE writing changes.
One prompt = one commit. Do not mix tasks.
Reply with code and a short summary only. No lengthy explanations.
```

---

# Track A — Finish Mac Electron MVP (P29–P42)

## Phase 5: Audio reliability & user-known metadata

### P29: ffmpeg detection + clear error message

```
Task: surface a clear error when M4A/MP3 transcription falls back to deprecated audioread because ffmpeg is missing.

Files:
- backend/app/services/segmentation_service.py — wrap librosa.load() so that, if it raises (or warns) about audioread / missing ffmpeg, raise FfmpegMissingError("M4A and MP3 require ffmpeg. Install: brew install ffmpeg")
- backend/app/api/routes/transcribe.py — catch FfmpegMissingError, return HTTP 422 with that message
- Define FfmpegMissingError in segmentation_service.py (or a new errors.py module — your call)

Verify:
- Without ffmpeg: POST /api/transcribe with an .m4a file returns 422 + the message
- With ffmpeg installed: same call returns 200 as before
- Frontend already shows error state — no change needed
```

---

### P30: Pre-transcription metadata UI (BPM, time signature, key)

```
Task: let the user input known BPM/time-signature/key before transcribing, so the backend can use them instead of unreliable auto-detection.

Backend changes:
- backend/app/api/routes/transcribe.py — extend TranscribeRequest with optional fields:
    bpm: Optional[int] = None
    time_signature: Optional[str] = None  # "4/4", "3/4", "6/8", "2/4"
    key: Optional[str] = None             # "C major", "A minor", etc.
- backend/app/services/segmentation_service.py — transcribe(file_path, instrument, bpm=None, time_signature=None, key=None):
    if bpm is provided, skip TempoDetector and use it
    if time_signature is provided, pass through to quantizer / measure calc
    if key is provided, skip KeyDetector
- Pass user-supplied values through to the existing _segment_notes flow

Frontend changes:
- frontend/src/components/AudioControls/TranscribeOptions.tsx (new):
    Props: { bpm: string; setBpm; timeSignature: string; setTimeSignature; key: string; setKey }
    Inputs:
      - BPM: number input, placeholder "auto", optional, range 40–300
      - Time signature: <select> with 4/4, 3/4, 6/8, 2/4
      - Key: <select> with all 12 majors + 12 minors
    TailwindCSS, matches existing form styling (purple theme).
- frontend/src/App.tsx:
    Hold {bpm, timeSignature, key} state alongside instrument
    Render <TranscribeOptions> in the upload area, below <InstrumentSelector>, above the Transcribe button
    Pass values to handleTranscribe
- frontend/src/services/apiClient.ts:
    transcribe(fileId, instrument, options?: { bpm?: number; timeSignature?: string; key?: string }): Promise<TranscriptionData>
    Send only fields that are set; map TS camelCase ↔ Python snake_case at the boundary

Verify:
- Upload tests/ДоМіРеДо-2ї.m4a, set BPM=120, key=C major, transcribe → fewer measures, more accurate beat positions
- Leave BPM blank → behaves exactly as before (auto-detect)
```

---

### P31: Manual ±octave shift in NoteToolbar

```
Task: when octave correction post-processing misses, let the user shift the entire transcription by an octave with one click.

Files:
- frontend/src/store/projectStore.ts — add action shiftAllOctaves(direction: 1 | -1):
    For every note where pitch !== "rest", parse pitch (e.g. "C4" → name="C", octave=4), add 12*direction semitones (i.e. octave += direction), clamp to a safe range (octave 1–8), reassemble pitch string. Skip rests. Push the previous state onto the undo stack.
- frontend/src/components/NotationEditor/NoteToolbar.tsx:
    Add two buttons in a new "Octave" section, always visible (NOT gated by selectedNoteId):
      "↑ All up" / "↓ All down"
    onClick → projectStore.shiftAllOctaves(±1)
    Tailwind, same button styling as existing toolbar buttons.

Verify:
- Transcribe → click "↑ All up" → all notes visually move up an octave on staff, pitches in note list change C4→C5 etc.
- Click Undo → state reverts
- Rests stay as rests
```

---

### P32: Tap-tempo helper

```
Task: add a "Tap tempo" button in TranscribeOptions that lets the user tap along to compute BPM.

Files:
- frontend/src/components/AudioControls/TranscribeOptions.tsx:
    Add hook useTapTempo():
      State: timestamps: number[] (last 8 taps).
      Action tap(): push performance.now() to timestamps; if length >= 4, compute median interval between consecutive taps, convert to BPM, return it.
      Action reset(): clear timestamps.
    UI: button "Tap tempo" next to BPM input. On click → tap(). After 4+ taps, compute BPM and call setBpm(bpm). Display "Tap N/4..." or "BPM: 120" feedback.
    Auto-reset timestamps after 3 seconds of inactivity.

Verify:
- Click "Tap tempo" 4 times at ~1 Hz → BPM input shows ~60
- Stop tapping for 3s → next tap starts a fresh series
```

---

## Phase 6: Microphone recording (F1)

### P33: useAudioRecorder hook

```
Task: create a React hook for recording audio from the user's microphone.

File: frontend/src/hooks/useAudioRecorder.ts (new)

API:
  type RecorderState = 'idle' | 'recording' | 'processing';
  function useAudioRecorder(): {
    state: RecorderState;
    elapsedSec: number;          // updates every 100ms while recording
    error: string | null;
    start(): Promise<void>;
    stop(): Promise<Blob>;       // returns webm blob, audio/webm
  }

Implementation:
- start(): navigator.mediaDevices.getUserMedia({ audio: true }), create MediaRecorder, mimeType 'audio/webm', collect chunks
- stop(): stop the recorder, wait for 'stop' event, assemble Blob with type 'audio/webm', stop all tracks
- Handle errors: permission denied → set error to "Microphone permission denied"; not supported → "MediaRecorder not supported"
- Update elapsedSec via interval; clear interval on stop

Verify:
- Build a throwaway test page that uses the hook, click start → wait 3s → click stop → resulting Blob.size > 0 and type === 'audio/webm'
```

---

### P34: RecordButton component

```
Task: UI component for recording, plus auto-upload and trigger transcription.

File: frontend/src/components/AudioControls/RecordButton.tsx (new)

Props:
  onUploadComplete: (audioInfo: AudioInfo) => void

UI states:
  idle:       gray button, label "🎙 Record"
  recording:  red pulsing button, label "⏺ {elapsedSec}s — click to stop"
  processing: gray spinner, label "Processing..."

Behavior:
  Uses useAudioRecorder hook.
  Click idle → start recording.
  Click recording → stop, get Blob, set state to processing.
  Convert webm Blob → File('recording.webm') and call apiClient.uploadAudio(file).
  On success → set state to idle, call onUploadComplete with audioInfo.
  On error → set state to idle, show toast (or alert for now — Toast comes in P40).

Integration:
  frontend/src/components/AudioControls/FileUpload.tsx:
    Render <RecordButton /> below the dropzone, with "or" divider between them.
    Pass through onUploadComplete prop.

Verify:
- Click record → speak a melody → click stop → upload completes → file appears in upload dir on backend
- The user can then click Transcribe (existing flow) and see notes
```

---

### P35: Backend webm support

```
Task: add .webm to accepted audio extensions on the backend.

Files:
- backend/app/services/audio_service.py — add ".webm" to the accepted extensions tuple in upload_file(); save the file with .webm extension; pass through librosa.load (works because librosa uses ffmpeg for webm; if ffmpeg missing, P29's error path triggers — that's correct behavior)
- backend/app/api/routes/audio.py — add ".webm" to the extension search list in get_audio()
- backend/app/api/routes/transcribe.py — add ".webm" to the extension search list in transcribe_audio()

Verify:
- Upload a webm file via curl → success, file_id returned, transcribe works
```

---

## Phase 7: Persistence — PDF & Project Files

### P36: PDF export (frontend, VexFlow SVG → PDF)

```
Task: export the current notation as a PDF, no backend involvement.

Dependencies: npm install jspdf svg2pdf.js

Files:
- frontend/src/components/ExportButton.tsx:
    Existing button is "Export MusicXML". Refactor into a dropdown / button group with two options: "Export PDF" and "Export MusicXML".
    On "Export PDF" click:
      1. Find the rendered VexFlow SVG element via document.querySelector('.notation-display svg') (verify this selector against NotationDisplay.tsx)
      2. Create a new jsPDF document (landscape, A4)
      3. Use svg2pdf to render the SVG into the jsPDF doc (handle scaling)
      4. doc.save(`${metadata.title || 'melody'}.pdf`)
    Add CSS class 'notation-display' to the wrapper in NotationDisplay.tsx if not already present, so the selector reliably finds the SVG.

Verify:
- Transcribe → click Export PDF → file downloads → opens in Preview with notes visible
```

---

### P37: .melody project file format

```
Task: define a project file format that bundles original audio + transcription state.

Dependencies: npm install jszip

File: frontend/src/services/projectFile.ts (new)

API:
  async function saveProject(project: Project, audioBlob: Blob | null): Promise<Blob> {
    // zip containing project.json (Project) + audio.{ext} (if provided)
  }
  async function loadProject(file: File): Promise<{ project: Project; audioBlob: Blob | null }> {
    // unzip, parse project.json, extract audio if present
  }

Implementation:
- Use JSZip
- File extension: .melody (it's a zip)
- project.json shape matches the Project model from frontend/src/types/project.ts
- audio file name: keep the original extension if available (.wav, .m4a, .webm, etc.); store inside the zip as audio.<ext>

Project.audioFile field:
- When saving, set project.audioFile to the filename inside the zip (e.g. "audio.webm")
- When loading, ignore the field and read audio.* directly from the zip

Verify:
- Unit-test (or manual): create a tiny Project + small Blob, save → load → identical content
```

---

### P38: Save/Load buttons

```
Task: surface project save/load in the UI.

Files:
- frontend/src/components/Toolbar/Toolbar.tsx (existing): add "Save Project" and "Open Project" buttons.
    Save: gather Project from store (metadata + notes); look up the original audio Blob (NEW: store it in projectStore — see below); call saveProject(); trigger browser download via URL.createObjectURL.
    Open: hidden <input type="file" accept=".melody"> triggered by the button; on file pick, call loadProject(); call projectStore.loadFromProject(project); store audio Blob back in projectStore.

- frontend/src/store/projectStore.ts:
    Add audioBlob: Blob | null to state (to support save).
    Add setAudioBlob(blob: Blob | null) action.
    Add loadFromProject(project: Project, audioBlob: Blob | null) action — replaces notes, metadata, audioFileId; sets audioBlob.
    
- frontend/src/components/AudioControls/FileUpload.tsx:
    On successful upload, also call setAudioBlob with the original File (which is a Blob).
    Same in RecordButton.tsx — call setAudioBlob with the recording Blob before upload.

Verify:
- Transcribe → edit a note → Save Project (downloads .melody) → reload page → Open Project (.melody) → state restored, including audio for replay
```

---

### P39: Recent Projects list

```
Task: show last 5 opened/saved projects on the empty state landing screen.

Files:
- frontend/src/store/recentProjectsStore.ts (new): tiny Zustand store, persist to localStorage, key 'melodyscribe_recent_projects'.
    interface RecentProject { name: string; savedAt: number; }
    State: recents: RecentProject[]
    Actions: addRecent(name), clearRecents()

- frontend/src/services/projectFile.ts:
    saveProject and loadProject call useRecentProjectsStore.getState().addRecent(filename).

- frontend/src/App.tsx:
    On the empty-state screen (when !notes.length && !audioFileId), show "Recent" list above the FileUpload component:
      <ul> of last 5 RecentProjects with friendly date ("2 days ago" via Intl.RelativeTimeFormat).
    Note: clicking a recent doesn't reopen it (browsers don't remember file paths) — it's just a hint that says "use Open Project to open one".

Verify:
- Save 2 projects → reload page → both shown in Recent on landing screen
```

---

## Phase 8: Polish & distribution

### P40: ErrorBoundary + Toast notifications

```
Task: replace alert() calls and unhandled errors with proper UI.

Files:
- frontend/src/components/ErrorBoundary.tsx (new): React error boundary, catches render errors, shows fallback UI with "Reload" button.
- frontend/src/components/Toast.tsx (new): simple toast component (no library, custom).
    Provider: <ToastProvider> at root, manages a queue.
    Hook: useToast() returns { showToast(message, type: 'info' | 'success' | 'error', durationMs = 4000) }.
    Render: stack of toasts at top-right, fade in/out, auto-dismiss.

- frontend/src/main.tsx: wrap <App /> in <ErrorBoundary><ToastProvider>...</ToastProvider></ErrorBoundary>.

- Replace existing user-facing error display (the red error box in App.tsx, alert() calls, console.error in user-triggered flows) with showToast(...).

Verify:
- Trigger backend error (stop backend → click Transcribe) → toast appears, no white screen
- Throw an error in a component (temp test) → ErrorBoundary catches, shows fallback
```

---

### P41: First-run tour

```
Task: 3-step onboarding tooltips on first launch.

Files:
- frontend/src/components/Tour.tsx (new):
    Hook useTour(): { currentStep: 0..3, next(), skip() }; persists `melodyscribe_tour_seen=true` in localStorage when complete or skipped.
    Component: floating tooltip pointing at:
      Step 1 (anchor: FileUpload zone): "Upload audio or record from your microphone"
      Step 2 (anchor: TranscribeOptions): "Optionally set BPM, key, and time signature for better accuracy"
      Step 3 (anchor: ExportButton, after notes are loaded): "Edit notes, then export to PDF or MusicXML"
    Each step has Next and Skip buttons.

- frontend/src/App.tsx: render <Tour /> on mount; it self-gates via localStorage.

Verify:
- Clear localStorage → reload → 3-step tour shows
- Skip → reload → no tour
- Complete tour → reload → no tour
```

---

### P42: E2E checklist + README + final PyInstaller build

```
Task: capture how to verify the whole app, document setup, build the distributable.

Files:
- tests/e2e_smoke.md (new) — manual checklist:
    [ ] Launch app
    [ ] Tour shows on first run
    [ ] Upload tests/ДоМіРеДо-2ї.m4a → transcribe with BPM=120 → notes appear
    [ ] Click "↑ All up" → octave shifts → undo → reverts
    [ ] Click Play → playback works → Stop button auto-resets at end
    [ ] Save Project → file downloads
    [ ] Reload app → Recent list shows the saved project
    [ ] Open Project → state restored
    [ ] Export PDF → opens correctly in Preview
    [ ] Export MusicXML → opens correctly in MuseScore
    [ ] Click record → speak → stop → uploads → transcribes
    [ ] Trigger a backend error → toast (not alert)

- README.md — update sections:
    Prerequisites: macOS, Python 3.11+, Node 20+, ffmpeg (`brew install ffmpeg`)
    First run / dev: how to start backend + frontend
    Building the distributable: ./build.sh produces .dmg
    Microphone permissions on macOS
    The .melody file format (briefly)

- Run ./build.sh and verify the resulting .dmg installs and the installed app passes the e2e checklist.

Commit message: "chore: v1.0 release — Track A complete"
Tag the commit: git tag v1.0
```

---

# Track B — Telegram Bot (P43–P46)

### P43: Telegram bot scaffold

```
Task: create a Telegram bot that loads the existing Python backend's transcription pipeline.

Dependencies: python-telegram-bot==21.* in backend/requirements-bot.txt (separate file to keep main backend lean)

Files:
- backend/bot/__init__.py
- backend/bot/main.py — entry point, reads TELEGRAM_BOT_TOKEN from env, runs long-polling Application
- backend/bot/handlers.py — handler functions:
    /start: welcome message in Ukrainian + English; explain "send a voice message of a melody, I'll send back a PDF score"
    /instrument piano|violin|guitar: store in per-chat preference
    /bpm <number>: store user-known BPM (optional)
    /help: list commands
- backend/bot/preferences.py — tiny SQLite wrapper:
    table prefs (chat_id INT PRIMARY KEY, instrument TEXT, bpm INT)
    get_prefs(chat_id) -> dict; set_prefs(chat_id, **kwargs)
- backend/bot/Dockerfile — base from python:3.11-slim, install requirements-bot.txt + ffmpeg, run main.py

No voice handling yet (P44 adds it).

Verify:
- TELEGRAM_BOT_TOKEN=xxx python -m backend.bot.main → bot online, /start responds
```

---

### P44: Voice handler → existing pipeline

```
Task: when user sends a voice/audio message, transcribe it and reply with detected notes.

Files:
- backend/bot/handlers.py — add voice_handler:
    1. Get prefs for chat_id (defaults: instrument=piano, bpm=None)
    2. Download voice file via update.message.voice.get_file().download_to_drive(temp_path) — Telegram voice messages are .oga (OGG Opus); requires ffmpeg
    3. Call SegmentationService().transcribe(temp_path, instrument, bpm=bpm)
    4. Format notes into a short text reply: "Detected 12 notes at 120 BPM in C major. PDF coming up..."
    5. Cleanup temp file

- backend/bot/main.py — register MessageHandler(filters.VOICE | filters.AUDIO, voice_handler)

PDF reply happens in P45, this prompt only sends the text summary.

Verify:
- /instrument piano → send voice "do mi re do" → bot replies with note summary
```

---

### P45: Notes → PDF for bot reply

```
Task: render transcribed notes as a PDF and send it back via Telegram.

Approach: use MuseScore CLI for engraving — it produces high-quality output and reads music21's MusicXML directly.

Files:
- backend/bot/pdf_renderer.py (new):
    class BotPDFRenderer:
        def render(transcription: TranscriptionData) -> bytes:
            1. Use existing PDFService.export_musicxml_bytes() to get MusicXML
            2. Write to a temp .musicxml file
            3. subprocess.run(['musescore3', '-o', 'out.pdf', 'in.musicxml'], check=True, timeout=30)
               (or 'mscore' / 'musescore4' depending on platform — try in order)
            4. Return out.pdf bytes
            5. Cleanup temp files
    Raise BotPDFError("MuseScore not installed") if no MuseScore binary found.

- backend/bot/handlers.py — voice_handler:
    After transcription summary, call BotPDFRenderer().render(result), then update.message.reply_document(BytesIO(pdf_bytes), filename="score.pdf", caption=f"Tempo: {tempo} BPM, Key: {key}")
    On BotPDFError, fall back to sending only the MusicXML file (still useful — user can open in MuseScore themselves)

- backend/bot/Dockerfile — install MuseScore: `apt-get install -y musescore3 fontconfig` (set DISPLAY=:99 + xvfb-run if MuseScore needs X)

Verify:
- Send voice → receive PDF score back, opens cleanly in any PDF viewer
```

---

### P46: Deploy bot to fly.io

```
Task: deploy the bot to fly.io free tier so it runs 24/7.

Files:
- backend/bot/fly.toml (new):
    app = "melodyscribe-bot"
    primary_region = "fra"  # or wherever has lowest latency to user
    [build]
      dockerfile = "Dockerfile"
    [env]
      PYTHONUNBUFFERED = "1"
    [[services]]
      # bot uses long-polling, no inbound HTTP needed
      # but fly requires at least one service; expose a health check on :8080
      internal_port = 8080
      protocol = "tcp"
      [[services.tcp_checks]]
        interval = "10s"
        timeout = "2s"

- backend/bot/main.py — add a tiny aiohttp /health endpoint on :8080 alongside the bot polling, so fly's health check passes
- backend/bot/.dockerignore
- README.md update: section "Deploying the Telegram bot" with fly commands:
    flyctl launch --no-deploy
    flyctl secrets set TELEGRAM_BOT_TOKEN=xxx
    flyctl deploy

- Add per-chat rate limit in handlers.py: max 1 voice message per 30 seconds (in-memory dict). Drop excess silently to avoid abuse.

Verify:
- flyctl deploy succeeds → flyctl logs shows "bot online"
- Send voice from real Telegram → receive PDF
- Send 2 voice messages in 5 seconds → second is rate-limited (no reply or "wait 30s" reply)

Commit message: "feat: Track B complete — Telegram bot live"
Tag: v1.1
```

---

# Track C — Apple Universal Native (P47+)

> ⚠️ **Track C prompts are outlines, not full prompts.** Full prompts will be written after Claude Design (C1) outputs the SwiftUI starter — design dictates structure, so writing detailed prompts now would be premature.
> 
> Each entry below is enough to plan effort, not enough to hand to Sonnet directly.

### C0: Confirm staged B→A architecture

```
Capture the decision in instructions/06-IOS-ARCHITECTURE.md:
  - v1.x: SwiftUI shell + WKWebView wrapping existing React frontend + cloud FastAPI backend
  - v2.x: gradual replacement — native AVAudioEngine recording → native pitch/onset → native notation rendering
  - Min targets: iOS 17, macOS 14 (Apple Silicon)
  - Bundle ID: com.kholeksii.melodyscribe (or similar)
```

### C1: 🎨 Claude Design — UI mockups (3 styles × 8 screens × 3 form factors)

```
Run Claude Design with this brief:

  App: MelodyScribe — transcribes monophonic melodies (piano/violin/guitar) into editable sheet music.
  Target users: music teachers and their students.
  Form factors: iPhone 15 (compact, portrait), iPad 12.9" (split-view), Mac (windowed).
  Generate 3 visual style options:
    Style 1 — Minimalist Apple HIG (like Notes / Voice Memos)
    Style 2 — Skeuomorphic music-paper (texture, wood, leather buttons — like old GarageBand)
    Style 3 — Colorful and playful (like Yousician / Simply Piano — student-friendly)
  Screens to design (8):
    1. Empty state / Recent projects
    2. Record / Upload selector
    3. Instrument + BPM/key picker (pre-transcription)
    4. Transcribing (loading)
    5. Notation editor + playback controls
    6. Note edit toolbar (modal sheet on iPhone, sidebar on iPad/Mac)
    7. Export sheet (PDF / MusicXML)
    8. Settings / About
  Output: SwiftUI code for each screen × style; user picks one style and we proceed.
```

### C2: Xcode universal SwiftUI project skeleton
- Create universal app target, iOS 17+ / macOS 14+, Catalyst on
- Bundle identifier, signing certificates, entitlements (Microphone, Files, iCloud Documents)
- Drop in the SwiftUI starter from C1 (whichever style user picked)

### C3: Backend deployment (fly.io)
- Deploy `backend/app/` as a separate fly app alongside the bot
- HTTPS endpoint for the iOS app to call
- Same backend serves both Track B bot AND Track C iOS app

### C4: WKWebView wrapper for existing React frontend
- Embed WKWebView in main SwiftUI screen
- Load https://melodyscribe-app.fly.dev (or local during dev)
- JS↔Swift bridge via WKScriptMessageHandler:
  - Native → JS: send recorded audio path
  - JS → Native: trigger native PDF export, request file save dialog, etc.

### C5: Native AVAudioEngine recording
- Replace web MediaRecorder with native iOS recording
- Capture as WAV → upload to backend via URLSession
- Better permission UX, lower battery

### C6: iCloud Documents integration
- `.melody` files saved to `~/Documents/MelodyScribe/` with iCloud sync
- Standard iOS document picker for open/save
- Cross-device sync "for free"

### C7: Native PDFKit export
- Replace frontend jspdf path with native PDFKit
- Higher fidelity, AirPrint integration, share sheet

### C8: TestFlight beta
- Internal: wife + 3 students
- Iterate on layout, gestures, audio quality

### C9: App Store submission
- Privacy nutrition label, screenshots, app review

### C10–C12: Long-term native modules (post-1.0)
- C10: Native SwiftUI Canvas notation (replaces VexFlow WKWebView)
- C11: On-device pitch/onset (Accelerate framework + AVAudioEngine, replaces backend dependency for analysis)
- C12: Android port (only if Track C succeeds and demand exists)

---

## Appendix: Commit message conventions

```
feat(scope): short description       — new feature
fix(scope): short description        — bug fix
chore(scope): short description      — tooling, build, deps
docs(scope): short description       — documentation only

scope examples: backend, frontend, bot, audio, notation, playback, export
```

Examples:
- `feat(audio): manual BPM/key input via TranscribeOptions (P30)`
- `fix(playback): Stop button auto-resets at end of playback`
- `feat(bot): voice → PDF roundtrip (P44+P45)`
