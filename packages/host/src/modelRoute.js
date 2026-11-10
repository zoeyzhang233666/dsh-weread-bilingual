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
