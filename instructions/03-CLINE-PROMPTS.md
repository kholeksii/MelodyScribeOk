# MelodyScribe — Промпти для Cline (локальна LLM, 4k контекст)

## Як використовувати

Кожен промпт нижче — **самодостатня задача** для локальної AI з контекстом ~4000 токенів.

**Правила роботи з Cline:**

1. Виконуй промпти строго по порядку (P01, P02, ...)
2. Один промпт = одна задача = один коміт
3. Переконайся що попередній крок працює перед наступним
4. Якщо AI вичерпує контекст — скороти промпт, залишивши тільки файл + задачу

**Передай AI один раз на початку (System Prompt для Cline):**

```
Ти — Senior Developer. Проект: MelodyScribe — розпізнавання мелодій.
Stack: Python/FastAPI бекенд, React/Electron/TypeScript фронтенд.
Правила: type hints (Python), strict TS, функціональні React компоненти, max 200 рядків/файл.
Відповідай тільки кодом. Без пояснень якщо не просять.
```

---

## ФАЗА 1 — Backend Foundation

### P01: Ініціалізація Python проекту

```
Створи Python проект в папці backend/:
1. pyproject.toml з metadata (name=melody-scribe-backend, version=0.1.0, python>=3.11)
2. requirements.txt:
   fastapi==0.111.0
   uvicorn[standard]==0.30.0
   python-multipart==0.0.9
   pydantic==2.7.0
   librosa==0.10.2
   numpy==1.26.4
   pydub==0.25.1
3. backend/app/__init__.py (порожній)
4. backend/app/main.py — FastAPI app з GET /api/health що повертає {"success": true, "data": {"status": "ok"}}
5. backend/app/config.py — Settings клас (BaseSettings): UPLOAD_DIR="./uploads", MAX_AUDIO_LENGTH_SEC=600, OLLAMA_URL="http://localhost:11434"

Структура:
backend/
  app/
    __init__.py
    main.py
    config.py
  requirements.txt
  pyproject.toml
```

### P02: Pydantic моделі

```
Створи файли моделей в backend/app/models/:

1. __init__.py (порожній)

2. audio.py:
   - AudioUploadResponse(success: bool, data: AudioInfo)
   - AudioInfo(file_id: str, duration_sec: float, sample_rate: int, format: str)

3. note.py:
   - NoteData(id: str, pitch: str, duration: str, start_beat: float, measure: int, velocity: int, confidence: float, llm_corrected: bool = False)
   - TranscriptionResult(success: bool, data: TranscriptionData)
   - TranscriptionData(notes: list[NoteData], tempo: int, key: str, time_signature: str, instrument: str)

4. project.py:
   - ProjectMetadata(title: str, instrument: str, tempo: int, time_signature: str = "4/4", key: str = "C")
   - Project(version: str = "1.0", metadata: ProjectMetadata, notes: list[NoteData])

Всі моделі наслідують pydantic.BaseModel. Використовуй type hints.
```

### P03: Audio Service — завантаження файлів

```
Створи backend/app/services/audio_service.py:

class AudioService:
  - __init__(self): створює UPLOAD_DIR якщо не існує
  - async upload_file(self, file: UploadFile) -> AudioInfo:
    1. Перевіри розширення (.wav, .mp3, .flac, .ogg) — інакше raise ValueError
    2. Збережи файл в UPLOAD_DIR з UUID іменем
    3. Завантаж через librosa.load(path, sr=44100, mono=True)
    4. Перевіри тривалість <= MAX_AUDIO_LENGTH_SEC
    5. Поверни AudioInfo(file_id, duration, 44100, format)

Створи backend/app/services/__init__.py (порожній).
Використовуй config.Settings для налаштувань.
```

### P04: API route — upload

```
Створи backend/app/api/__init__.py та backend/app/api/routes/audio.py:

Router з prefix="/api":
  POST /api/upload:
    - Приймає: file: UploadFile
    - Валідує та зберігає через AudioService
    - Повертає AudioUploadResponse
    - Обробляє ValueError → 400, Exception → 500

Підключи роутер в main.py через app.include_router().
```

### P05: Pitch Detector (CREPE)

```
Додай crepe==0.0.16 в requirements.txt.

Створи backend/app/core/__init__.py та backend/app/core/pitch_detector.py:

INSTRUMENT_RANGES = {
    "violin": (196.0, 2637.0),
    "piano": (27.5, 4186.0),
    "guitar": (82.0, 1319.0),
}

class PitchDetector:
  - detect(self, audio: np.ndarray, sr: int, instrument: str) -> list[dict]:
    1. Використай crepe.predict(audio, sr, model_capacity='medium', step_size=10)
    2. Отримай: time, frequency, confidence, activation
    3. Відфільтруй confidence < 0.7
    4. Відфільтруй частоти за межами INSTRUMENT_RANGES[instrument]
    5. Конвертуй frequency → note name через librosa.hz_to_note()
    6. Поверни [{"time_ms": float, "frequency": float, "note": str, "confidence": float}, ...]
```

### P06: Onset Detector

```
Додай aubio==0.4.9 в requirements.txt.

Створи backend/app/core/onset_detector.py:

class OnsetDetector:
  - detect(self, audio: np.ndarray, sr: int) -> list[float]:
    1. Конвертуй audio у формат для aubio (float32, правильний розмір буфера)
    2. Створи aubio.onset("default", buf_size=1024, hop_size=512, samplerate=sr)
    3. Пройди по аудіо блоками hop_size, збираючи onset timestamps
    4. Додатково: librosa.onset.onset_detect(y=audio, sr=sr, units='time')
    5. Об'єднай результати, видали дублікати ближче 50мс
    6. Поверни відсортований list[float] з onset timestamps в секундах
```

### P07: Tempo та Key Detection

```
Створи backend/app/core/tempo_detector.py:

class TempoDetector:
  - detect(self, audio: np.ndarray, sr: int) -> int:
    1. tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
    2. Поверни round(float(tempo))

Створи backend/app/core/key_detector.py:

class KeyDetector:
  - detect(self, audio: np.ndarray, sr: int) -> str:
    1. Обчисли chromagram: librosa.feature.chroma_cqt(y=audio, sr=sr)
    2. Сума по часу для кожного pitch class
    3. Знайди тональність через Krumhansl-Schmuckler алгоритм
       (кореляція профілю з мажорними/мінорними шаблонами)
    4. Поверни str, напр. "C major" або "A minor"

Підказка для key profiles:
major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
```

### P08: Quantizer (квантизація тривалостей)

```
Створи backend/app/core/quantizer.py:

DURATION_MAP (при заданому BPM):
  whole=4, half=2, quarter=1, eighth=0.5, sixteenth=0.25
  Також: dotted варіанти (*1.5)

class Quantizer:
  - quantize_duration(self, duration_sec: float, bpm: int) -> str:
    1. Конвертуй duration_sec у beats: duration_sec * bpm / 60
    2. Знайди найближче значення у DURATION_MAP
    3. Поверни назву ("quarter", "eighth", тощо)

  - quantize_notes(self, raw_notes: list[dict], bpm: int) -> list[dict]:
    1. Для кожної ноти квантизуй duration
    2. Розрахуй start_beat та measure (при time_signature 4/4)
    3. Поверни список з квантизованими полями
```

### P09: Segmentation Service

```
Створи backend/app/services/segmentation_service.py:

class SegmentationService:
  Залежності: PitchDetector, OnsetDetector, TempoDetector, KeyDetector, Quantizer

  - transcribe(self, file_path: str, instrument: str) -> TranscriptionData:
    1. Завантаж аудіо: librosa.load(file_path, sr=44100, mono=True)
    2. Trim тишу: librosa.effects.trim()
    3. Detect pitch: PitchDetector.detect()
    4. Detect onsets: OnsetDetector.detect()
    5. Detect tempo: TempoDetector.detect()
    6. Detect key: KeyDetector.detect()
    7. Для кожної пари onset[i]..onset[i+1]:
       - Зібрати pitch values з pitch data для цього діапазону часу
       - Медіана pitch = pitch ноти
       - Duration = onset[i+1] - onset[i]
       - Якщо медіана confidence < 0.5 → це пауза
    8. Quantizer.quantize_notes()
    9. Створити NoteData об'єкти з UUID id
    10. Повернути TranscriptionData

Один метод, що об'єднує весь pipeline.
```

### P10: API route — transcribe

```
Створи backend/app/api/routes/transcribe.py:

Router:
  POST /api/transcribe:
    - Body JSON: {"file_id": str, "instrument": str}
    - Валідуй instrument in ["violin", "piano", "guitar"]
    - Знайди файл по file_id в UPLOAD_DIR
    - Виклич SegmentationService.transcribe()
    - Поверни TranscriptionResult
    - Error handling: 400 (bad input), 404 (file not found), 500

Підключи в main.py.
```

---

## ФАЗА 2 — Frontend MVP

### P11: Electron + React scaffold

```
Створи frontend/ з Vite + React + TypeScript + Electron:

1. package.json з залежностями:
   react, react-dom, vexflow, zustand, tailwindcss, electron, vite,
   @types/react, typescript, postcss, autoprefixer

2. vite.config.ts — стандартний React конфіг

3. tsconfig.json — strict: true

4. tailwind.config.js — content: ["./src/**/*.{ts,tsx}"]

5. src/main.tsx — React root render

6. src/App.tsx — заглушка з <h1>MelodyScribe</h1>

7. electron/main.ts — BrowserWindow що відкриває localhost:5173

8. electron/preload.ts — пустий preload script

9. package.json scripts: "dev": "vite", "electron": "electron ."

Мінімальний scaffold без логіки.
```

### P12: TypeScript types

```
Створи frontend/src/types/:

1. note.ts:
   interface NoteData { id: string; pitch: string; duration: string; startBeat: number; measure: number; velocity: number; confidence: number; llmCorrected: boolean; }

2. project.ts:
   interface ProjectMetadata { title: string; instrument: string; tempo: number; timeSignature: string; key: string; }
   interface Project { version: string; metadata: ProjectMetadata; notes: NoteData[]; }
   interface TranscriptionResult { success: boolean; data: TranscriptionData; }
   interface TranscriptionData { notes: NoteData[]; tempo: number; key: string; timeSignature: string; instrument: string; }

3. audio.ts:
   interface AudioInfo { fileId: string; durationSec: number; sampleRate: number; format: string; }
   type Instrument = "violin" | "piano" | "guitar";

Експортуй всі типи.
```

### P13: API client

```
Створи frontend/src/services/apiClient.ts:

const BASE_URL = "http://localhost:8000/api";

- uploadAudio(file: File): Promise<AudioInfo>
  POST /api/upload, FormData з файлом

- transcribe(fileId: string, instrument: Instrument): Promise<TranscriptionData>
  POST /api/transcribe, JSON body

- verifyNotes(notes: NoteData[], instrument: string, tempo: number, key: string): Promise<any>
  POST /api/verify, JSON body

- exportPdf(project: Project): Promise<Blob>
  POST /api/export/pdf, JSON body, responseType blob

Використовуй fetch(). Обробляй HTTP errors.
```

### P14: Zustand Store

```
Створи frontend/src/store/projectStore.ts:

Zustand store:
interface ProjectState {
  notes: NoteData[];
  metadata: ProjectMetadata | null;
  audioFileId: string | null;
  selectedNoteId: string | null;
  isLoading: boolean;
  error: string | null;

  setNotes: (notes: NoteData[]) => void;
  updateNote: (id: string, updates: Partial<NoteData>) => void;
  deleteNote: (id: string) => void;
  insertNote: (afterId: string, note: NoteData) => void;
  setMetadata: (meta: ProjectMetadata) => void;
  setSelectedNote: (id: string | null) => void;
  setAudioFileId: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

Реалізуй з create<ProjectState>().
```

### P15: File Upload компонент

```
Створи frontend/src/components/AudioControls/FileUpload.tsx:

Props: onUploadComplete: (audioInfo: AudioInfo) => void

Функціонал:
1. Drag-and-drop зона або кнопка вибору файлу
2. Приймає .wav, .mp3, .flac, .ogg
3. При drop/select — викликає apiClient.uploadAudio()
4. Показує прогрес (loading spinner)
5. При успіху — викликає onUploadComplete
6. При помилці — показує повідомлення

Створи frontend/src/components/AudioControls/InstrumentSelector.tsx:
Dropdown з варіантами: Violin, Piano, Guitar.
Props: value: Instrument, onChange: (v: Instrument) => void

Стилізація: TailwindCSS, простий але чистий дизайн.
```

### P16: Notation Display (read-only VexFlow)

```
Створи frontend/src/components/NotationEditor/NotationDisplay.tsx:

Props: notes: NoteData[], timeSignature: string, keySignature: string

Функціонал:
1. Canvas ref для VexFlow рендерингу
2. useEffect при зміні notes:
   a. Створити VexFlow Renderer (SVG backend)
   b. Згрупувати ноти по measures
   c. Для кожного measure:
      - Створити Stave з відповідним clef (treble)
      - Конвертувати NoteData → VexFlow StaveNote
      - Pitch "C4" → VexFlow "c/4"
      - Duration "quarter" → VexFlow "q"
   d. Відмалювати все

Mapping duration:
  whole→"w", half→"h", quarter→"q", eighth→"8", sixteenth→"16"

Поки read-only, без кліків.
```

### P17: Main Page — з'єднання всіх компонентів

```
Оновити frontend/src/App.tsx:

Layout (TailwindCSS):
1. Header: назва MelodyScribe + InstrumentSelector
2. Main area:
   - Якщо немає нот: FileUpload компонент
   - Якщо є ноти: NotationDisplay
3. Footer: metadata (tempo, key, time signature)

Логіка:
1. Після upload → зберегти audioFileId в store
2. Кнопка "Transcribe" → apiClient.transcribe(fileId, instrument)
3. Результат → setNotes() + setMetadata() в store
4. NotationDisplay рендерить ноти

Стани: uploading, transcribing, ready, error — з відповідними UI.
```

---

## ФАЗА 3 — Інтерактивний редактор

### P18: Клікабельні ноти

```
Оновити NotationDisplay.tsx → NotationEditor.tsx:

Додай інтерактивність:
1. Кожна нота при рендерингу зберігає свій bounding box
2. onClick на SVG → визначити яка нота під курсором
3. Виділена нота: інший колір (синій) та обводка
4. Зберігати selectedNoteId в store

Створи Map<string, {x, y, width, height}> для bounding boxes нот.
При кліку — перебери map, знайди яка нота під координатами.
```

### P19: Note Toolbar

```
Створи frontend/src/components/NotationEditor/NoteToolbar.tsx:

Показується коли виділена нота. Містить кнопки:

1. Pitch: ▲ (pitch up) / ▼ (pitch down) — на пів-тону
2. Duration: W H Q 8 16 (whole, half, quarter, eighth, sixteenth)
3. Delete: видалити ноту
4. Add Rest: вставити паузу після ноти

Кожна кнопка:
- Читає selectedNoteId зі store
- Викликає updateNote() або deleteNote() в store
- NotationEditor перерендерюється автоматично

Pitch up/down: використати масив ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
Зміщення по індексу + обробка октави.
```

### P20: Playback (Tone.js)

```
Створи frontend/src/components/Playback/PlaybackControls.tsx:

Кнопки: Play, Stop, метроном toggle.

Створи frontend/src/hooks/usePlayback.ts:

Функціонал:
1. Ініціалізувати Tone.js Synth: new Tone.Synth().toDestination()
2. play(notes: NoteData[], bpm: number):
   - Tone.Transport.bpm.value = bpm
   - Для кожної ноти:
     - Розрахувати час: startBeat * (60/bpm)
     - synth.triggerAttackRelease(note, duration, time)
   - Tone.Transport.start()
3. stop(): Tone.Transport.stop()

Mapping pitch: "C4" → "C4" (Tone.js використовує той самий формат)
Mapping duration: "quarter" → "4n", "eighth" → "8n", "half" → "2n", "whole" → "1n"
```

---

## ФАЗА 4 — LLM + PDF

### P21: LLM Service (Backend)

```
Створи backend/app/services/llm_service.py:

class LLMService:
  - __init__(self): self.ollama_url з config, self.model = "mistral"

  - async verify(self, notes: list[NoteData], instrument: str, tempo: int, key: str) -> dict:
    1. Конвертуй notes в ABC notation string
    2. Сформуй промпт (шаблон з 02-AI-INSTRUCTIONS.md)
    3. POST на {ollama_url}/api/generate з {"model": self.model, "prompt": prompt, "stream": false}
    4. Парси JSON з response
    5. Timeout 30 сек, при помилці → повернути {"corrections": [], "confidence": 0, "error": "LLM unavailable"}

  - _notes_to_abc(self, notes: list[NoteData]) -> str:
    Конвертуй NoteData[] у спрощений ABC notation.

Створи backend/app/api/routes/verify.py:
  POST /api/verify — приймає notes + metadata, повертає LLM corrections.

Підключи в main.py.
```

### P22: Suggestions Panel (Frontend)

```
Створи frontend/src/components/LLMPanel/SuggestionsPanel.tsx:

Props: corrections: Correction[]
type Correction = {noteIndex: number, field: string, oldValue: string, newValue: string, reason: string}

UI:
1. Список карток-пропозицій від LLM
2. Кожна картка: "Note #N: змінити {field} з {old} на {new}. Причина: {reason}"
3. Кнопки: ✅ Accept / ❌ Reject на кожній картці
4. "Accept All" кнопка зверху
5. Accept → updateNote в store

Створи кнопку "Verify with AI" в Toolbar.
При натисканні → apiClient.verifyNotes() → показати SuggestionsPanel.
```

### P23: PDF Export (Backend)

```
Створи backend/app/services/pdf_service.py:

class PDFService:
  - export(self, project: Project) -> bytes:
    1. Конвертуй notes в LilyPond notation string
    2. Запиши .ly файл у temp directory
    3. Виклич subprocess: lilypond --pdf -o /tmp/output file.ly
    4. Прочитай output.pdf як bytes
    5. Очисти temp файли
    6. Поверни bytes

  - _to_lilypond(self, project: Project) -> str:
    note_map = {"C": "c", "D": "d", ...}
    duration_map = {"whole": "1", "half": "2", "quarter": "4", "eighth": "8", "sixteenth": "16"}
    Побудуй LilyPond string з header + \relative c' { ... }

Створи backend/app/api/routes/export.py:
  POST /api/export/pdf — приймає Project JSON, повертає PDF file (StreamingResponse із media_type application/pdf).

Підключи в main.py.
```

### P24: Export UI (Frontend)

```
Створи frontend/src/components/Toolbar/ExportMenu.tsx:

Кнопка "Export PDF" в toolbar:
1. Зібрати Project з store (metadata + notes)
2. Виклик apiClient.exportPdf(project)
3. Отримати Blob → створити download link
4. Автоматичне скачування PDF

Реалізація download:
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${metadata.title || 'melody'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
```

---

## ФАЗА 5 — Мікрофон + Polish

### P25: Запис з мікрофона

```
Створи frontend/src/hooks/useAudioRecorder.ts:

Hook:
  - isRecording: boolean
  - startRecording(): void
  - stopRecording(): Promise<Blob>

Реалізація:
1. navigator.mediaDevices.getUserMedia({ audio: true })
2. MediaRecorder API для запису
3. При stop → зібрати chunks у Blob (audio/wav)

Створи frontend/src/components/AudioControls/RecordButton.tsx:
Кнопка з станами: Ready (🎙), Recording (⏺ червона, пульсує), Processing.
При stop → upload blob як файл через apiClient.uploadAudio().
```

### P26: Project Save/Load

```
Backend:
Створи backend/app/api/routes/project.py:
  POST /api/project/save — приймає Project JSON, зберігає у файл, повертає project_id
  POST /api/project/load — приймає project_id, повертає Project JSON

Frontend:
Додай в Toolbar кнопки Save / Load.
Save: зібрати Project з store → apiClient → підтвердження.
Load: file picker для .json → apiClient → завантажити в store.
```

### P27: Error Handling + Edge Cases

```
Backend:
1. Додай middleware для global exception handling в main.py
2. Логування через logging module
3. Валідація: пустий аудіо файл, тиша (без нот), формат

Frontend:
1. Error boundary компонент
2. Toast notifications для помилок
3. Loading states для всіх async операцій
4. Disabled states для кнопок під час завантаження
```

### P28: Фінальна інтеграція та тестування

```
Backend тести (pytest):
1. tests/test_pitch_service.py — мок аудіо, перевірити що detect повертає ноти
2. tests/test_segmentation.py — мок pitch/onset data, перевірити квантизацію
3. tests/test_api.py — FastAPI TestClient, тест upload + transcribe endpoints

Frontend тести (vitest):
1. Тест store actions (setNotes, updateNote, deleteNote)
2. Тест apiClient (mock fetch)
3. Тест FileUpload component render

Запуск: pytest backend/ && cd frontend && npx vitest run
```

---

## Шпаргалка: порядок запуску

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Ollama (окремий термінал)
ollama serve
ollama pull mistral

# 3. LilyPond (встановити)
# Windows: choco install lilypond
# Mac: brew install lilypond
# Linux: sudo apt install lilypond

# 4. Frontend
cd frontend
npm install
npm run dev

# 5. Electron
npm run electron
```
