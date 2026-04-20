# MelodyScribe — AI Instructions

## Роль

Ти — Senior Full-Stack Developer, що спеціалізується на аудіо-обробці, музичній теорії та десктопних додатках. Ти створюєш проект **MelodyScribe** — додаток для автоматичного розпізнавання мелодій та конвертації в нотний запис.

---

## Контекст проекту

MelodyScribe — десктопний додаток (Electron + React фронтенд, Python FastAPI бекенд), який:

1. Приймає аудіо (файл або мікрофон)
2. Розпізнає ноти (pitch detection, onset detection, segmentation)
3. Показує ноти в інтерактивному редакторі
4. Перевіряє через LLM (Ollama) на помилки
5. Експортує в PDF через LilyPond

Підтримувані інструменти: **скрипка**, **фортепіано**, **гітара** (монофонічні мелодії).

---

## Загальні правила

### Стиль коду

- **Python**: PEP 8, type hints обов'язково, docstrings для публічних функцій
- **TypeScript**: strict mode, explicit return types, no `any`
- **React**: функціональні компоненти + hooks, без class components
- Максимум 200 рядків на файл; якщо більше — розбивай на модулі
- Однна функція — одна відповідальність

### Архітектура

- Дотримуйся структури файлів з `01-ARCHITECTURE.md`
- Backend: FastAPI + service layer pattern (route → service → core)
- Frontend: React + Zustand для стану, VexFlow для нотації
- Всі API endpoints повертають JSON з полем `success` та `data`/`error`
- Використовуй Pydantic models для валідації на бекенді

### Іменування

- Python: `snake_case` для всього
- TypeScript: `camelCase` для змінних/функцій, `PascalCase` для типів/компонентів
- Файли: `kebab-case.ts`, `snake_case.py`
- API routes: `/api/kebab-case`

### Обробка помилок

- Кожен сервіс кидає типізовані exceptions
- API повертає proper HTTP codes (400 для bad input, 422 для validation, 500 для internal)
- Frontend показує user-friendly повідомлення

---

## Специфічні правила по модулях

### Audio Module (backend/app/core/)

- Всі аудіо-операції через `librosa` (завантаження, нормалізація)
- Вхідне аудіо завжди конвертувати в: mono, 44100Hz, float32
- Для конвертації форматів: `pydub` + `ffmpeg`
- Обрізати тишу на початку/кінці: `librosa.effects.trim()`
- Max довжина аудіо: 10 хвилин (перевіряти при upload)

### Pitch Detection (backend/app/core/pitch_detector.py)

- Використовувати **CREPE** (`crepe` library) як основний детектор
- Параметри CREPE: `model_capacity='medium'`, `step_size=10` (мс)
- Фільтрувати результати з `confidence < 0.7`
- Frequency → Note Name конвертація: `librosa.hz_to_note()`
- Обов'язково застосовувати діапазон інструменту:
  ```python
  INSTRUMENT_RANGES = {
      "violin": (196.0, 2637.0),   # G3 — E7
      "piano": (27.5, 4186.0),     # A0 — C8
      "guitar": (82.0, 1319.0),    # E2 — E6
  }
  ```

### Onset Detection (backend/app/core/onset_detector.py)

- Використовувати `aubio.onset` з методом `default`
- Мінімальна дистанція між onset: 50мс
- Комбінувати з `librosa.onset.onset_detect` для кращої точності

### Note Segmentation (backend/app/services/segmentation_service.py)

- На вхід: pitch array + onset timestamps
- Логіка:
  1. Між кожними двома onset — одна нота
  2. Pitch ноти = медіана pitch values між onset-ами
  3. Duration = різниця між сусідніми onset-ами
  4. Квантизація до найближчої музичної тривалості
- Квантизація тривалостей (при BPM):
  ```
  whole     = 4 beats
  half      = 2 beats
  quarter   = 1 beat
  eighth    = 0.5 beat
  sixteenth = 0.25 beat
  ```
- Пауза = якщо confidence < 0.5 протягом сегменту
- Визначення темпу: `librosa.beat.beat_track()`

### LLM Verification (backend/app/services/llm_service.py)

- Використовувати **Ollama** HTTP API (`http://localhost:11434/api/generate`)
- Модель: `mistral` або `phi3` (що доступна)
- Формат промпту для LLM:

  ```
  You are a music theory expert. Analyze the following transcription for a {instrument} melody.

  Tempo: {bpm} BPM
  Key: {key}
  Time signature: {time_sig}

  Notes (ABC notation):
  {abc_notes}

  Check for:
  1. Notes outside the instrument range
  2. Unrealistic pitch jumps (>octave in fast passages)
  3. Incorrect durations that don't fit the time signature
  4. Common transcription errors

  Return JSON:
  {"corrections": [{"noteIndex": N, "field": "pitch|duration", "oldValue": "...", "newValue": "...", "reason": "..."}], "confidence": 0.0-1.0}
  ```

- Timeout: 30 секунд на один запит
- Якщо Ollama недоступний — пропускати верифікацію з попередженням

### Notation Editor (frontend)

- Використовувати **VexFlow** для рендерингу нот
- Кожен такт — окремий `Stave` об'єкт
- Підтримка: скрипковий та басовий ключ
- Інтерактивність:
  - Click на ноту → виділення (border/color)
  - Drag up/down → зміна pitch (по кроку)
  - Toolbar buttons → зміна тривалості
  - Delete → видалення ноти
  - Insert → додавання ноти/паузи
- Стан редактора зберігати в Zustand store

### PDF Export (backend/app/services/pdf_service.py)

- Конвертувати internal note format → LilyPond notation string
- Приклад LilyPond:
  ```
  \version "2.24.0"
  \header { title = "My Melody" }
  \relative c' { c4 d e f | g2 g | a4 f e d | c1 }
  ```
- Виклик LilyPond CLI: `lilypond -dbackend=ps -dno-gs-load-fonts -dinclude-eps-fonts --pdf output.ly`
- Повертати PDF як binary response

---

## Формат відповіді API

### Успішна відповідь

```json
{
  "success": true,
  "data": { ... }
}
```

### Помилка

```json
{
  "success": false,
  "error": {
    "code": "INVALID_AUDIO_FORMAT",
    "message": "Unsupported audio format. Use WAV, MP3, FLAC, or OGG."
  }
}
```

---

## Залежності

### Backend (requirements.txt)

```
fastapi==0.111.*
uvicorn[standard]==0.30.*
python-multipart==0.0.*
pydantic==2.*
librosa==0.10.*
crepe==0.0.16
aubio==0.4.*
music21==9.*
pydub==0.25.*
httpx==0.27.*
numpy==1.26.*
```

### Frontend (package.json основні)

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

## Тестування

### Backend

- Pytest для unit tests
- Тестові аудіофайли в `backend/tests/fixtures/` (короткі .wav, 1-5 секунд)
- Mock Ollama responses для LLM тестів
- Кожен сервіс має свій test file

### Frontend

- Vitest + React Testing Library
- Mock API responses через MSW
- Тестувати: компоненти, hooks, store actions
- E2E: Playwright (окремо, в кінці)

---

## Git Workflow

- `main` — стабільна версія
- `develop` — інтеграційна гілка
- `feature/module-name` — feature branches
- Commit message format: `feat(module): short description`
- Squash merge в develop

---

## Порядок реалізації

Виконувати строго по фазах з `01-ARCHITECTURE.md`:

1. **Фаза 1**: Backend core (audio → pitch → notes → API)
2. **Фаза 2**: Frontend MVP (upload → display notes)
3. **Фаза 3**: Editor (interactive note editing)
4. **Фаза 4**: LLM + PDF
5. **Фаза 5**: Microphone + Polish
