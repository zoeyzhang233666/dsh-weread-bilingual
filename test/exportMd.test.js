import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBilingualMarkdown,
  defaultExportStem,
  escapeMdCell,
  sanitizeFilename,
} from '../packages/client/src/exportMd.js'

test('sanitizeFilename strips illegal characters', () => {
  assert.equal(sanitizeFilename('A<>:"/\\|?*B'), 'A B')
  assert.equal(sanitizeFilename('  章节.  '), '章节')
})

test('defaultExportStem uses book + chapter + 双语', () => {
  assert.equal(defaultExportStem('三体', '第一章'), '三体-第一章-双语')
})

test('escapeMdCell keeps table rows intact', () => {
  assert.equal(escapeMdCell('a|b\nc'), 'a\\|b<br>c')
})

test('buildBilingualMarkdown writes a bilingual table', () => {
  const result = buildBilingualMarkdown({
    bookTitle: '三体',
    chapterTitle: '第一章',
    author: '刘慈欣',
    direction: 'zh-en',
    sentences: [
      { sentenceId: 's1', text: '你好。' },
      { sentenceId: 's2', text: '世界。' },
    ],
    translations: { s1: 'Hello.' },
  })
  assert.match(result.markdown, /\| 中文 \| English \|/)
  assert.match(result.markdown, /\| 你好。 \| Hello\. \|/)
  assert.match(result.markdown, /\| 世界。 \|  \|/)
  assert.equal(result.translated, 1)
  assert.equal(result.pending, 1)
  assert.equal(result.total, 2)
})
