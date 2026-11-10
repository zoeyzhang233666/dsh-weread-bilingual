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
