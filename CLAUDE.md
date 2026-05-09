# MelodyScribe — Claude Context

## Проект
Десктопний додаток для дружини-музикантки. Транскрипція монофонічних мелодій (фортепіано → скрипка → гітара) з аудіо у нотний запис. Фронтенд: Electron + React + VexFlow. Бекенд: Python FastAPI + librosa.

## Активний план
`/Users/okh/.claude/plans/users-okh-documents-dev-melodyscribeok-lovely-moon.md`

## Поточний стан (оновлено 2026-05-09)

### ✅ Фаза 0 — завершена
- Замінено Ollama/LLM → `TheoryChecker` (music21, детерміновані правила)
- Замінено LilyPond → MusicXML export (music21) + PDF на фронтенді (VexFlow→jsPDF)
- Прибрано CREPE/TensorFlow — код вже використовував librosa.pyin
- Оновлено документацію `instructions/01-ARCHITECTURE.md`
- PR #2 створено та змержено

### ✅ Фаза 1 — завершена
- [x] П4 — Контекстна квантизація ритму (`backend/app/core/quantizer.py`)
- [x] П5 — Синхронізоване програвання аудіо + курсор (`frontend/src/hooks/usePlayback.ts`, `store/projectStore.ts`, `NotationDisplay.tsx`)
- [x] П6 — Undo/Redo в редакторі (`frontend/src/store/projectStore.ts`, `App.tsx`)
- [x] П7 — Confidence heatmap на нотах (`frontend/src/components/NotationEditor/NotationDisplay.tsx`)

### ✅ Фаза 2 — завершена
- [x] П8 — MusicXML import/export (music21 parse/build, ExportButton, apiClient)
- [x] П9 — Waveform display (WaveformDisplay.tsx, GET /api/audio/{file_id})
- [x] П10 — Динаміка/артикуляції (RMS→velocity, staccato/legato detection)

### ✅ Фаза 3 — завершена
- [x] П11 — PyInstaller: `backend/melodyscribe.spec`, `backend/run_server.py`, Electron main.ts запускає бінарник, `build.sh` для повного pipeline
- [x] П12 — Tauri оцінка: `instructions/03-TAURI-EVALUATION.md` — висновок: Electron для v1, Tauri для v2 при широкому поширенні

## Запуск бекенду
```bash
cd /Users/okh/Documents/Dev/MelodyScribeOk/backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs
