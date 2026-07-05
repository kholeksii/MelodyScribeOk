# MelodyScribe — Architecture Document

## 1. Project Overview

**MelodyScribe** — a desktop application for automatic melody recognition (piano, violin, guitar) from audio and conversion into sheet music notation with editing and PDF/MusicXML export capabilities.

---

## 2. Functional Requirements

| #   | Feature              | Description                                                        |
| --- | -------------------- | ------------------------------------------------------------------ |
| F1  | Audio Capture        | Record a melody from the microphone in real time                   |
| F2  | File Import          | Load an audio file (WAV, MP3, FLAC, OGG)                          |
| F3  | Instrument Selection | User selects: piano / violin / guitar                              |
| F4  | Pitch Detection      | Note pitch recognition (monophonic)                               |
| F5  | Onset Detection      | Detecting the start/end of each note                              |
| F6  | Note Segmentation    | Determining note and rest durations                               |
| F7  | Theory Verification  | Automatic error checking via music theory rules                   |
| F8  | Notation Editor      | Visual sheet music editor                                         |
| F9  | PDF/MusicXML Export  | PDF generation (VexFlow→SVG→PDF) and MusicXML (music21)           |
| F10 | Project Save         | Saving/loading projects in a custom format (JSON)                 |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Electron + React)            │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Audio    │  │ Notation     │  │ Toolbar               │  │
│  │ Controls │  │ Editor       │  │ (instrument, tempo,   │  │
│  │ (record, │  │ (VexFlow)    │  │  export, save/load)   │  │
│  │  upload) │  │              │  │                       │  │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘  │
│       │               │                      │              │
│       └───────────────┼──────────────────────┘              │
│                       │ IPC (Electron)                      │
└───────────────────────┼─────────────────────────────────────┘
                        │
┌───────────────────────┼─────────────────────────────────────┐
│                BACKEND (Python FastAPI)                      │
│                       │                                     │
│  ┌────────────────────▼──────────────────────┐              │
│  │           API Gateway (FastAPI)            │              │
│  └──┬──────────┬──────────┬─────────┬────────┘              │
│     │          │          │         │                       │
│  ┌──▼───┐  ┌──▼───┐  ┌──▼────┐  ┌─▼────────┐              │
│  │Audio │  │Pitch │  │Note   │  │Theory    │              │
│  │Input │  │Detect│  │Segment│  │Checker   │              │
│  │Module│  │(pyin)│  │Module │  │(music21) │              │
│  └──────┘  └──────┘  └───────┘  └──────────┘              │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │      MusicXML Export (music21)            │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Technology Stack

### 4.1 Frontend

| Technology      | Purpose                           |
| --------------- | --------------------------------- |
| **Electron**    | Desktop shell                     |
| **React 18**    | UI framework                      |
| **TypeScript**  | Type system                       |
| **VexFlow**     | Sheet music rendering             |
| **Tone.js**     | Note playback for verification    |
| **TailwindCSS** | Styling                           |
| **jsPDF**       | PDF generation from SVG (VexFlow) |

### 4.2 Backend

| Technology       | Purpose                                    |
| ---------------- | ------------------------------------------ |
| **Python 3.11+** | Main backend language                      |
| **FastAPI**      | HTTP API server                            |
| **librosa**      | Audio analysis + pitch detection (pyin)    |
| **music21**      | Music notation, theory, MusicXML export    |
| **pydub**        | Audio format conversion                    |

---

## 5. System Modules

### 5.1 Audio Input Module

```
Input:  microphone (WebAudio → PCM) or file (WAV/MP3/FLAC/OGG)
Output: normalized WAV mono 44100Hz 16-bit
```

- Uses `PyAudio` for microphone capture
- `pydub` / `ffmpeg` for format conversion
- Volume normalization, silence trimming at start/end

### 5.2 Pitch Detection Engine

```
Input:  normalized WAV + instrument type
Output: array [(timestamp_ms, frequency_hz, confidence), ...]
```

- **librosa.pyin** — probabilistic YIN for pitch detection (monophonic instruments)
- Parameters adapt to instrument:
  - Piano: range A0–C8 (27.5–4186 Hz)
  - Violin: range G3–E7 (196–2637 Hz)
  - Guitar: range E2–E6 (82–1319 Hz)
- Filtering low-quality detections (confidence < 0.7)

### 5.3 Note Segmentation Module

```
Input:  pitch data + raw audio
Output: array [{pitch, start_ms, duration_ms, velocity}, ...]
```

- **librosa** onset detection for note attack detection
- Merging adjacent frames with identical pitch into notes
- Duration quantization to musical values (whole, half, quarter, eighth, sixteenth)
- Detecting rests between notes
- Auto tempo detection (BPM) via `librosa.beat.beat_track`

### 5.4 Theory Verification Module

```
Input:  list of notes + metadata (instrument, tempo, key)
Output: list of corrections with explanations + confidence score
```

- Deterministic rules based on music21:
  - Instrument range check
  - Detection of unrealistic interval jumps (>octave)
  - Measure fullness check (sum of durations = time signature)
  - Enharmonic normalization according to key
- Returns JSON with corrections and confidence score

### 5.5 Notation Editor (Frontend)

- VexFlow renders notes on canvas
- Interactive editing:
  - Click on note → change pitch (drag up/down)
  - Change note duration (toolbar)
  - Add/delete notes
  - Add rests
  - Change tempo, key, time signature
- Melody playback via Tone.js for verification
- Parallel display of original audio (waveform)

### 5.6 Export Module

- **PDF**: VexFlow renders notes to SVG → `jsPDF` + `svg2pdf.js` converts to PDF (entirely in frontend)
- **MusicXML**: `music21` converts internal format to MusicXML (in backend)
- MuseScore, Finale, Sibelius support via MusicXML

---

## 6. API Endpoints (Backend)

```
POST /api/upload          — upload audio file
POST /api/record/start    — start microphone recording
POST /api/record/stop     — stop recording
POST /api/transcribe      — transcribe notes from audio
POST /api/verify          — verify notes (music theory rules)
POST /api/export/musicxml — export to MusicXML format
POST /api/project/save    — save project
POST /api/project/load    — load project
GET  /api/health          — health check
```

---

## 7. Data Format (Internal)

### 7.1 Project JSON

```json
{
  "version": "1.0",
  "metadata": {
    "title": "My Melody",
    "instrument": "piano",
    "tempo": 120,
    "timeSignature": "4/4",
    "keySignature": "C",
    "createdAt": "2026-04-14T10:00:00Z"
  },
  "notes": [
    {
      "id": "n1",
      "pitch": "C4",
      "duration": "quarter",
      "startBeat": 0,
      "measure": 1,
      "velocity": 80,
      "confidence": 0.95,
      "theoryCorrected": false
    }
  ],
  "audioFile": "base64_or_path",
  "theorySuggestions": []
}
```

### 7.2 Pitch Notation

- Scientific notation: C4 = Middle C, A4 = 440Hz
- Sharps: C#4, Flats: Bb4

---

## 8. Project Structure (Files)

```
melody-scribe/
├── frontend/                  # Electron + React
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioControls/
│   │   │   │   ├── AudioControls.tsx
│   │   │   │   ├── RecordButton.tsx
│   │   │   │   ├── FileUpload.tsx
│   │   │   │   └── WaveformDisplay.tsx
│   │   │   ├── NotationEditor/
│   │   │   │   ├── NotationEditor.tsx
│   │   │   │   ├── NoteToolbar.tsx
│   │   │   │   ├── MeasureView.tsx
│   │   │   │   └── NoteElement.tsx
│   │   │   ├── Toolbar/
│   │   │   │   ├── MainToolbar.tsx
│   │   │   │   ├── InstrumentSelector.tsx
│   │   │   │   └── ExportMenu.tsx
│   │   │   ├── Playback/
│   │   │   │   └── PlaybackControls.tsx
│   │   │   └── TheoryPanel/
│   │   │       ├── SuggestionsPanel.tsx
│   │   │       └── SuggestionItem.tsx
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.ts
│   │   │   ├── useNotation.ts
│   │   │   ├── usePlayback.ts
│   │   │   └── useProject.ts
│   │   ├── services/
│   │   │   ├── apiClient.ts
│   │   │   └── electronBridge.ts
│   │   ├── store/
│   │   │   ├── projectStore.ts
│   │   │   └── editorStore.ts
│   │   ├── types/
│   │   │   ├── note.ts
│   │   │   ├── project.ts
│   │   │   └── audio.ts
│   │   ├── utils/
│   │   │   ├── noteUtils.ts
│   │   │   ├── audioUtils.ts
│   │   │   └── pdfUtils.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── electron/
│   │   ├── main.ts
│   │   └── preload.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── backend/                   # Python FastAPI
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI app entry
│   │   ├── config.py          # Settings & env vars
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes/
│   │   │   │   ├── audio.py
│   │   │   │   ├── transcribe.py
│   │   │   │   ├── verify.py
│   │   │   │   ├── export.py
│   │   │   │   └── project.py
│   │   │   └── deps.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── audio_service.py
│   │   │   ├── pitch_service.py
│   │   │   ├── segmentation_service.py
│   │   │   ├── theory_checker.py
│   │   │   ├── notation_service.py
│   │   │   └── pdf_service.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── note.py
│   │   │   ├── project.py
│   │   │   └── audio.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── pitch_detector.py
│   │   │   ├── onset_detector.py
│   │   │   ├── quantizer.py
│   │   │   ├── tempo_detector.py
│   │   │   └── key_detector.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── audio_utils.py
│   │       └── music_utils.py
│   ├── tests/
│   │   ├── test_pitch_service.py
│   │   ├── test_segmentation.py
│   │   ├── test_theory_checker.py
│   │   └── test_pdf_service.py
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── Dockerfile
│
├── instructions/
│   ├── 01-ARCHITECTURE.md     # This file
│   ├── 02-AI-INSTRUCTIONS.md
│   └── 03-CLINE-PROMPTS.md
│
├── .env.example
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## 9. Development Order (Phases)

### Phase 1 — Foundation (Backend Core)

1. Python project + FastAPI setup
2. Audio Input Module (file upload, conversion)
3. Pitch Detection Engine (librosa.pyin integration)
4. Onset Detection + Note Segmentation
5. Basic API: upload → transcribe → JSON

### Phase 2 — Frontend MVP

6. Electron + React scaffold
7. File Upload UI
8. VexFlow notation rendering (read-only)
9. Frontend ↔ Backend API connection

### Phase 3 — Editor

10. Interactive Notation Editor (edit notes)
11. Toolbar (instrument, tempo, key)
12. Playback via Tone.js with cursor sync
13. Undo/Redo in editor
14. Confidence heatmap on notes

### Phase 4 — Verification + Export

15. Theory Checker (music theory rules via music21)
16. Suggestions Panel UI
17. MusicXML Export (music21)
18. PDF Export (VexFlow → SVG → jsPDF)

### Phase 5 — Polish

19. Microphone recording (real-time)
20. Project save/load
21. Error handling + edge cases
22. Testing on real melodies
23. PyInstaller backend bundling

---

## 10. Non-Functional Requirements

| Requirement              | Value                                      |
| ------------------------ | ------------------------------------------ |
| Latency (transcription)  | < 10 sec for 1 min audio                   |
| Accuracy (pitch)         | > 90% for monophonic melodies              |
| Supported formats        | WAV, MP3, FLAC, OGG                        |
| Max audio length         | 10 minutes                                 |
| PDF quality              | 300 DPI, standard notation format          |
| Offline mode             | Full functionality without internet        |
| OS                       | Windows 10+, macOS 12+, Linux (Ubuntu 22+) |

---

## 11. Risks and Mitigations

| Risk                           | Likelihood | Mitigation                                              |
| ------------------------------ | ---------- | ------------------------------------------------------- |
| Polyphonic fragments           | High       | User warning; monophony only                            |
| Recording noise                | Medium     | Noise gate + bandpass filter per instrument             |
| Inaccurate rhythm quantization | High       | Theory checker correction + manual editing              |
| VexFlow SVG→PDF quality        | Low        | Fallback to MusicXML → MuseScore CLI                    |

---

## 12. Coding Standards (AI Instructions)

### Code Style

- **Python**: PEP 8, type hints required, docstrings for public functions
- **TypeScript**: strict mode, explicit return types, no `any`
- **React**: functional components + hooks, no class components
- Maximum 200 lines per file; if more — split into modules
- One function — one responsibility

### Architecture Rules

- Follow the file structure from Section 8
- Backend: FastAPI + service layer pattern (route → service → core)
- Frontend: React + Zustand for state, VexFlow for notation
- All API endpoints return JSON with `success` field and `data`/`error`
- Use Pydantic models for validation on the backend

### Naming Conventions

- Python: `snake_case` for everything
- TypeScript: `camelCase` for variables/functions, `PascalCase` for types/components
- Files: `kebab-case.ts`, `snake_case.py`
- API routes: `/api/kebab-case`

### Error Handling

- Each service throws typed exceptions
- API returns proper HTTP codes (400 for bad input, 422 for validation, 500 for internal)
- Frontend shows user-friendly messages

---

## 13. Module-Specific Rules

### Audio Module (`backend/app/core/`)

- All audio operations via `librosa` (loading, normalization)
- Input audio always converted to: mono, 44100Hz, float32
- For format conversion: `pydub` + `ffmpeg`
- Trim silence at start/end: `librosa.effects.trim()`
- Max audio length: 10 minutes (validate at upload)

### Pitch Detection (`backend/app/core/pitch_detector.py`)

- Use **librosa.pyin** as the main detector
- Filter results with `confidence < 0.7`
- Frequency → Note Name conversion: `librosa.hz_to_note()`
- Always apply instrument range:
  ```python
  INSTRUMENT_RANGES = {
      "violin": (196.0, 2637.0),   # G3 — E7
      "piano": (27.5, 4186.0),     # A0 — C8
      "guitar": (82.0, 1319.0),    # E2 — E6
  }
  ```

### Onset Detection (`backend/app/core/onset_detector.py`)

- Use `librosa.onset.onset_detect`
- Minimum distance between onsets: 50ms
- Combine with `librosa.onset.onset_detect` for better accuracy

### Note Segmentation (`backend/app/services/segmentation_service.py`)

- Input: pitch array + onset timestamps
- Logic:
  1. Between each two onsets — one note
  2. Note pitch = median of pitch values between onsets
  3. Duration = difference between adjacent onsets
  4. Quantize to nearest musical duration
- Rest = if confidence < 0.5 throughout the segment
- Tempo detection: `librosa.beat.beat_track()`

### Theory Verification (`backend/app/services/theory_checker.py`)

- Deterministic rules via music21 (no LLM):
  - Instrument range check
  - Unrealistic interval jump detection (>octave)
  - Measure fullness check (sum of durations = time signature)
  - Enharmonic normalization according to key
- Returns JSON with corrections and confidence score

### Notation Editor (frontend)

- Use **VexFlow** for note rendering
- Each measure — a separate `Stave` object
- Support: treble and bass clef
- Interactivity: click to select, drag to change pitch, toolbar for duration, delete/insert notes
- Editor state stored in Zustand store

### PDF Export (frontend)

- VexFlow renders notes to SVG → `jsPDF` + `svg2pdf.js` converts to PDF (entirely in frontend)
- No backend involvement required for PDF

### MusicXML Export (`backend/app/services/notation_service.py`)

- Convert internal note format to MusicXML via music21
- Return as file download

---

## 14. Dependencies

### Backend (`requirements.txt`)

```
fastapi==0.111.*
uvicorn[standard]==0.30.*
python-multipart==0.0.*
pydantic==2.*
librosa==0.10.*
music21==9.*
pydub==0.25.*
httpx==0.27.*
numpy==1.26.*
```

### Frontend (`package.json`)

```
react: ^18.3
vexflow: ^4.2
tone: ^15.0
zustand: ^4.5
@tanstack/react-query: ^5
electron: ^30
vite: ^5
typescript: ^5.4
tailwindcss: ^3.4
```

---

## 15. Testing

### Backend

- Pytest for unit tests
- Test audio files in `backend/tests/fixtures/` (short .wav, 1–5 seconds)
- Each service has its own test file

### Frontend

- Vitest + React Testing Library
- Mock API responses via MSW
- Test: components, hooks, store actions
- E2E: Playwright (separately, at the end)

---

## 16. Git Workflow

- `main` — stable version
- `develop` — integration branch
- `feature/module-name` — feature branches
- Commit message format: `feat(module): short description`
- Squash merge into develop
- PR titles and descriptions must be in **English**
