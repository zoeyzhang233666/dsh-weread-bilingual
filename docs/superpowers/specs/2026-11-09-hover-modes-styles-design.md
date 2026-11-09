# Hover modes, translation themes, and sentence actions

Date: 2026-11-09  
Status: approved · implemented in 0.1.5  
Parent: `2026-11-06-weread-bilingual-dsh-design.md`

## Goal

Add Immersive-Translate–style reading controls to the Weread bilingual right-sidebar reader, without leaving the side-by-side layout:

1. Hover / on-demand show translation  
5. Translation visual themes  
7. Per-sentence translate / retranslate  
8. Display modes: source / translation / bilingual / hover  

## Decisions (approved)

- Keep **left source / right translation** columns (not stacked under-text).  
- In hover mode, **request the model only on hover** (or explicit Translate click). No viewport prefetch.  
- Persist `displayMode` and `translationTheme`; **first run defaults to `hover`**; later sessions restore last choice.  
- Implementation approach: **prefs on host + sentence-level client control** (not floating popovers).

## Display modes (`displayMode`)

| Mode | Left | Right | Auto-translate queue |
|---|---|---|---|
| `hover` | Source | Empty until hover/click reveals (and fetches if needed) | Off |
| `bilingual` | Source | Always show translation cell | On (existing viewport queue + Space pause) |
| `source` | Source | Column hidden | Off |
| `translation` | Column hidden | Translation only (`…` if missing) | On |

Toolbar: replace today’s coarse Layout cycle with an explicit mode control that cycles  
`hover → bilingual → source → translation → hover` (label shows current mode).

### Hover behavior (`hover` only)

- Mouse enter a sentence row: if translation cached → show; else enqueue that sentence (priority / front of queue) and show when ready.  
- Mouse leave: **keep revealed translations for the current chapter** (no flicker). Reset reveal set on chapter change.  
- Click on the translation cell (or a Translate control) uses the same path (touch / no-hover fallback).  
- Spacebar does **not** toggle auto-translate in `hover` / `source`; optional short toast: “按需模式，悬停句子翻译”.

### Auto-translate + Space

- Space pause/resume only when mode is `bilingual` or `translation` and auto-translate is relevant.  
- Entering `hover` or `source` clears the in-flight queue (same as pausing).  
- Leaving `hover` into `bilingual`/`translation` with auto on resumes viewport prefetch.

## Translation themes (`translationTheme`)

Applied to the right-hand translation text via `data-theme` on the reader root or cell:

| id | Visual |
|---|---|
| `plain` | Default, no decoration (first-run default) |
| `dashed` | Dashed underline |
| `highlight` | Warm highlight background (Paper accent mix) |
| `blockquote` | Left border quote strip |
| `weakening` | Lower contrast, slightly smaller |
| `mask` | Blurred until the row is hovered (composable with any display mode that shows the translation cell) |

Toolbar “Theme” cycles the list; preference persisted.

## Sentence actions (feature 7)

Per row, on the translation side:

| State | UI |
|---|---|
| Missing | “Translate” button; hover mode also triggers on row hover |
| Present | On row hover, show “Retranslate” |
| Error | Existing “Retry” |

**Retranslate / force:** client calls translate API with `force: true` (or dedicated query). Host bypasses the in-memory `translationCache` for that key, then stores the new result.

Manual Translate works in every mode that shows the translation column (`hover`, `bilingual`, `translation`).

## Persistence

Extend host `Config` / prefs API (same `POST .../prefs` path):

- `displayMode`: `hover` \| `bilingual` \| `source` \| `translation` (default `hover`)  
- `translationTheme`: one of the theme ids (default `plain`)  

`GET .../status` returns both so the client can hydrate on load.

No change to Cookie / direction / autoTranslate semantics beyond mode gating above.

## Client UI sketch

- Top toolbar: Shelf / Reading | mode control | Theme | Auto (when applicable) | ZH→EN | Save MD | model meta  
- Bottom nav: unchanged chapter prev/next; Pause only when auto queue is active  
- Sentence row: source cell + translation cell with theme class + action affordances  

Paper theme tokens already in use remain the chrome; translation themes only style the translation text.

## Out of scope (this change)

- Persistent disk cache of translations across process restarts (still in-memory Map)  
- Stacked under-text layout, floating bubble UI  
- Word selection / dictionary / TTS  
- Glossary / term bank  
- Whole-book export  

## Acceptance

1. Fresh profile opens chapters in `hover`; right cells empty until hover; first hover spends one model call; second hover on same sentence does not.  
2. Switching to `bilingual` restores viewport auto-translate; Space pauses again.  
3. Theme cycle visibly changes translation styling; survives Desktop restart.  
4. Retranslate replaces text and does not return the previous cached string.  
5. Mode and theme survive restart via prefs.  
6. Save MD still exports whatever translations are currently in client state (including hover-fetched ones).

## Implementation notes

- Prefer small edits in `packages/client/src/panel.js` + `styles.js` + host `Config`/`prefs`/`translate` cache bypass.  
- Bump `CSS_VERSION` when styles change.  
- Add unit tests for prefs validation / theme id allowlist if helpers are extracted.  
