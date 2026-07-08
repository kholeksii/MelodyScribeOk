// English dictionary — the source of truth for TranslationKey.
// Keep flat; placeholders use {name} syntax (see format() in index.ts).
export const en = {
  // Upload screen
  recentProjects: 'Recent projects',
  recentHint: 'Use "Open" to reopen a saved file.',
  today: 'today',
  transcribe: 'Transcribe Audio',
  transcribing: 'Transcribing...',
  transcriptionFailed: 'Transcription failed',
  transcription: 'Transcription',

  // FileUpload / RecordButton
  uploadTitle: 'Upload audio file',
  uploadHint: 'Drag and drop or click to select WAV, MP3, FLAC, OGG, or M4A file',
  chooseFile: 'Choose file',
  uploading: 'Uploading...',
  uploadFailed: 'Upload failed',
  unsupportedFormat: 'Unsupported file format. Please use WAV, MP3, FLAC, OGG, or M4A.',
  or: 'or',
  tryDemo: 'Try a demo melody',
  demoLoading: 'Transcribing demo…',
  dropAnywhereTitle: 'Drop your audio here',
  dropAnywhereHint: 'WAV, MP3, FLAC, OGG or M4A',
  record: 'Record',
  recordingStop: '{s}s — click to stop',
  processing: 'Processing...',

  // Instruments
  instrument: 'Instrument',
  violin: 'Violin',
  piano: 'Piano',
  guitar: 'Guitar',

  // TranscribeOptions
  auto: 'auto',
  tapTempo: 'Tap tempo',
  tapProgress: 'Tap {n}/4...',
  tapHint: 'Tap at least 4 times to the beat',
  time: 'Time',
  key: 'Key',

  // Editor top bar
  projectTitle: 'Project title',
  untitled: 'Untitled',
  undo: 'Undo',
  redo: 'Redo',
  undoTitle: 'Undo (Ctrl+Z)',
  redoTitle: 'Redo (Ctrl+Shift+Z)',
  save: 'Save',
  saveTitle: 'Save project as .melody file',
  open: 'Open',
  openTitle: 'Open a .melody project file',
  openFailed: 'Failed to open project',
  newProject: 'New',
  newProjectTitle: 'Start a new transcription',

  // Export / import
  exportPdf: 'Export PDF',
  exportPdfTitle: 'Export notation as PDF',
  exporting: 'Exporting…',
  exportMusicXmlTitle: 'Export to MusicXML (open in MuseScore, Finale, Sibelius)',
  importLabel: 'Import',
  importing: 'Importing…',
  importTitle: 'Import MusicXML file',
  svgNotFound: 'Notation SVG not found. Transcribe first.',
  pdfExportFailed: 'PDF export failed',
  exportFailed: 'Export failed',
  importFailed: 'Import failed',

  // Notation display
  notationEditor: 'Notation Editor',
  notesCount: 'notes: {n}',
  selected: 'Selected',
  notesLoaded: 'Notes loaded:',
  confidence: 'Confidence',
  confidenceValue: 'confidence: {p}%',
  confHigh: 'High (≥90%)',
  confMedium: 'Medium (70–90%)',
  confLow: 'Low (<70%)',
  clickToSelect: 'Click a note to select',

  // Waveform
  waveform: 'Waveform',
  waveformToggleTitle: 'Toggle waveform display',
  noteOnset: 'Note onset',
  playing: 'Playing',
  playhead: 'Playhead (click to seek)',

  // Note toolbar
  octave: 'Octave',
  allUp: 'All up',
  allUpTitle: 'Shift all notes up one octave',
  allDown: 'All down',
  allDownTitle: 'Shift all notes down one octave',
  note: 'Note',
  pitch: 'Pitch',
  pitchDownTitle: 'Pitch down (semitone)',
  pitchUpTitle: 'Pitch up (semitone)',
  duration: 'Duration',
  durWhole: 'whole',
  durHalf: 'half',
  durQuarter: 'quarter',
  durEighth: 'eighth',
  durSixteenth: 'sixteenth',
  durDotted: 'dotted {d}',
  setDurationTitle: 'Set duration to {d}',
  addRest: '+ Rest',
  addRestTitle: 'Add rest after this note',
  deleteNote: 'Delete',
  deleteNoteTitle: 'Delete this note',
  checkTheory: 'Check theory',
  checkTheoryTitle: 'Check the transcription against music theory rules',
  checking: 'Checking...',
  noNotesToCheck: 'No notes to check',
  velocity: 'Velocity',
  startBeat: 'Start',
  beat: 'beat',

  // Playback
  play: 'Play',
  playTitle: 'Play transcription',
  noPlayableNotes: 'No playable notes',
  stop: 'Stop',
  stopTitle: 'Stop playback',
  metronome: 'Metronome',
  metronomeTitle: 'Toggle metronome',
  metronomeDisabledTitle: 'Start playback to enable metronome',
  noNotes: 'No notes',
  bpmTitle: 'Tempo (40-300 BPM)',

  // Suggestions panel
  theoryResults: 'Theory Check Results',
  closePanel: 'Close panel',
  theoryConfidence: 'Check confidence:',
  acceptAll: 'Accept All ({n})',
  noteNumber: 'Note #{n}',
  changeField: 'Change',
  fieldPitch: 'pitch',
  fieldDuration: 'duration',
  accept: 'Accept',
  reject: 'Reject',
  processed: 'Processed',
  processedCount: 'Processed: {done} / {total}',

  // Tour
  tourStep: 'Step',
  tourSkip: 'Skip',
  tourNext: 'Next',
  tourStart: 'Get started',
  tour1Title: 'Upload audio',
  tour1Body: 'Drag an audio file anywhere onto the window, record from your microphone, or click “Try a demo melody” to see it in action.',
  tour2Title: 'Set BPM, key & time',
  tour2Body: 'Optionally enter BPM, time signature and key before transcribing for better accuracy.',
  tour3Title: 'Export your score',
  tour3Body: 'After transcribing, edit notes then export to PDF or MusicXML.',

  // Version badge
  version: 'Version',

  // Error boundary / API errors
  errTitle: 'Something went wrong',
  reload: 'Reload',
  errValidation: 'Invalid input data.',
  errFfmpeg: 'ffmpeg is not installed — it is required to read this audio format.',
  errBadRequest: 'Invalid request.',
  errInternal: 'Server error. Please try again.',
  errNetwork: 'Cannot reach the server. Is the backend running?',
  errUnknown: 'Unknown error',

  // Theme (U22)
  themeToggleTitle: 'Toggle dark mode',
  pdfDate: 'Exported {date}',

  // Recent projects (U20)
  fileNotFound: 'File not found — removed from the recent list.',
  openRecentTitle: 'Open {name}',

  // Autosave recovery (U19)
  recoveryPrompt: 'Restore your last session?',
  recoveryDetail: '{title} — {notes} notes, saved {when}',
  restore: 'Restore',
  discard: 'Discard',
  recoveryAudioHint: 'Audio is not kept in autosave — upload the file again to see the waveform.',

  // Keyboard shortcuts (U18)
  shortcutsTitle: 'Keyboard shortcuts',
  shortcutsHintTitle: 'Keyboard shortcuts (?)',
  close: 'Close',
  scSelect: 'Select previous / next note',
  scSemitone: 'Pitch ±1 semitone',
  scOctave: 'Pitch ±1 octave',
  scDuration: 'Duration: whole … sixteenth',
  scDotted: 'Toggle dotted duration',
  scRest: 'Toggle note ↔ rest',
  scDelete: 'Delete note',
  scInsert: 'Insert note after selection',
  scDeselect: 'Deselect',
  scPlay: 'Play / stop',
  scHelp: 'Show this help',
} as const;

export type TranslationKey = keyof typeof en;
