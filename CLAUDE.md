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

### 🔄 Фаза 1 — в процесі (наступний крок: П4)
- [x] П4 — Контекстна квантизація ритму (`backend/app/core/quantizer.py`)
- [x] П5 — Синхронізоване програвання аудіо + курсор (`frontend/src/hooks/usePlayback.ts`, `store/projectStore.ts`, `NotationDisplay.tsx`)
- [x] П6 — Undo/Redo в редакторі (`frontend/src/store/projectStore.ts`, `App.tsx`)
- [x] П7 — Confidence heatmap на нотах (`frontend/src/components/NotationEditor/NotationDisplay.tsx`)

### ⏳ Фаза 2 — не розпочата
- П8 MusicXML import/export, П9 Waveform display, П10 Динаміка/артикуляції

### ⏳ Фаза 3 — не розпочата
- П11 PyInstaller бандлінг, П12 Tauri оцінка

## Запуск бекенду
```bash
cd /Users/okh/Documents/Dev/MelodyScribeOk/backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs
