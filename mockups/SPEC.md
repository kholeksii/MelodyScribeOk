# MelodyScribe Responsive Redesign — Implementation Spec

Companion to the HTML mockups in this directory (open `00-index.html` for the catalog).
Target: the UI must be comfortable and intuitive on **iPhone (~390px)**, **iPad (~834px)**
and **laptop (≥1280px)**. Each numbered section below is implementable as an independent PR;
the recommended order is in §9.

## 1. Scope & invariants

**Do not change:** the U15 palette (paper/ink/accent `#7C5CBF`), Fraunces/Inter fonts,
the two-screen model (upload ⇄ editor, swapped on `notes.length`), the light music sheet,
Ukrainian-default i18n, existing stores/APIs.

**Change:** layout structure per breakpoint, touch target sizes, note-editing ergonomics,
tooltip policy, error surfaces. All mockups use stand-in fonts (Georgia/system-ui) — the real
app keeps `@fontsource-variable` Fraunces/Inter.

## 2. Breakpoints & touch sizing

| Tier | Width | Tailwind | Measures/line |
|---|---|---|---|
| phone | < 640px | base | 2 |
| tablet | 640–1023px | `sm:` / `md:` | 3 |
| desktop | ≥ 1024px | `lg:` | 4 |

Touch sizing is by **pointer type, not viewport**. In `frontend/src/index.css`:

```css
/* base (mouse) — raise from current ~32/28px */
.btn-primary, .btn-secondary { @apply min-h-9; }   /* 36px */
.btn-ghost { @apply min-h-8; }                     /* 32px */
.input-field { @apply min-h-9; }

@media (pointer: coarse) {
  .btn-primary, .btn-secondary, .btn-ghost, .input-field, .tap-target {
    min-height: 44px; min-width: 44px;
  }
}
```

Gap between adjacent interactive controls on coarse pointers: ≥ 8px (`gap-2`+).
`LanguageSwitcher` and `ThemeToggle` must adopt `.btn-ghost` (currently `px-2 py-1 text-xs`
in `frontend/src/components/LanguageSwitcher.tsx`). Mockups emulate coarse pointer with a
`.touch` class on the device frame — in the app it is the media query only.

Add `viewport-fit=cover` to the viewport meta in `frontend/index.html`.

## 3. Score rendering (`frontend/src/utils/vexflowRenderer.ts`)

Current bug: fixed `STAVE_W = 1100`, `renderer.resize(1200, …)` → intrinsic 1200px SVG,
3.2× a phone viewport. Replace with container-driven layout:

```ts
export async function renderScore(container, notes, timeSignature, keySignature,
                                  listeners, containerWidth: number)
```

- `measuresPerLine = containerWidth < 640 ? 2 : containerWidth < 1024 ? 3 : 4`
- Internal render width per tier: **640 / 900 / 1200** units (keeps glyph size comfortable).
  `STAVE_W = renderW - 100`, `FORMAT_W = STAVE_W - 150` (preserve current ratios).
- After render, set on the `<svg>`: `viewBox="0 0 <renderW> <renderH>"`, `width="100%"`,
  remove fixed `width`/`height` attributes → SVG scales fluidly inside the tier.
- `useNotationRenderer.ts`: observe the container with `ResizeObserver`, debounce 200ms,
  re-render **only when the tier changes**, not per pixel.
- **Hit zones**: after drawing, inject one transparent `<rect>` per note spanning the note's
  full horizontal slot × the full staff height (effective ≥ 44×88 px on phone). Tag it with
  the note's `noteDataId`; a tap selects the nearest note — precision-tapping glyphs is never
  required. Selected note: accent fill **plus** a halo (`<circle r≈15>` accent at 14% fill /
  45% stroke opacity) so selection is visible at small scale (see mockups).
- **Zoom stepper** (tablet/desktop only, in the score-card header row): − / 100% / +,
  range 75–150%, applied as a multiplier to the internal render width. No pinch-zoom.
- Score-card header row also hosts whole-melody transpose `8va ↑ / 8vb ↓` (moved out of
  NoteToolbar — it is a score-level action). See `editor-tablet.html` / `editor-desktop.html`.

## 4. Editor screen (`frontend/src/components/EditorScreen.tsx`)

New shared primitives (`frontend/src/components/ui/`):
- **`BottomSheet.tsx`** — slides from bottom, grab handle, `role="dialog"`, focus trap,
  Esc/scrim-tap closes (scrim optional — the note-edit sheet is non-modal, no scrim),
  `padding-bottom: env(safe-area-inset-bottom)`.
- **`Menu.tsx`** — renders a dropdown popover ≥ 640px and a BottomSheet < 640px.
  Rows: 48px min height, icon + full label, optional trailing kbd hint.

### Header per tier (see editor-*.html mockups)

- **Desktop:** one row: brand · title input (~176px) · 4 metadata chips ·
  `↩` `↪` (icon-only, aria-label + title with shortcut) · `💾 Зберегти` ·
  `Файл ▾` (Відкрити / Імпорт MusicXML / Нова транскрипція) ·
  `Експорт ▾` (Експорт PDF / Експорт MusicXML) · `?` · theme · language.
  **VersionBadge moves into the `?` (ShortcutHelp) dialog footer.**
- **Tablet:** no brand text; title input (max 200px); chips collapse to **one tappable
  summary chip** (`4/4 · Соль мажор · 90 BPM · Скрипка`, ellipsized ≤ 180px) opening a
  metadata popover; `↩` `↪` · `💾` (icon-only) · `Файл ▾` · `Експорт ▾` · `⋯`
  (theme/language/help live in `⋯`).
- **Phone:** two rows. Row 1: `←` (New/close with confirm-if-unsaved) · title input (flex-1)
  · `⋯`. Row 2 (thin): summary chip + autosave dot (`збережено` indicator). The `⋯` bottom
  sheet holds: Зберегти ⌘S / Відкрити ⌘O / Імпорт MusicXML / Експорт PDF ⌘E / Експорт
  MusicXML / Нова транскрипція / Гарячі клавіші / Тема (segmented Світла·Темна·Авто) /
  Мова (UA·EN) / footer `MelodyScribe v… · sha · date`. See `editor-phone-overflow-menu.html`.
  **Undo/Redo move to the playback bar on phone.**

The upload screen's `Toolbar` (Save/Open — dead-disabled there) is **removed**;
`frontend/src/components/Toolbar/Toolbar.tsx` is absorbed into the File menu.

### Note editing (`frontend/src/components/NotationEditor/NoteToolbar.tsx`)

- **Phone:** on note select, open a **non-modal BottomSheet** (playback bar hides while open;
  «Готово» / deselect restores it). Anatomy (`editor-phone-note-selected.html`):
  row 1 `◀ | Ля₄ · A4 | ▶` (prev/next note steppers — precision tapping optional);
  row 2 Висота −/+ and Октава −/+ (48px buttons);
  row 3 Тривалість segmented `1 · 1/2 · 1/4 · 1/8 · 1/16`;
  row 4 `+ Пауза` / `Видалити` (danger-outline) / `Готово` (primary).
- **Tablet/desktop:** keep the sticky card, add the same `◀/▶` steppers, apply new sizes.
  Keyboard shortcuts unchanged. Transpose-all buttons move to the score-card header (§3).

### Playback bar (`frontend/src/components/Playback/PlaybackControls.tsx`)

- Footer: `padding-bottom: env(safe-area-inset-bottom)`.
- **Phone** (`editor-phone.html`): single row, `grid-template-columns: 1fr auto 1fr`:
  left `↩ ↪`; center **56px round accent Play/Stop**; right `90 BPM` chip + metronome toggle.
  Tapping the BPM chip opens a BottomSheet (`editor-phone-bpm-sheet.html`): slider 40–220 +
  −/+ steppers + Настукати темп + metronome switch + Готово. The bar itself never wraps.
  Transient status text replaces the BPM chip during playback.
- **Tablet/desktop:** current content normalized: `▶ Грати` `■ Стоп` status … metronome ·
  BPM input · Настукати темп, `justify-between`.

## 5. Upload screen (`frontend/src/App.tsx` + `AudioControls/*`)

Single centered column at all tiers; only width changes (phone: full width, 16px gutters;
tablet `max-w-xl` 576px; desktop `max-w-2xl` 672px).

- **Phone** (`upload-phone.html`): order = RecoveryBanner → **Record button first**
  (56px, primary) → dropzone with copy «Натисніть, щоб обрати файл» (drop still works) →
  demo button → loaded-file chip → InstrumentSelector → options card → **sticky
  Транскрибувати** above safe-area once a file is loaded. RecentProjects below the fold.
- **Tablet** (`upload-tablet.html`): recents above; dropzone + record side-by-side 60/40.
- **Desktop** (`upload-desktop.html`): current layout, cleaned: header holds only `?` /
  theme / language (dead Save/Open removed).
- **InstrumentSelector** re-skin: segmented control on palette tokens
  (currently off-palette `gray-*`/`blue-*` Tailwind defaults in
  `frontend/src/components/AudioControls/InstrumentSelector.tsx`).
- Options card: BPM input + Настукати темп in one row; Розмір + Тональність as two
  half-width selects.

## 6. Tooltip → label resolution (all 28 `title=` sites)

Policy: `title=` is never the sole label. Every icon button keeps `aria-label`; visible
text label at desktop where space allows; menu/sheet rows always show icon + full label.
`title=` may remain only as a supplementary hint (e.g. shortcut).

| Site (file:line at time of writing) | Resolution |
|---|---|
| EditorScreen undo/redo | icon-only + aria-label; `title` keeps shortcut hint |
| EditorScreen new project | phone: `←` + sheet row; desktop: File menu row with label |
| EditorScreen shortcuts `?` | keep icon; dialog itself is the label surface |
| EditorScreen waveform toggle | visible text label already — drop `title` |
| VersionBadge hover-only version | move full string into `?` dialog footer (visible) |
| ExportButton PDF / MusicXML / Import | become Export/File menu rows with labels |
| ShortcutHelp close | keep aria-label `✕` |
| ThemeToggle | menu row «Тема» with segmented control (phone/tablet); ghost icon + aria (desktop) |
| RecentProjects row | row text is the label — drop `title` |
| Toolbar save/open | become menu rows / labeled `💾 Зберегти` button |
| PlaybackControls play/stop/metronome/BPM | labeled buttons (desktop); aria + visible chip (phone) |
| SuggestionsPanel close | keep aria-label |
| NoteToolbar all-up/all-down | move to score header as `8va ↑ / 8vb ↓` with aria-labels |
| NoteToolbar pitch/duration/rest/delete | section captions are visible labels; buttons keep aria |
| TranscribeOptions tap hint | keep — supplementary to visible «Настукати темп» |

## 7. Error UX — exactly two patterns

- **Toast** (existing `Toast.tsx`, promoted to the single async channel): transcription
  failed, save/export results, playback errors. Success/info auto-dismiss 5s; danger persists
  until dismissed; max 2 stacked. Position: phone — bottom-center **above the playback bar
  and safe-area**; tablet/desktop — bottom-right. See `errors-and-toasts.html`.
- **Inline field error** (`.field-error`: 12px danger text under the control +
  `border-color: danger`, `aria-invalid`): BPM out of range, unsupported file format.
- Remove the raw `alert()` in `frontend/src/components/Toolbar/Toolbar.tsx` (open failure →
  danger toast). RecoveryBanner stays — the only allowed banner.
- Fix: `animate-fade-in` used by Toast has no keyframe defined — add it or remove the class.

## 8. Token additions

| Token | Light | Dark | Note |
|---|---|---|---|
| `sheet` | `#FFFFFF` | **`#F6F2E9`** | dark-mode sheet is tinted near-white («lit page»); pure #FFF only for PDF export |

Dark-mode sheet card also gets a stronger shadow + 1px `ink-soft/18` border (see mockups).
Everything else unchanged. Sheet token becomes a CSS variable like the other themed colors.

## 9. Implementation order (each step ships alone)

1. CSS sizes + `pointer: coarse` rules + viewport meta (§2)
2. `Menu` / `BottomSheet` primitives (§4)
3. Score scaling + hit zones + selection halo (§3)
4. Editor header per tier (§4)
5. NoteToolbar phone bottom-sheet + steppers (§4)
6. Playback bar per tier + BPM sheet (§4)
7. Upload screen per tier + InstrumentSelector re-skin (§5)
8. Tooltip policy + error unification + dedup (§6, §7) + sheet token (§8)

## 10. Acceptance checklist (per tier)

- 390px: no horizontal scroll anywhere; score renders 2 measures/line filling the width;
  every interactive element ≥ 44×44px; any action reachable in ≤ 2 taps; playback bar and
  sheets respect `safe-area-inset-bottom`.
- 834px: header fits in one row without wrapping; 3 measures/line; note editing via card
  with ◀/▶ steppers.
- 1280px: full labeled header; 4 measures/line; keyboard shortcuts still work; nothing
  regressed for mouse users (hover states intact).
- Both themes: dark mode shows the tinted `#F6F2E9` sheet; all text meets contrast on paper
  backgrounds; PDF export unchanged (white sheet, print-black).
