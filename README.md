# MelodyScribe

Десктопний застосунок для транскрипції монофонічних мелодій з аудіо у нотний запис.  
Завантажуєш WAV/MP3 → отримуєш ноти, можеш редагувати, програти, та експортувати у MusicXML (MuseScore, Sibelius, Finale).

---

## Швидкий старт (розробка)

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m uvicorn app.main:app --reload --port 8000
```

Перевірка: http://localhost:8000/api/health → `{"success": true}`  
API документація: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Відкрий http://localhost:5173 у браузері (або `npm run electron:dev` для Electron вікна).

---

## Збірка дистрибутиву (.dmg / .exe)

Потрібно: Python 3.11+, Node.js 18+, Xcode Command Line Tools (macOS).

```bash
# Зібрати все одною командою
./build.sh

# Або окремо:
./build.sh --skip-frontend   # тільки PyInstaller backend
./build.sh --skip-backend    # тільки Electron frontend
```

Результат: `frontend/dist-electron/MelodyScribe-*.dmg`

> Перший запуск `build.sh` займає 5–10 хвилин (PyInstaller пакує librosa + music21).

---

## Використання

1. **Завантажити аудіо** — перетягни WAV/MP3/FLAC/OGG або натисни "Choose file"
2. **Вибрати інструмент** — Piano / Violin / Guitar (впливає на діапазон нот)
3. **Transcribe Audio** — backend аналізує pitch, onset, tempo, квантизує ритм
4. **Переглянути ноти** — кольори відображають впевненість (зелений = точно, червоний = перевір)
5. **Редагувати** — клік на ноту → змінити pitch/тривалість у панелі; Ctrl+Z / Ctrl+Shift+Z для undo/redo
6. **Програти** — кнопка Play синхронізує курсор по нотах; метроном опційно
7. **Експорт** — Export MusicXML → відкрити у MuseScore для друку

---

## Структура проекту

```
MelodyScribeOk/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS
│   │   ├── config.py                # upload_dir, налаштування
│   │   ├── api/routes/              # HTTP endpoints
│   │   │   ├── audio.py             # POST /upload, GET /audio/{id}
│   │   │   ├── transcribe.py        # POST /transcribe
│   │   │   ├── verify.py            # POST /verify (TheoryChecker)
│   │   │   └── export.py            # POST /export/musicxml, POST /import/musicxml
│   │   ├── core/                    # Аудіо аналіз
│   │   │   ├── pitch_detector.py    # librosa.pyin
│   │   │   ├── onset_detector.py    # librosa.onset
│   │   │   ├── tempo_detector.py
│   │   │   ├── key_detector.py
│   │   │   └── quantizer.py         # beat-grid квантизація по тактах
│   │   ├── services/
│   │   │   ├── segmentation_service.py  # головний pipeline
│   │   │   ├── theory_checker.py        # правила муз. теорії (замість LLM)
│   │   │   └── pdf_service.py           # music21 → MusicXML bytes
│   │   └── models/
│   │       ├── note.py              # NoteData, TranscriptionData
│   │       └── project.py           # Project, ProjectMetadata
│   ├── run_server.py                # entry point для PyInstaller
│   ├── melodyscribe.spec            # PyInstaller spec
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # головний компонент
│   │   ├── components/
│   │   │   ├── AudioControls/       # FileUpload, InstrumentSelector
│   │   │   ├── NotationEditor/      # NotationDisplay (VexFlow), NoteToolbar
│   │   │   ├── Playback/            # PlaybackControls
│   │   │   ├── WaveformDisplay.tsx  # canvas waveform + onset markers
│   │   │   └── ExportButton.tsx     # MusicXML export/import
│   │   ├── hooks/
│   │   │   └── usePlayback.ts       # Tone.js + cursor sync
│   │   ├── store/
│   │   │   └── projectStore.ts      # Zustand: notes, undo/redo, playback
│   │   ├── services/
│   │   │   └── apiClient.ts         # HTTP клієнт до backend
│   │   └── types/                   # NoteData, Project, AudioInfo...
│   ├── electron/
│   │   └── main.ts                  # Electron main: spawn backend, waitForPort
│   ├── electron-builder.yml         # packaging config
│   ├── tsconfig.electron.json
│   └── package.json
│
├── instructions/
│   ├── 01-ARCHITECTURE.md           # детальна архітектура
│   └── 03-TAURI-EVALUATION.md       # Electron vs Tauri порівняння
├── build.sh                         # повний build pipeline
└── CLAUDE.md                        # контекст для Claude
```

---

## Стек

| Шар | Технологія |
|-----|-----------|
| Desktop shell | Electron 28 |
| Frontend | React 18 + TypeScript + Vite |
| UI styling | Tailwind CSS |
| Нотація | VexFlow 4 |
| Аудіо playback | Tone.js |
| Стан | Zustand |
| Backend | Python 3.11 + FastAPI + uvicorn |
| Pitch detection | librosa.pyin |
| Onset detection | librosa.onset |
| Муз. теорія | music21 |
| MusicXML | music21 |
| Bundling | PyInstaller + electron-builder |

---

## Відомі обмеження

- Транскрипція **тільки монофонічна** (одна нота в момент часу)
- Підтримувані інструменти: Piano, Violin, Guitar
- Акорди, поліфонія — не підтримуються
