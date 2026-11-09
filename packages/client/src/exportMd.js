/** Escape a Markdown table cell so pipes and newlines do not break the row. */
export function escapeMdCell(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, '<br>')
    .trim()
}

/** Strip characters that are illegal or awkward in filenames. */
export function sanitizeFilename(name) {
  const cleaned = String(name ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  return cleaned || '双语'
}

/** Default stem: 书名 + 章节名 + 双语 */
export function defaultExportStem(bookTitle, chapterTitle) {
  const book = sanitizeFilename(bookTitle || '未命名')
  const chapter = sanitizeFilename(chapterTitle || '本章')
  return sanitizeFilename(`${book}-${chapter}-双语`)
}

/**
 * Build a bilingual Markdown document for the current chapter.
 * @returns {{ markdown: string, translated: number, total: number, pending: number }}
 */
export function buildBilingualMarkdown({
  bookTitle,
  chapterTitle,
  author,
  direction = 'zh-en',
  sentences = [],
  translations = {},
}) {
  const srcHeader = direction === 'en-zh' ? 'English' : '中文'
  const trHeader = direction === 'en-zh' ? '中文' : 'English'
  const lines = [
    `# ${bookTitle || 'Untitled'}`,
    '',
    `- 章节：${chapterTitle || ''}`,
  ]
  if (author) lines.push(`- 作者：${author}`)
  lines.push(`- 方向：${direction === 'en-zh' ? 'EN→ZH' : 'ZH→EN'}`)
  lines.push(`- 导出时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`)
  lines.push('')
  lines.push(`| ${srcHeader} | ${trHeader} |`)
  lines.push('| --- | --- |')

  let translated = 0
  let pending = 0
  for (const sentence of sentences) {
    const source = escapeMdCell(sentence.text)
    const raw = translations[sentence.sentenceId]
    if (raw) translated += 1
    else pending += 1
    const translation = escapeMdCell(raw || '')
    lines.push(`| ${source} | ${translation} |`)
  }

  lines.push('')
  if (pending) {
    lines.push(`> 未译 ${pending} / ${sentences.length} 句（对应单元格留空）。`)
    lines.push('')
  }

  return {
    markdown: lines.join('\n'),
    translated,
    total: sentences.length,
    pending,
  }
}

async function writeWithSavePicker(filename, markdown) {
  const handle = await window.showSaveFilePicker({
    suggestedName: filename.endsWith('.md') ? filename : `${filename}.md`,
    types: [{
      description: 'Markdown',
      accept: { 'text/markdown': ['.md'], 'text/plain': ['.md', '.txt'] },
    }],
  })
  const writable = await handle.createWritable()
  await writable.write(markdown)
  await writable.close()
  return { method: 'picker', name: handle.name || filename }
}

function downloadBlob(filename, markdown) {
  const stem = filename.endsWith('.md') ? filename : `${filename}.md`
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = stem
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2_000)
  return { method: 'download', name: stem }
}

/**
 * Save Markdown: prefer native save dialog (path + rename), else browser download.
 * AbortError from the picker is rethrown so the UI can stay quiet.
 */
export async function saveMarkdownFile(filename, markdown) {
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      return await writeWithSavePicker(filename, markdown)
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      // Some Electron builds expose the API but reject; fall through to download.
    }
  }
  return downloadBlob(filename, markdown)
}
