import { createHash } from 'node:crypto'

const END = /([\u3002\uff01\uff1f\uff1b\u2026]+|[.!?]["')\]]*)/u
const CLOSING = /^[\u201d\u2019\u300d\u300f)）\]]+$/u

export function splitSentences(text) {
  const source = String(text || '').replace(/\r/g, '').trim()
  if (!source) return []

  const chunks = []
  for (const paragraph of source.split(/\n+/)) {
    const line = paragraph.trim()
    if (!line) continue
    let rest = line
    while (rest) {
      const match = END.exec(rest)
      if (!match) {
        chunks.push(rest.trim())
        break
      }
      const end = match.index + match[0].length
      const piece = rest.slice(0, end).trim()
      if (piece) chunks.push(piece)
      rest = rest.slice(end).trim()
    }
  }

  const merged = []
  for (const chunk of chunks) {
    if (!chunk) continue
    const prev = merged[merged.length - 1]
    // Only glue orphan closers / tiny non-terminal scraps onto the previous sentence.
    if (prev && (CLOSING.test(chunk) || (chunk.length < 4 && !END.test(chunk)))) {
      merged[merged.length - 1] = `${prev}${chunk}`
    } else {
      merged.push(chunk)
    }
  }

  return merged.map((sentence, index) => ({
    index,
    text: sentence,
    sentenceId: sentenceId(index, sentence),
  }))
}

export function sentenceId(index, text) {
  const hash = createHash('sha1').update(String(text)).digest('hex').slice(0, 12)
  return `${index}:${hash}`
}

export function cacheKey({ bookId, chapterUid, sentenceId: id, direction, modelId, promptVersion }) {
  return [bookId, chapterUid, id, direction, modelId || 'default', promptVersion || 'v1'].join('|')
}
