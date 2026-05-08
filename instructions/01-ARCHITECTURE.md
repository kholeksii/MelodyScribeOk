# MelodyScribe — Architecture Document

## 1. Огляд проекту

**MelodyScribe** — десктопний додаток для автоматичного розпізнавання мелодій (фортепіано, скрипка, гітара) з аудіо та конвертації їх у нотний запис з можливістю редагування та експорту в PDF/MusicXML.

---

## 2. Функціональні вимоги

| #   | Функція             | Опис                                                       |
| --- | ------------------- | ---------------------------------------------------------- |
| F1  | Захоплення аудіо    | Запис мелодії з мікрофона в реальному часі                 |
| F2  | Імпорт файлу        | Завантаження аудіофайлу (WAV, MP3, FLAC, OGG)              |
| F3  | Вибір інструменту   | Користувач обирає: фортепіано / скрипка / гітара           |
| F4  | Pitch Detection     | Розпізнавання висоти нот (monophonic)                      |
| F5  | Onset Detection     | Визначення початку/кінця кожної ноти                       |
| F6  | Note Segmentation   | Визначення тривалості нот та пауз                          |
| F7  | Theory Verification | Автоматична перевірка помилок правилами музичної теорії    |
| F8  | Notation Editor     | Візуальний редактор нотного запису                         |
| F9  | PDF/MusicXML Export | Генерація PDF (VexFlow→SVG→PDF) та MusicXML (music21)     |
| F10 | Збереження проекту  | Збереження/завантаження проекту у власному форматі (JSON)  |

---

## 3. Архітектура високого рівня

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

## 4. Технологічний стек

### 4.1 Frontend

| Технологія      | Призначення                       |
| --------------- | --------------------------------- |
| **Electron**    | Десктопна оболонка                |
| **React 18**    | UI фреймворк                      |
| **TypeScript**  | Типізація                         |
| **VexFlow**     | Рендеринг нотного запису          |
| **Tone.js**     | Програвання нот для перевірки     |
| **TailwindCSS** | Стилізація                        |
| **jsPDF**       | Генерація PDF з SVG (VexFlow)     |

### 4.2 Backend

| Технологія       | Призначення                                 |
| ---------------- | ------------------------------------------- |
| **Python 3.11+** | Основна мова бекенду                        |
| **FastAPI**      | HTTP API сервер                             |
| **librosa**      | Аналіз аудіо + pitch detection (pyin)       |
| **aubio**        | Onset detection                             |
| **music21**      | Музична нотація, теорія, MusicXML експорт   |
| **pydub**        | Конвертація аудіо форматів                  |

---

## 5. Модулі системи

### 5.1 Audio Input Module

```
Вхід:  мікрофон (WebAudio → PCM) або файл (WAV/MP3/FLAC/OGG)
Вихід: нормалізований WAV моно 44100Hz 16-bit
```

- Використовує `PyAudio` для захоплення з мікрофона
- `pydub` / `ffmpeg` для конвертації форматів
- Нормалізація гучності, видалення тиші на початку/кінці

### 5.2 Pitch Detection Engine

```
Вхід:  нормалізований WAV + тип інструменту
Вихід: масив [(timestamp_ms, frequency_hz, confidence), ...]
```

- **librosa.pyin** — probabilistic YIN для pitch detection (монофонічні інструменти)
- Параметри адаптуються під інструмент:
  - Фортепіано: діапазон A0–C8 (27.5–4186 Hz)
  - Скрипка: діапазон G3–E7 (196–2637 Hz)
  - Гітара: діапазон E2–E6 (82–1319 Hz)
- Фільтрація низькоякісних детекцій (confidence < 0.7)

### 5.3 Note Segmentation Module

```
Вхід:  pitch data + raw audio
Вихід: масив [{pitch, start_ms, duration_ms, velocity}, ...]
```

- **aubio** onset detection для визначення атак нот
- Об'єднання сусідніх фреймів з однаковим pitch у ноти
- Квантизація тривалості до музичних значень (ціла, половинна, четвертна, восьма, шістнадцята)
- Визначення пауз між нотами
- Автовизначення темпу (BPM) через `librosa.beat.beat_track`

### 5.4 Theory Verification Module

```
Вхід:  список нот + метадані (інструмент, темп, тональність)
Вихід: список корекцій з поясненнями + confidence score
```

- Детерміновані правила на базі music21:
  - Перевірка діапазону інструменту
  - Виявлення нереалістичних інтервальних стрибків (>октави)
  - Перевірка заповненості тактів (сума тривалостей = time signature)
  - Енгармонічна нормалізація відповідно до тональності
- Повертає JSON з корекціями та confidence score

### 5.5 Notation Editor (Frontend)

- VexFlow рендерить ноти на canvas
- Інтерактивне редагування:
  - Клік на ноту → зміна висоти (drag up/down)
  - Зміна тривалості ноти (панель інструментів)
  - Додавання/видалення нот
  - Додавання пауз
  - Зміна темпу, тональності, тактового розміру
- Програвання мелодії через Tone.js для перевірки
- Паралельне відображення оригінального аудіо (waveform)

### 5.6 Export Module

- **PDF**: VexFlow рендерить ноти у SVG → `jsPDF` + `svg2pdf.js` конвертують у PDF (повністю у фронтенді)
- **MusicXML**: `music21` конвертує внутрішній формат у MusicXML (на бекенді)
- Підтримка MuseScore, Finale, Sibelius через MusicXML

---

## 6. API Endpoints (Backend)

```
POST /api/upload          — завантаження аудіофайлу
POST /api/record/start    — початок запису з мікрофона
POST /api/record/stop     — зупинка запису
POST /api/transcribe      — розпізнавання нот з аудіо
POST /api/verify          — верифікація нот (правила музичної теорії)
POST /api/export/musicxml — експорт у формат MusicXML
POST /api/project/save    — збереження проекту
POST /api/project/load    — завантаження проекту
GET  /api/health          — health check
```

---

## 7. Формат даних (внутрішній)

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
      "llmCorrected": false
    }
  ],
  "audioFile": "base64_or_path",
  "theorySuggestions": []
}
```

### 7.2 Pitch Notation

- Наукова нотація: C4 = Middle C, A4 = 440Hz
- Дієзи: C#4, Бемолі: Bb4

---

## 8. Структура проекту (файлова)

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
│   ├── 01-ARCHITECTURE.md     # Цей файл
│   ├── 02-AI-INSTRUCTIONS.md
│   └── 03-CLINE-PROMPTS.md
│
├── .env.example
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## 9. Порядок розробки (фази)

### Фаза 1 — Фундамент (Backend Core)

1. Налаштування Python проекту + FastAPI
2. Audio Input Module (завантаження файлів, конвертація)
3. Pitch Detection Engine (librosa.pyin integration)
4. Onset Detection + Note Segmentation
5. Базовий API: upload → transcribe → JSON

### Фаза 2 — Frontend MVP

6. Electron + React scaffold
7. File Upload UI
8. VexFlow нотний рендеринг (read-only)
9. З'єднання Frontend ↔ Backend API

### Фаза 3 — Редактор

10. Інтерактивний Notation Editor (edit notes)
11. Toolbar (instrument, tempo, key)
12. Playback через Tone.js з синхронізацією курсора
13. Undo/Redo в редакторі
14. Confidence heatmap на нотах

### Фаза 4 — Верифікація + Експорт

15. Theory Checker (правила музичної теорії через music21)
16. Suggestions Panel UI
17. MusicXML Export (music21)
18. PDF Export (VexFlow → SVG → jsPDF)

### Фаза 5 — Polish

19. Запис з мікрофона (real-time)
20. Project save/load
21. Error handling + edge cases
22. Тестування на реальних мелодіях
23. PyInstaller бандлінг бекенду

---

## 10. Нефункціональні вимоги

| Вимога                  | Значення                                   |
| ----------------------- | ------------------------------------------ |
| Latency (transcription) | < 10 сек для 1 хв аудіо                    |
| Accuracy (pitch)        | > 90% для монофонічних мелодій             |
| Supported formats       | WAV, MP3, FLAC, OGG                        |
| Max audio length        | 10 хвилин                                  |
| PDF quality             | 300 DPI, стандартний нотний формат         |
| Offline mode            | Повна функціональність без інтернету       |
| OS                      | Windows 10+, macOS 12+, Linux (Ubuntu 22+) |

---

## 11. Ризики та мітигації

| Ризик                     | Імовірність | Мітигація                                                      |
| ------------------------- | ----------- | -------------------------------------------------------------- |
| Поліфонічні фрагменти     | Висока      | Попередження користувачу; підтримка тільки монофонії           |
| Шум у записі              | Середня     | Noise gate + bandpass фільтр під інструмент                    |
| Неточна квантизація ритму | Висока      | Theory checker корекція + ручне редагування                    |
| VexFlow SVG→PDF якість    | Низька      | Fallback на MusicXML → MuseScore CLI                           |
