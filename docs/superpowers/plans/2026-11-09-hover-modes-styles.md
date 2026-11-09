# Hover modes, themes, sentence actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hover-on-demand translation, display modes, translation themes, and per-sentence translate/retranslate to the Weread bilingual reader while keeping the side-by-side layout.

**Architecture:** Persist `displayMode` and `translationTheme` on the host prefs API. Client gates the auto-translate queue by mode; in `hover`, only row hover/click enqueues a sentence. Themes are CSS `data-theme` on the root. Retranslate sends `force: true` so the host skips the in-memory cache.

**Tech Stack:** DSH cordis plugin (host JS + React client), existing `/weread-bilingual/api` prefs/translate endpoints, node:test.

**Spec:** `docs/superpowers/specs/2026-11-09-hover-modes-styles-design.md`

## Global Constraints

- Keep left Chinese / right English columns (no stacked under-text, no floating bubble).
- First-run default `displayMode=hover`, `translationTheme=plain`; thereafter restore prefs.
- Hover mode: no viewport prefetch; translate only on hover/explicit Translate.
- Space pause only in `bilingual` / `translation`.
- Do not add disk translation cache, glossary, or TTS in this plan.

---

### Task 1: Host prefs + force retranslate

**Files:**
- Modify: `packages/host/src/index.js`
- Create: `packages/host/src/prefs.js` (allowlists + normalize helpers)
- Test: `test/prefs.test.js`

**Interfaces:**
- Produces: `normalizeDisplayMode(value) → 'hover'|'bilingual'|'source'|'translation'`
- Produces: `normalizeTranslationTheme(value) → theme id`
- Produces: status/prefs include `displayMode`, `translationTheme`
- Produces: translate POST accepts `force: true` to bypass cache

- [ ] **Step 1:** Add failing tests for normalize helpers and allowlists
- [ ] **Step 2:** Implement `prefs.js` and wire Config + status + prefs POST
- [ ] **Step 3:** Translate handler: if `body.force`, skip `translationCache.get`
- [ ] **Step 4:** Run `node --test test/prefs.test.js` — pass

---

### Task 2: Client API + theme/mode CSS

**Files:**
- Modify: `packages/client/src/api.js` (prefs payload; translate `force`)
- Modify: `packages/client/src/styles.js` (mode column visibility; theme decorations; row actions)
- Bump `CSS_VERSION`

- [ ] **Step 1:** Extend `api.prefs` / `api.translate` for new fields
- [ ] **Step 2:** Add `.wrb-root[data-mode=…]` and `.wrb-cell-tr[data-theme=…]` styles
- [ ] **Step 3:** Style Translate / Retranslate affordances

---

### Task 3: Reader panel behavior

**Files:**
- Modify: `packages/client/src/panel.js`
- Modify: `packages/client/src/index.js` only if needed (no left entry)

**Interfaces:**
- Consumes: status.`displayMode`, status.`translationTheme`
- Produces: mode cycle control, theme cycle, hover enqueue, sentence actions, Space gating

- [ ] **Step 1:** Hydrate mode/theme from status; persist on change via prefs
- [ ] **Step 2:** Gate IntersectionObserver / scroll prefetch when mode is hover/source
- [ ] **Step 3:** SentenceRow: hover reveal + Translate / Retranslate / Retry
- [ ] **Step 4:** Toolbar: Mode + Theme; Auto only when applicable; Space respects mode
- [ ] **Step 5:** Rebuild `npm run build` in `packages/client`
- [ ] **Step 6:** Run full `node --test test/*.test.js`

---

### Task 4: Smoke checklist (manual)

- [ ] Fresh prefs → hover empty right until hover
- [ ] Second hover same sentence → no new call (cached)
- [ ] bilingual + Space pause works
- [ ] Theme cycle visible; survives reload
- [ ] Retranslate changes text / bypasses cache
- [ ] Save MD includes hover-fetched translations
