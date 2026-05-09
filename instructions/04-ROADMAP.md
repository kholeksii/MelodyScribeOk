# MelodyScribe — Multi-Track Roadmap (v2)

**Status:** active. Authored 2026-05-09. Supersedes the original Phase 1–5 plan in `01-ARCHITECTURE.md` §9 once Track A completes.

---

## 1. Vision

MelodyScribe began as an Electron desktop app for one user — Oleksiy's wife, a music teacher who needs to transcribe short monophonic melodies (piano / violin / guitar) into editable, printable sheet music. The original spec (`01-ARCHITECTURE.md`) targeted only macOS/Windows/Linux desktop.

The vision has now expanded:

1. **Apple universal native app** — single codebase running on iPhone, iPad, and Apple Silicon Macs (replaces Electron for daily use)
2. **Telegram bot** — zero-install access for anyone with Telegram; receives a voice message, returns a PDF score
3. **Mac Electron MVP** — short-term, finishes the in-progress desktop build so the wife has a working tool *now*

Each is independently shippable. The order is deliberate.

---

## 2. Track Overview

```
Track A — Finish Mac Electron MVP        (P29–P42, ~14 prompts)
Track B — Telegram bot (voice → PDF)     (P43–P46, ~4  prompts)
Track C — Apple Universal Native rewrite (P47+,    ~12 prompts)
                ↑
          Claude Design enters here (C1–C2)
```

**Confirmed execution order: A → B → C.** Don't parallelize — feedback from A and B in real use should shape Track C's design choices.

---

## 3. Current State

### Done (matches F1–F10 spec from `01-ARCHITECTURE.md`)
- ✅ F2 Audio upload (WAV/MP3/FLAC/OGG; M4A partial — needs ffmpeg)
- ✅ F3 Instrument selection
- ✅ F4 Pitch detection (pyin + post-processing octave correction)
- ✅ F5 Onset detection (backtrack + 80ms min-gap filter)
- ✅ F6 Note segmentation + quantization + dedup
- ✅ F7 Theory verification (deterministic via music21, replaces original Ollama LLM plan)
- ✅ F8 Notation editor (VexFlow + measure barlines + click-to-select + NoteToolbar + undo/redo + confidence heatmap)
- ✅ MusicXML import + export (replaces original LilyPond PDF plan)
- ✅ Playback (Tone.js, auto-stop on natural end, BPM input, metronome, sync highlighting)
- ✅ Tempo + Key detection (with half-tempo correction for monophonic edge case)
- ✅ PyInstaller bundling pipeline

### Not Done
- ❌ F1 Microphone recording
- ❌ F9 PDF export (only MusicXML)
- ❌ F10 Project save/load (no persistence between sessions)

### Real-World Gaps (from testing on `tests/ДоМіРеДо-2ї.m4a` etc.)
- ⚠️ Tempo accuracy unreliable on monophonic input — `librosa.beat.beat_track` detects 42 BPM (66 after half-tempo fix) on a melody actually played at ~120 BPM, causing notes to spread across 3 measures instead of 1
- ⚠️ M4A loading falls back to deprecated audioread without ffmpeg
- ⚠️ User cannot input the BPM/key/time-signature they already know before transcribing
- ⚠️ User cannot manually shift the whole transcription up/down an octave when octave correction misses

---

## 4. Track A — Finish Mac Electron MVP

**Goal:** v1.0 the wife uses daily on her MacBook. Audio in → notes out → editable → printable PDF → re-openable later.

### Phase 5 — Audio reliability & user-known metadata
| ID  | What                                                                                  |
|-----|---------------------------------------------------------------------------------------|
| P29 | ffmpeg detection + clear 422 error pointing at `brew install ffmpeg`                  |
| P30 | Pre-transcription metadata UI — BPM, time-sig, key (skip auto-detect when supplied)   |
| P31 | Manual "shift all notes ±octave" buttons in NoteToolbar (integrated with undo)        |
| P32 | Tap-tempo helper inside the metadata UI                                               |

### Phase 6 — Microphone recording (F1)
| ID  | What                                                                                  |
|-----|---------------------------------------------------------------------------------------|
| P33 | `useAudioRecorder` hook (getUserMedia + MediaRecorder → webm Blob)                    |
| P34 | `RecordButton` component (idle/recording/processing states; auto-upload on stop)      |
| P35 | Backend `.webm` extension support + transcoding through librosa                       |

### Phase 7 — Persistence (F9, F10)
| ID  | What                                                                                  |
|-----|---------------------------------------------------------------------------------------|
| P36 | PDF export via VexFlow SVG → svg2pdf.js → jsPDF (frontend-only)                       |
| P37 | `.melody` project file format — zip of `project.json` + original `audio.{ext}`        |
| P38 | Save Project / Open Project buttons; `loadFromProject()` store action                 |
| P39 | Recent Projects list (last 5, localStorage)                                           |

### Phase 8 — Polish & distribution
| ID  | What                                                                                  |
|-----|---------------------------------------------------------------------------------------|
| P40 | ErrorBoundary + Toast notifications (replace alert/console for user-facing errors)    |
| P41 | First-run 3-step tour                                                                 |
| P42 | E2E smoke checklist + README update + final PyInstaller build + .dmg                  |

**Verification milestone:** after P42, the wife can record a melody, transcribe it, edit it, save it, reopen it, and print it — all offline, on her MacBook, no manual ffmpeg dance for WAV/webm.

---

## 5. Track B — Telegram Bot

**Goal:** zero-install access. Wife shares the bot link with her students, they send voice messages, get PDFs back.

**Why Track B before C:** Telegram bots ship in days, App Store apps ship in months. Real users (students) generate feedback faster than TestFlight beta of an unfinished native app.

| ID  | What                                                                                  |
|-----|---------------------------------------------------------------------------------------|
| P43 | `backend/bot/` package with `python-telegram-bot` v21+ scaffold; commands `/start`, `/instrument`, `/bpm`; per-chat preferences in SQLite |
| P44 | Voice handler — download via Bot API → `SegmentationService.transcribe()` → return notes preview as text |
| P45 | Notes → PDF via MuseScore CLI (or fallback to a minimal reportlab single-line renderer); send PDF + caption with detected metadata |
| P46 | Dockerfile, fly.io deploy config, `TELEGRAM_BOT_TOKEN` env, simple per-chat rate limit |

**Verification milestone:** send a voice message of "Do Mi Re Do" to the bot, receive a PDF within 30s.

---

## 6. Track C — Apple Universal Native

**Goal:** SwiftUI app running natively on iPhone, iPad, and Apple Silicon Macs. Replaces the Electron Mac app from Track A.

### Architecture decision (confirmed): Staged B → A
1. **First**: SwiftUI shell wrapping the existing React frontend in WKWebView, talking to the same FastAPI backend (deployed alongside the Telegram bot from Track B)
2. **Then iteratively**: replace WKWebView screens with native SwiftUI; replace cloud calls with on-device Swift implementations of pitch/onset/notation

This gets the app into TestFlight in weeks instead of months while keeping a clear path to fully-native v2.

### Why staged
- Reuses 95% of frontend code and 100% of backend code initially
- Lets us validate the iOS UX (the hardest unknown — touch interactions on a tiny notation grid) before sinking effort into native rewrite
- Native modules can be added one at a time; each release improves a piece

### Where Claude Design plugs in
**Before C2 (Xcode setup), we run Claude Design.**

- **Inputs:** feature list, target form factors (iPhone 15 / iPad 12.9" / Mac windowed), data models (`NoteData`, `Project`)
- **Style:** the user wants to see 3 mockups before deciding — minimalist Apple HIG, skeuomorphic music-paper, colorful/Yousician
- **Outputs:** 8 key screens × 3 form factors, in 3 styles → 72 mockups; user picks one style, we proceed with that SwiftUI starter

### Track C high-level outline

| ID  | What                                                                                  |
|-----|---------------------------------------------------------------------------------------|
| C0  | Confirm staged B→A architecture, capture in `instructions/06-IOS-ARCHITECTURE.md`     |
| **C1** | **🎨 Claude Design — generate 8 screens × 3 form factors × 3 styles → user picks one** |
| C2  | Xcode universal SwiftUI project skeleton (iOS 17+, macOS 14+, Mac Catalyst on)        |
| C3  | Backend deployment to fly.io (shared with Track B bot)                                |
| C4  | WKWebView wrapper showing existing React app; bridge for native APIs (mic, files)     |
| C5  | Native AVAudioEngine recording → upload to backend (replaces web MediaRecorder)       |
| C6  | iCloud Documents integration for `.melody` files                                      |
| C7  | Native PDFKit export (replaces frontend jspdf path on iOS/Mac)                        |
| C8  | TestFlight beta — wife + 3 students                                                   |
| C9  | App Store submission                                                                  |
| C10 | (post-1.0) replace WKWebView notation with native SwiftUI Canvas                      |
| C11 | (post-1.0) replace cloud pitch/onset with on-device Swift via Accelerate + AVAudioEngine |
| C12 | (post-1.0) Android port (if demand exists)                                            |

Track C prompts are **outlines, not full prompts** in `05-SONNET-PROMPTS.md`. Full prompts will be written after C1's design output is in hand — design dictates structure.

---

## 7. Cross-Track Dependencies

```
Track A  ──── completes Mac MVP ───────────────┐
              + tests transcription logic      │
                                                │
Track B  ──── reuses Python backend            │
              from Track A                     │
                                                │
              after A + B running in            ▼
              production with real users  →   Track C
              (their feedback shapes design)
```

The Python backend in `backend/app/` is the **shared core** across all three tracks. Track B deploys it as a worker; Track C calls it from the iOS app (Approach B phase). Treat backend changes carefully — they affect all three.

---

## 8. Out of Scope (decided, do not revisit casually)

| Out of scope                                  | Why                                                                 |
|-----------------------------------------------|---------------------------------------------------------------------|
| LLM verification (Ollama / cloud LLMs)        | Replaced with deterministic theory checker — works offline, no cost |
| LilyPond on desktop                           | Replaced with VexFlow→jsPDF (Track A) + MuseScore CLI (Track B bot) |
| Polyphonic transcription                      | pyin is monophonic-only by design; not what the wife needs          |
| Real-time live transcription (mic→notes streaming) | "Record then transcribe" UX is enough; saves complexity         |
| Tauri Mobile                                  | Evaluated. SwiftUI gives better Apple-platform UX                   |
| Android                                       | Not in user's target devices; revisit only if Track C succeeds      |

---

## 9. Decisions Made

1. **Track order: A → B → C** (sequential, no parallel work)
2. **Track C architecture: staged B → A** (WKWebView shell first, native modules later)
3. **Visual style: explored via Claude Design** — 3 styles generated, user picks after seeing all
4. **App Store pricing:** deferred until Track C nears completion
5. **Tauri rejected** for Track C (already documented in `03-TAURI-EVALUATION.md`)
6. **Theory checker stays deterministic** — no LLM
