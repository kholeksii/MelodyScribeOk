# MelodyScribe — E2E Smoke Checklist

Run these checks after each release build to confirm the app is working end-to-end.

## Launch & Onboarding
- [ ] Launch app (dev or packaged build)
- [ ] First-run tour shows (3 steps, purple tooltip at bottom)
- [ ] Clicking "Skip" hides the tour permanently (reload → no tour)
- [ ] Completing all 3 steps hides the tour permanently (reload → no tour)

## Audio Input
- [ ] Upload `tests/ДоМіРеДо-2ї.m4a` via drag-and-drop → upload success indicator
- [ ] Alternatively: click Record → speak a short melody → click to stop → upload completes

## Transcription
- [ ] With file uploaded, set BPM=120 in TranscribeOptions
- [ ] Set Key = C major
- [ ] Click "Transcribe Audio" → spinner shows → notes appear in notation view
- [ ] Leave BPM blank on a second transcription → behaves as before (auto-detect)

## Notation & Editing
- [ ] Notes displayed on staff with correct key signature
- [ ] Click a note → NoteToolbar shows pitch + duration controls
- [ ] Click "↑ All up" → all note pitches shift up one octave
- [ ] Click "↓ All down" → pitches revert
- [ ] Ctrl+Z (Cmd+Z) → undo last octave shift

## Playback
- [ ] Click Play → audio cursor moves across notes
- [ ] Stop button appears during playback; click it → playback stops and cursor resets
- [ ] Playback auto-stops at end of last note

## Save & Load
- [ ] Edit a note → click "Save Project" → file `*.melody` downloads
- [ ] Reload page → recent list shows the saved filename on landing screen
- [ ] Click "Open Project" → pick the `.melody` file → notes and metadata restored
- [ ] Audio is preserved for replay after Open Project

## Export
- [ ] Click "Export PDF" → PDF downloads → opens correctly in Preview with notes visible
- [ ] Click "Export MusicXML" → file downloads → opens correctly in MuseScore

## Recording
- [ ] Click "Record" button → browser requests microphone permission
- [ ] Speak/sing a short melody → click to stop → uploads automatically
- [ ] Transcribe the recording → notes appear

## Error Handling
- [ ] Stop the backend server → click "Transcribe" → toast notification appears (no white screen / no alert)
- [ ] Backend error response for missing ffmpeg → 422 returned → toast shows the ffmpeg message

## Microphone Permission
- [ ] On macOS: allow microphone access in System Settings → Privacy → Microphone → MelodyScribe
