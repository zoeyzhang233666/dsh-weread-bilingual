import test from 'node:test'
import assert from 'node:assert/strict'
import {
  modeAllowsAutoQueue,
  nextDisplayMode,
  nextTranslationTheme,
  normalizeDisplayMode,
  normalizeTranslationTheme,
} from '../packages/host/src/prefs.js'

test('normalizeDisplayMode defaults to hover', () => {
  assert.equal(normalizeDisplayMode(undefined), 'hover')
  assert.equal(normalizeDisplayMode('nope'), 'hover')
  assert.equal(normalizeDisplayMode('bilingual'), 'bilingual')
})

test('normalizeTranslationTheme defaults to plain', () => {
  assert.equal(normalizeTranslationTheme(''), 'plain')
  assert.equal(normalizeTranslationTheme('highlight'), 'highlight')
})

test('cycles modes and themes', () => {
  assert.equal(nextDisplayMode('hover'), 'bilingual')
  assert.equal(nextDisplayMode('translation'), 'hover')
  assert.equal(nextTranslationTheme('plain'), 'dashed')
  assert.equal(nextTranslationTheme('mask'), 'plain')
})

test('auto queue only in bilingual/translation', () => {
  assert.equal(modeAllowsAutoQueue('hover'), false)
  assert.equal(modeAllowsAutoQueue('source'), false)
  assert.equal(modeAllowsAutoQueue('bilingual'), true)
  assert.equal(modeAllowsAutoQueue('translation'), true)
})
