# MelodyScribe

[![CI](https://github.com/kholeksii/MelodyScribeOk/actions/workflows/ci.yml/badge.svg)](https://github.com/kholeksii/MelodyScribeOk/actions/workflows/ci.yml)

Desktop app for transcribing monophonic melodies from audio into sheet music.  
Upload WAV/MP3/M4A or record from your mic → get notes → edit → export PDF or MusicXML.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| macOS | 13+ | — |
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 20+ | `brew install node` |
| ffmpeg | any | `brew install ffmpeg` |

> **ffmpeg is required** for M4A and MP3 transcription. Without it you will get a clear error message asking you to install it.

---

## First run (dev)

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m uvicorn app.main:app --reload --port 8000
```

Health check: http://localhost:8000/api/health → `{"success": true}`  
API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

For Electron window: `npm run electron:dev`

---

## Building the distributable

Requires: Python 3.11+, Node 20+, Xcode Command Line Tools (macOS).

```bash
./build.sh
```

Output: `frontend/dist-electron/MelodyScribe-*.dmg`

> First run takes 5–10 minutes (PyInstaller bundles librosa + music21).

---

## How to use

1. **Upload or Record** — drag-and-drop WAV/MP3/FLAC/OGG/M4A/WEBM, or click **Record** to capture from your microphone
2. **Set metadata** *(optional)* — enter BPM, time signature, and key for better accuracy (or use Tap Tempo)
3. **Choose instrument** — Piano / Violin / Guitar (affects pitch range)
4. **Transcribe** — backend analyses pitch, onsets, tempo; quantises rhythm
5. **Edit** — click a note → adjust pitch/duration in the toolbar; "↑ All up / ↓ All down" to shift all octaves; Ctrl+Z / Ctrl+Shift+Z for undo/redo
6. **Play** — Play button syncs a visual cursor; Stop resets it; optional metronome
7. **Save** — "Save Project" in the header downloads a `.melody` file; "Open Project" restores it
8. **Export** — Export PDF (renders VexFlow SVG to PDF) or Export MusicXML (open in MuseScore/Finale/Sibelius)

---

## The .melody file format

A `.melody` file is a ZIP archive containing:

```
project.json   — notes, metadata (tempo, key, instrument…)
audio.<ext>    — original audio blob (optional)
```

Opening a `.melody` file restores the full editing state including audio playback.

---

## Microphone permissions on macOS

First recording attempt will trigger the browser/Electron permission dialog.  
If denied, grant access in: **System Settings → Privacy & Security → Microphone → MelodyScribe**

---

## Project structure

```
MelodyScribeOk/
├── backend/
│   ├── app/
│   │   ├── api/routes/          # HTTP endpoints
│   │   ├── core/                # Audio analysis (pitch, onset, tempo, key, quantizer)
│   │   ├── services/            # segmentation_service, theory_checker, pdf_service
│   │   ├── models/              # NoteData, TranscriptionData, Project
│   │   └── errors.py            # FfmpegMissingError
│   └── requirements.txt
│
├── frontend/src/
│   ├── components/
│   │   ├── AudioControls/       # FileUpload, RecordButton, InstrumentSelector, TranscribeOptions
│   │   ├── NotationEditor/      # NotationDisplay (VexFlow), NoteToolbar
│   │   ├── Playback/            # PlaybackControls (Tone.js)
│   │   ├── Toolbar/             # Save/Load project buttons
│   │   ├── ErrorBoundary.tsx    # React error boundary
│   │   ├── Toast.tsx            # Toast notification system
│   │   ├── Tour.tsx             # First-run onboarding
│   │   └── ExportButton.tsx     # PDF + MusicXML export
│   ├── hooks/
│   │   ├── usePlayback.ts       # Tone.js + cursor sync
│   │   └── useAudioRecorder.ts  # MediaRecorder hook
│   ├── services/
│   │   ├── apiClient.ts         # HTTP client
│   │   └── projectFile.ts       # .melody save/load (JSZip)
│   └── store/
│       ├── projectStore.ts      # Notes, undo/redo, audioBlob
│       └── recentProjectsStore.ts  # Recent projects (localStorage)
│
├── tests/
│   └── e2e_smoke.md             # Manual E2E checklist
├── build.sh                     # Full build pipeline → .dmg
└── CLAUDE.md
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 28 |
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS |
| Notation | VexFlow 4 |
| Playback | Tone.js |
| State | Zustand |
| PDF export | jsPDF + svg2pdf.js |
| Project files | JSZip (.melody format) |
| Backend | Python 3.11 + FastAPI |
| Pitch detection | librosa.pyin |
| Music theory | music21 |
| Bundling | PyInstaller + electron-builder |

---

## Known limitations

- Transcription is **monophonic only** (one note at a time)
- Supported instruments: Piano, Violin, Guitar
- Chords and polyphony are not supported
- M4A/MP3 require ffmpeg; WAV/FLAC/OGG work without it
