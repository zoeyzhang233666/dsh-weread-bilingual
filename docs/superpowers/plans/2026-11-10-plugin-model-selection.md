# Plugin-local translation model selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the WeRead plugin resolve and persist a plugin-local translation model (prefer usable DSH default, else first usable third-party) and expose provider/model controls in the shelf settings area without changing the global Agent default.

**Architecture:** Add a pure `resolveRoute` helper that picks among saved preference → usable DSH default → first usable `listProviders` entry. Host Config stores `modelProvider`/`modelId`; `/status`, `/models`, `/prefs`, and `/translate` all use the resolver. Client shows a collapsible 「翻译模型」 block and a read-only toolbar label.

**Tech Stack:** DSH cordis host JS + React client, existing `/weread-bilingual/api`, `ctx.get('llm')` / `agentDefaultModel`, node:test, esbuild client bundle.

**Spec:** `docs/superpowers/specs/2026-11-10-plugin-model-selection-design.md`

## Global Constraints

- Plugin-local preference only — never call `agentDefaultModel.saveSelection`.
- Usability required for steps 1–2: registered-but-keyless routes (e.g. `deepseek-official`) must not win.
- Keys / baseURL stay on the DSH Models page; plugin only chooses among registered routes.
- Toolbar model label stays read-only; switcher lives in shelf settings.
- Keep existing sentence cache keyed by `modelId`; clear the client translate queue on preference change.
- Target DSH `>=0.2.1-rc.5 <0.3.0`; Node `>=24.9.0`.

## File map

| File | Responsibility |
| --- | --- |
| `packages/host/src/modelRoute.js` | Pure resolve + catalog helpers (testable without cordis) |
| `packages/host/src/translate.js` | Translator takes resolved route instead of always reading global default |
| `packages/host/src/index.js` | Config fields, settings getters, `/status` `/models` `/prefs` `/translate` wiring |
| `test/modelRoute.test.js` | Resolve order, usability, catalog warnings |
| `test/translate.test.js` | Translator uses injected route (extend if needed) |
| `packages/client/src/api.js` | `models()`, prefs fields |
| `packages/client/src/styles.js` | 「翻译模型」 block styles; bump `CSS_VERSION` |
| `packages/client/src/panel.js` | Settings UI + toolbar source hint + queue clear |
| `packages/client/client.js` | Rebuilt via `npm run build` |
| `README.md` / `README.en.md` | Short note on plugin model settings |

---

### Task 1: Pure `resolveRoute` + catalog helpers

**Files:**
- Create: `packages/host/src/modelRoute.js`
- Create: `test/modelRoute.test.js`

**Interfaces:**
- Produces: `normalizeModelPreference(provider, model) → { modelProvider: string, modelId: string }`
- Produces: `async resolveRoute({ savedProvider, savedModel, dshSelection, listProviders, listModels }) → { provider, model, modelId, source } | null`
- Produces: `async buildModelCatalog({ listProviders, listModels }) → { providers: [...], warnings: string[] }`
- Produces: `isProviderUsable(providerId, listModels) → Promise<boolean>` (non-empty `listModels` success)

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeModelPreference,
  resolveRoute,
  buildModelCatalog,
} from '../packages/host/src/modelRoute.js'

test('normalizeModelPreference trims and clears incomplete pairs', () => {
  assert.deepEqual(normalizeModelPreference('  a  ', '  b  '), { modelProvider: 'a', modelId: 'b' })
  assert.deepEqual(normalizeModelPreference('a', ''), { modelProvider: '', modelId: '' })
  assert.deepEqual(normalizeModelPreference('', 'b'), { modelProvider: '', modelId: '' })
})

test('resolveRoute prefers saved when usable', async () => {
  const route = await resolveRoute({
    savedProvider: 'proxy',
    savedModel: 'm1',
    dshSelection: { provider: 'deepseek-official', model: 'deepseek-flash' },
    listProviders: () => [{ id: 'deepseek-official' }, { id: 'proxy' }],
    listModels: async (id) => (id === 'proxy' ? [{ id: 'm1', name: 'm1' }] : []),
  })
  assert.deepEqual(route, { provider: 'proxy', model: 'm1', modelId: 'proxy/m1', source: 'saved' })
})

test('resolveRoute skips registered-but-unlistable dsh default then auto-picks', async () => {
  const route = await resolveRoute({
    savedProvider: '',
    savedModel: '',
    dshSelection: { provider: 'deepseek-official', model: 'deepseek-flash' },
    listProviders: () => [{ id: 'deepseek-official' }, { id: 'proxy' }],
    listModels: async (id) => {
      if (id === 'deepseek-official') throw new Error('no API key for provider route "deepseek-official"')
      return [{ id: 'flash', name: 'Flash' }]
    },
  })
  assert.deepEqual(route, { provider: 'proxy', model: 'flash', modelId: 'proxy/flash', source: 'auto' })
})

test('resolveRoute uses usable dsh default before auto', async () => {
  const route = await resolveRoute({
    savedProvider: '',
    savedModel: '',
    dshSelection: { provider: 'proxy', model: 'kept' },
    listProviders: () => [{ id: 'proxy' }, { id: 'other' }],
    listModels: async (id) => (id === 'proxy'
      ? [{ id: 'listed', name: 'Listed' }]
      : [{ id: 'x', name: 'x' }]),
  })
  assert.equal(route.source, 'dsh-default')
  assert.equal(route.provider, 'proxy')
  assert.equal(route.model, 'kept')
})

test('buildModelCatalog skips failing providers into warnings', async () => {
  const catalog = await buildModelCatalog({
    listProviders: () => [{ id: 'bad', name: 'Bad' }, { id: 'good', name: 'Good' }],
    listModels: async (id) => {
      if (id === 'bad') throw new Error('boom')
      return [{ id: 'm', name: 'M' }]
    },
  })
  assert.equal(catalog.providers.length, 1)
  assert.equal(catalog.providers[0].id, 'good')
  assert.match(catalog.warnings[0], /bad/)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/modelRoute.test.js`  
Expected: FAIL — cannot find module `modelRoute.js`

- [ ] **Step 3: Implement `packages/host/src/modelRoute.js`**

```js
export function normalizeModelPreference(provider, model) {
  const modelProvider = String(provider || '').trim()
  const modelId = String(model || '').trim()
  if (!modelProvider || !modelId) return { modelProvider: '', modelId: '' }
  return { modelProvider, modelId }
}

async function providerHasModels(providerId, listModels) {
  try {
    const models = await listModels(providerId)
    return Array.isArray(models) && models.length > 0
  } catch {
    return false
  }
}

export async function resolveRoute({
  savedProvider = '',
  savedModel = '',
  dshSelection = null,
  listProviders,
  listModels,
}) {
  const providers = (listProviders?.() || []).map(p => (typeof p === 'string' ? p : p.id)).filter(Boolean)
  const registered = new Set(providers)

  const saved = normalizeModelPreference(savedProvider, savedModel)
  if (saved.modelProvider && registered.has(saved.modelProvider)
      && await providerHasModels(saved.modelProvider, listModels)) {
    return {
      provider: saved.modelProvider,
      model: saved.modelId,
      modelId: `${saved.modelProvider}/${saved.modelId}`,
      source: 'saved',
    }
  }

  const dshProvider = String(dshSelection?.provider || '').trim()
  const dshModel = String(dshSelection?.model || '').trim()
  if (dshProvider && dshModel && registered.has(dshProvider)
      && await providerHasModels(dshProvider, listModels)) {
    return {
      provider: dshProvider,
      model: dshModel,
      modelId: `${dshProvider}/${dshModel}`,
      source: 'dsh-default',
    }
  }

  for (const id of providers) {
    try {
      const models = await listModels(id)
      if (!Array.isArray(models) || !models.length) continue
      const first = models[0]
      const model = typeof first === 'string' ? first : first.id
      if (!model) continue
      return { provider: id, model, modelId: `${id}/${model}`, source: 'auto' }
    } catch {
      continue
    }
  }
  return null
}

export async function buildModelCatalog({ listProviders, listModels }) {
  const raw = listProviders?.() || []
  const providers = []
  const warnings = []
  for (const entry of raw) {
    const id = typeof entry === 'string' ? entry : entry.id
    const name = typeof entry === 'string' ? entry : (entry.name || entry.displayName || id)
    if (!id) continue
    try {
      const models = await listModels(id)
      const list = (Array.isArray(models) ? models : [])
        .map(m => (typeof m === 'string' ? { id: m, name: m } : { id: m.id, name: m.name || m.id }))
        .filter(m => m.id)
      providers.push({ id, name, models: list })
    } catch (error) {
      warnings.push(`${id}: skipped (${error instanceof Error ? error.message : String(error)})`)
    }
  }
  return { providers, warnings }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/modelRoute.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/modelRoute.js test/modelRoute.test.js
git commit -m "Add pure model route resolver for plugin-local selection."
```

---

### Task 2: Host Config, translator route injection, API endpoints

**Files:**
- Modify: `packages/host/src/translate.js`
- Modify: `packages/host/src/index.js`
- Modify: `test/translate.test.js` (optional route-injection smoke if easy; otherwise rely on Task 1 + manual)

**Interfaces:**
- Consumes: `resolveRoute`, `buildModelCatalog`, `normalizeModelPreference` from Task 1
- Produces: Config `modelProvider`, `modelId`
- Produces: `createTranslator(getLlm, getRoute)` where `getRoute` is async `() => {provider, model, ...}`
- Produces: `GET /models`, extended `GET /status`, extended `POST /prefs`
- Produces: `/translate` uses resolved route (not bare `agentDefaultModel`)

- [ ] **Step 1: Change translator to take a route getter**

In `packages/host/src/translate.js`, change `createTranslator` so it awaits a route from `getRoute` instead of `getDefault()?.currentSelection?.()`:

```js
export function createTranslator(getLlm, getRoute) {
  return async function translateSentence({ text, direction = 'zh-en', previous = '', signal }) {
    // ... existing validation ...
    const route = await getRoute()
    if (!route?.provider || !route?.model) {
      throw new Error('No usable translation model. Pick one in 翻译模型 settings or configure a provider on the DSH Models page.')
    }
    // runOnce(llm, route, ...) unchanged
  }
}

export async function currentModelLabel(getRoute) {
  const route = await getRoute()
  if (!route?.provider || !route?.model) return null
  return { provider: route.provider, model: route.model, modelId: route.modelId || `${route.provider}/${route.model}` }
}
```

Keep `runOnce` / prompts / validation as-is.

- [ ] **Step 2: Extend Config + settingsOf**

In `packages/host/src/index.js` Config:

```js
modelProvider: z.string().default('').volatile(),
modelId: z.string().default('').volatile(),
```

Add getters on `settingsOf` for `modelProvider` / `modelId` (string, trimmed).

- [ ] **Step 3: Wire resolve helper inside `apply`**

```js
import { buildModelCatalog, normalizeModelPreference, resolveRoute } from './modelRoute.js'

const getRoute = async () => resolveRoute({
  savedProvider: settings.modelProvider,
  savedModel: settings.modelId,
  dshSelection: ctx.get('agentDefaultModel')?.currentSelection?.() || null,
  listProviders: () => ctx.get('llm')?.listProviders?.() || [],
  listModels: (id) => ctx.get('llm').listModels(id),
})

const translate = createTranslator(() => ctx.get('llm'), getRoute)
```

Never call `saveSelection`.

- [ ] **Step 4: Extend `/status`**

```js
const model = await currentModelLabel(getRoute)
const route = model ? await getRoute() : null
sendJson(res, 200, {
  // existing fields...
  model,
  modelSource: route?.source,
  modelProvider: settings.modelProvider,
  modelId: settings.modelId,
})
```

(Avoid double resolve if easy: resolve once and derive both.)

- [ ] **Step 5: Add `GET /models`**

```js
if (pathIs(path, '/models') && req.method === 'GET') {
  const llm = ctx.get('llm')
  if (!llm?.listProviders || !llm?.listModels) {
    sendJson(res, 200, { providers: [], warnings: ['Harness LLM service is unavailable.'] })
    return
  }
  const catalog = await buildModelCatalog({
    listProviders: () => llm.listProviders(),
    listModels: (id) => llm.listModels(id),
  })
  sendJson(res, 200, catalog)
  return
}
```

- [ ] **Step 6: Extend `POST /prefs`**

When `body.modelProvider != null` or `body.modelId != null`, normalize and persist both:

```js
if (body.modelProvider != null || body.modelId != null) {
  const next = normalizeModelPreference(
    body.modelProvider != null ? body.modelProvider : settings.modelProvider,
    body.modelId != null ? body.modelId : settings.modelId,
  )
  patch.modelProvider = next.modelProvider
  patch.modelId = next.modelId
}
```

Response includes `modelProvider`, `modelId`, plus existing prefs fields.

- [ ] **Step 7: Fix `/translate` cache key to use resolved route**

```js
const route = await getRoute()
const model = route
  ? { provider: route.provider, model: route.model, modelId: route.modelId }
  : null
const key = cacheKey({ ..., modelId: model?.modelId, ... })
```

Map credential errors to a clearer message:

```js
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/no API key|MISSING_CREDENTIAL|credential/i.test(message)) {
    sendJson(res, 502, {
      error: 'Current model has no usable API key. Switch provider in 翻译模型, or add a key on the DSH Models page.',
    })
    return
  }
  throw error
}
```

(Place this in the translate handler try/catch — the outer `handle` catch may already stringify; prefer specializing before rethrow.)

- [ ] **Step 8: Run unit tests**

Run: `node --test test/modelRoute.test.js test/translate.test.js test/prefs.test.js`  
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/host/src/translate.js packages/host/src/index.js test/
git commit -m "Wire plugin-local model preference into host translate APIs."
```

---

### Task 3: Client API + styles for model settings

**Files:**
- Modify: `packages/client/src/api.js`
- Modify: `packages/client/src/styles.js` (bump `CSS_VERSION`)

**Interfaces:**
- Produces: `api.models()` → `GET /models`
- Produces: `api.prefs` already posts JSON; callers may include `modelProvider` / `modelId`
- Produces: CSS for `.wrb-model-settings`, selects, notice line

- [ ] **Step 1: Extend API client**

```js
models: () => request('/models'),
```

No change required to `prefs` signature beyond passing new fields in the body.

- [ ] **Step 2: Add styles** (match existing ChemClaw / wrb tokens)

```css
.wrb-model-settings {
  margin: 12px 0 16px;
  padding: 12px;
  border: 1px solid var(--wrb-line);
  border-radius: 10px;
  background: var(--wrb-panel);
}
.wrb-model-settings summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--wrb-ink);
}
.wrb-model-settings-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.wrb-model-settings label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--wrb-muted);
}
.wrb-model-settings select {
  font: inherit;
  color: var(--wrb-ink);
  background: var(--wrb-bg);
  border: 1px solid var(--wrb-line-2);
  border-radius: 8px;
  padding: 6px 8px;
}
.wrb-model-settings .wrb-model-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.wrb-model-settings .wrb-hint {
  margin: 0;
  font-size: 12px;
  color: var(--wrb-muted);
}
.wrb-model-settings .wrb-notice {
  margin: 0;
  font-size: 12px;
  color: var(--wrb-accent);
}
```

Bump `CSS_VERSION` to `2026-11-10-model-select`.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/api.js packages/client/src/styles.js
git commit -m "Add client API and styles for translation model settings."
```

---

### Task 4: Panel UI — settings block, toolbar hint, queue clear

**Files:**
- Modify: `packages/client/src/panel.js`
- Rebuild: `packages/client/client.js` via `npm run build`

**Interfaces:**
- Consumes: `status.model`, `status.modelSource`, `status.modelProvider`, `status.modelId`, `api.models()`, `api.prefs`
- Produces: collapsible 「翻译模型」 on shelf (logged-in and logged-out); read-only toolbar label with optional `自动`/`已选`

- [ ] **Step 1: State + load catalog**

Add state:

```js
const [modelCatalog, setModelCatalog] = useState({ providers: [], warnings: [] })
const [modelDraftProvider, setModelDraftProvider] = useState('')
const [modelDraftModel, setModelDraftModel] = useState('')
const [modelNotice, setModelNotice] = useState('')
```

On mount / after `refreshStatus`, sync drafts from `status.modelProvider`/`modelId` or resolved `status.model`. Load catalog lazily when the details block opens (or once on shelf mount):

```js
const loadModels = useCallback(async () => {
  try {
    const catalog = await api.models()
    setModelCatalog(catalog)
  } catch (error) {
    setModelCatalog({ providers: [], warnings: [error.message] })
  }
}, [api])
```

- [ ] **Step 2: Persist helpers**

```js
const saveModelPrefs = async (provider, model) => {
  clearQueue()
  await api.prefs({ modelProvider: provider, modelId: model })
  await refreshStatus()
  showToast(provider ? '翻译模型已更新' : '已恢复自动选择模型')
}

const onProviderChange = async (providerId) => {
  setModelDraftProvider(providerId)
  const entry = modelCatalog.providers.find(p => p.id === providerId)
  const first = entry?.models?.[0]?.id || ''
  setModelDraftModel(first)
  if (providerId && first) await saveModelPrefs(providerId, first)
}

const onModelChange = async (modelId) => {
  setModelDraftModel(modelId)
  if (modelDraftProvider && modelId) await saveModelPrefs(modelDraftProvider, modelId)
}

const restoreAutoModel = async () => {
  setModelDraftProvider('')
  setModelDraftModel('')
  await saveModelPrefs('', '')
}
```

If `status.modelSource === 'auto'` while saved fields are empty, optional notice is fine but not required. If saved preference was dropped by resolver, set `modelNotice` to「已保存的模型不可用，已自动换用当前模型」when `status.modelProvider` is set but `status.modelSource !== 'saved'`.

- [ ] **Step 3: Render settings block component**

Extract a small inline block used in both login and logged-in shelf branches:

```jsx
<details className="wrb-model-settings" onToggle={event => { if (event.target.open) loadModels() }}>
  <summary>翻译模型</summary>
  <div className="wrb-model-settings-body">
    <p className="wrb-hint">从 DSH 已注册的供应商中选择；API Key 请在 DSH Models 页配置。</p>
    {modelNotice ? <p className="wrb-notice">{modelNotice}</p> : null}
    <label>
      供应商
      <select value={modelDraftProvider} onChange={e => onProviderChange(e.target.value)}>
        <option value="">（自动）</option>
        {modelCatalog.providers.map(p => (
          <option key={p.id} value={p.id} disabled={!p.models?.length}>{p.name || p.id}</option>
        ))}
      </select>
    </label>
    <label>
      模型
      <select
        value={modelDraftModel}
        onChange={e => onModelChange(e.target.value)}
        disabled={!modelDraftProvider}
      >
        <option value="">（自动）</option>
        {(modelCatalog.providers.find(p => p.id === modelDraftProvider)?.models || []).map(m => (
          <option key={m.id} value={m.id}>{m.name || m.id}</option>
        ))}
      </select>
    </label>
    <div className="wrb-model-actions">
      <button type="button" className="wrb-btn" onClick={restoreAutoModel}>恢复自动</button>
    </div>
  </div>
</details>
```

Place it:
1. Inside `.wrb-login` after login actions / before or after manual cookie.
2. Inside logged-in `.wrb-shelf` above or below `.wrb-reader-head`.

- [ ] **Step 4: Toolbar label**

```js
const modelLabel = status?.model
  ? `${status.model.provider}/${status.model.model}${
      status.modelSource === 'saved' ? ' · 已选' : status.modelSource === 'auto' ? ' · 自动' : ''
    }`
  : 'no model'
```

Keep it a `<span className="wrb-meta">` — not clickable.

- [ ] **Step 5: Improve translate error toast/display**

When translate fails with the host’s credential guidance string, show it in the sentence error / toast as returned (no special parsing required beyond existing error display).

- [ ] **Step 6: Build client bundle**

Run: `npm run build`  
Expected: `packages/client/client.js` updates successfully.

- [ ] **Step 7: Run full tests**

Run: `npm test`  
Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add packages/client/src/panel.js packages/client/client.js packages/client/src/styles.js packages/client/src/api.js
git commit -m "Add shelf UI to select translation provider and model."
```

---

### Task 5: Docs + acceptance checklist

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Document in README (ZH + EN)**

Add under 使用 / Usage, after model-related bullets:

中文：

```markdown
- **翻译模型**：书架页「翻译模型」可切换供应商与模型（仅影响本插件；默认优先用可用的 DSH 全局模型，否则自动选第一个可用第三方路由）。API Key 仍在 DSH Models 页配置。
```

English:

```markdown
- **Translation model:** Use **翻译模型** on the shelf to pick provider/model (plugin-local only; prefers a usable DSH default, else the first usable third-party route). API keys stay on the DSH Models page.
```

- [ ] **Step 2: Manual acceptance (on DSH Desktop)**

1. Default = `deepseek-official/...` without key + a configured third-party route → toolbar shows third-party · 自动; hover translate succeeds.
2. Open 「翻译模型」, pick another provider/model → toolbar · 已选; new sentences use new model; Agent default unchanged.
3. 「恢复自动」 → preference cleared; resolution returns to chain.
4. Logged-out shelf still shows the settings block.
5. Force Retry after a credential error shows the guidance message.

- [ ] **Step 3: Commit**

```bash
git add README.md README.en.md
git commit -m "Document plugin-local translation model selection."
```

---

## Spec coverage self-check

| Spec requirement | Task |
| --- | --- |
| Plugin-local `modelProvider`/`modelId` | Task 2 |
| resolve saved → usable dsh-default → auto | Task 1–2 |
| Skip registered-but-unlistable official route | Task 1 tests |
| `/status` modelSource + prefs fields | Task 2 |
| `GET /models` + warnings | Task 1–2 |
| `POST /prefs` clear = restore auto | Task 2 |
| Settings UI shelf logged in/out | Task 4 |
| Toolbar read-only + source hint | Task 4 |
| Clear client queue on change | Task 4 |
| Credential error guidance | Task 2 + 4 |
| Never `saveSelection` | Task 2 constraint |
| Cache keyed by modelId | existing + Task 2 |
| README note | Task 5 |
| Acceptance cases | Task 5 |
