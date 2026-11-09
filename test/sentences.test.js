import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cacheKey, splitSentences } from '../packages/host/src/sentences.js'

test('splits Chinese sentences', () => {
  const items = splitSentences('第一句。第二句！还有第三句？')
  assert.equal(items.length, 3)
  assert.equal(items[0].text, '第一句。')
  assert.equal(items[1].text, '第二句！')
  assert.equal(items[2].text, '还有第三句？')
  assert.ok(items[0].sentenceId.includes(':'))
})

test('merges tiny fragments', () => {
  const items = splitSentences('他说。好的。')
  assert.ok(items.length >= 1)
  assert.ok(items.some(item => item.text.includes('他说')))
})

test('cache key includes model, direction and prompt version', () => {
  assert.equal(
    cacheKey({ bookId: '1', chapterUid: '2', sentenceId: '0:abc', direction: 'zh-en', modelId: 'p/m' }),
    '1|2|0:abc|zh-en|p/m|v1',
  )
  assert.equal(
    cacheKey({
      bookId: '1',
      chapterUid: '2',
      sentenceId: '0:abc',
      direction: 'zh-en',
      modelId: 'p/m',
      promptVersion: 'v2',
    }),
    '1|2|0:abc|zh-en|p/m|v2',
  )
})
