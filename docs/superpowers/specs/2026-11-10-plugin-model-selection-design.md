# Plugin-local translation model selection — design

Date: 2026-11-10

## Problem

On DSH Desktop (including Mac), the WeRead bilingual plugin always translates through `agentDefaultModel.currentSelection()`. When the global default is `deepseek-official/...` but the user only has third-party provider routes configured, translation fails with missing `DEEPSEEK_API_KEY`. The plugin UI only shows the model label; there is no way to pick another provider or model.

## Goals

- Prefer the DSH global default when that route is usable; otherwise fall back to the first usable registered third-party route.
- Persist a **plugin-local** provider/model preference that does not change `agentDefaultModel` or Agent chat defaults.
- Let the user switch provider and model in the plugin settings area; keep the toolbar label read-only.
- Keep using DSH `llm.prepareCall` and the credentials / Models page for keys — no plugin-side API key or baseURL forms.

## Non-goals

- Changing the global DSH default model from this plugin.
- Configuring API keys or base URLs inside the plugin.
- Bypassing DSH `llm` with a custom OpenAI-compatible client.
- Cross-profile sync of the preference.

## Decisions (from brainstorming)

| Topic | Choice |
| --- | --- |
| Preference scope | Plugin-local only (option A) |
| Auto resolution | Prefer DSH default when usable; else first usable third-party (option B) |
| Switcher UI | Settings area near login/Cookie; toolbar shows name only (option C) |
| Approach | Local preference + usability probe + DSH llm catalog (approach 1) |

## Architecture

### Stored preference

In the `weread-bilingual` settings namespace:

- `modelProvider: string` (default `''`)
- `modelId: string` (default `''`)

Empty pair means “automatic resolution”. Writing both non-empty locks the plugin to that route until cleared.

### Route resolution — `resolveRoute()`

Used by `/status`, `/translate`, and any place that needs the active label.

1. If saved `modelProvider` + `modelId` are set and that provider is **usable** (see below) → use them. If saved but unusable → fall through (do not hard-fail yet).
2. Else take `agentDefaultModel.currentSelection()`; if that provider is **usable** → use it (even when `listModels` does not include the exact default model id, still prefer the saved default model string when the provider is usable).
3. Else walk `llm.listProviders()` in registration order; skip unusable providers; take the first provider with a non-empty model list, and its first listed model.
4. If nothing usable → throw a clear error directing the user to the DSH Models page or the plugin model settings.

Important: a provider that is merely *registered* (e.g. `deepseek-official` with no API key) is **not** selected in steps 1–2; usability is required so Mac Desktop users with only third-party keys are not stuck on the official route.

Return shape: `{ provider, model, modelId: `${provider}/${model}`, source: 'saved' | 'dsh-default' | 'auto' }`.

### Usability

A provider is usable when it is registered and `listModels(provider)` succeeds with a non-empty list. Optionally, a lightweight `prepareCall` probe may skip routes that fail with missing-credential errors. Do not claim quota/billing readiness.

Providers that return an empty catalog may appear in the settings list as disabled / unselectable, but must not be chosen by auto fallback.

### Translation path

`createTranslator` accepts an explicit route (or a `resolveRoute` callback) instead of always calling `agentDefaultModel.currentSelection()`. `prepareCall` continues to use `{ provider, model, temperature, maxTokens }` from the resolved route.

Cache keys already include `modelId`; switching models isolates cache entries without wiping the whole map. In-flight client queues should be cleared on preference change so new sentences use the new route.

## API

### `GET /status`

Extend with:

- `model` — resolved `{ provider, model, modelId }` (or `null`)
- `modelSource` — `saved` | `dsh-default` | `auto` (omit when no model)
- `modelProvider` / `modelId` — stored preference strings (may be empty)

### `GET /models`

Returns catalog for the settings UI:

```json
{
  "providers": [
    { "id": "my-proxy", "name": "my-proxy", "models": [{ "id": "…", "name": "…" }] }
  ],
  "warnings": ["deepseek-official: skipped (listModels failed)"]
}
```

Built from `llm.listProviders()` + per-provider `listModels`. A failing provider is omitted from `providers` (or listed empty) and mentioned in `warnings`.

### `POST /prefs`

Accept optional `modelProvider` and `modelId`. Empty strings clear the preference (restore automatic resolution). Persist via existing settings `mutate`. Validate that a non-empty pair refers to a currently listed provider when possible; still allow save if the catalog is temporarily unavailable, with runtime fallback on next resolve.

## UI

### Toolbar

Keep `wrb-meta` as a **read-only** label of the resolved `provider/model`. Optionally show a short source hint (`自动` / `已选`).

### Settings block — 「翻译模型」

Place a collapsible section on the shelf view:

- Visible when logged out (so users can fix the model before Weread login) and when logged in (near reader-head / logout).
- Controls: provider `<select>`, model `<select>` (models for the selected provider), button 「恢复自动」.
- On change: `POST /prefs` → `refreshStatus` → clear client translate queue; toast on success or show error.
- Copy that keys stay on the DSH Models page; this block only chooses among registered routes.

Do not add click-to-edit on the toolbar label in this iteration.

## Error handling

| Situation | Behavior |
| --- | --- |
| Saved route provider gone or unlistable | Resolve falls through steps 2→3; settings may show a one-line notice that the saved model was unavailable and an auto route was used |
| Translate hits missing credential / no API key | Surface a readable message: switch route in 「翻译模型」 or add a key on the DSH Models page; keep Retry |
| No providers usable at all | Status `model: null`; translate fails with setup guidance |
| 「恢复自动」 | Clear stored fields; next resolve uses steps 2→3 |

## Testing / acceptance

1. Global default is `deepseek-official/...` without a key, and at least one third-party route is registered with models → plugin resolves to that third-party (`modelSource: auto` or `dsh-default` only if default were usable); translation succeeds.
2. User picks another provider/model in settings → preference persists; toolbar updates; new sentences use the new `modelId` in cache keys.
3. 「恢复自动」 clears preference; resolution returns to the automatic chain.
4. Changing the plugin preference does not call `agentDefaultModel.saveSelection` and does not alter Agent defaults.
5. Unit tests cover preference normalization, resolve order (saved → dsh-default → auto), and skipping unlistable providers.

## Risks

- “Usable” is heuristic; a route that lists models may still fail at stream time (quota, endpoint). Retry + settings remain the escape hatch.
- `listModels` behavior differs across adapters; empty catalogs must not block the whole UI.
- Catalog enumeration adds a small host cost on opening settings / `/models`; cache briefly if needed.
