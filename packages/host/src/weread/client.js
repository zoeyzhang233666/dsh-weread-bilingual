import { calcHash, currentTime, sign } from './sign.js'
import { chk, dH, dS, dT } from './decrypt.js'

const BASE = 'https://weread.qq.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const PS = 'a2b325707a19e580g0186a2'
const PC = '430321207a19e581g013ab0'

function headers(cookie, extra = {}) {
  return {
    Cookie: cookie,
    'User-Agent': UA,
    Referer: 'https://weread.qq.com/',
    Origin: 'https://weread.qq.com',
    ...extra,
  }
}

async function getJson(cookie, path, params = {}) {
  const url = new URL(path, BASE)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  const res = await fetch(url, { headers: headers(cookie) })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function postJson(cookie, path, body) {
  const res = await fetch(new URL(path, BASE), {
    method: 'POST',
    headers: headers(cookie, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function postText(cookie, path, body) {
  const res = await fetch(new URL(path, BASE), {
    method: 'POST',
    headers: headers(cookie, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  return { status: res.status, raw }
}

function unauthorized(status, data) {
  if (status === 401 || status === 403) return true
  const code = data?.errCode ?? data?.errcode
  return code === -2012 || code === -2010 || code === -2013 || code === -12013
}

export async function getUser(cookie) {
  const { status, data } = await getJson(cookie, '/web/user')
  if (unauthorized(status, data)) throw new Error('Login expired. Re-import your Weread Cookie.')
  if (status >= 400) throw new Error(`Weread HTTP ${status}`)
  return data
}

export async function getShelf(cookie) {
  const { status, data } = await getJson(cookie, '/web/shelf/sync')
  if (unauthorized(status, data)) throw new Error('Login expired. Re-import your Weread Cookie.')
  if (status >= 400) throw new Error(`Weread HTTP ${status}`)
  const books = Array.isArray(data.books) ? data.books : []
  const progress = {}
  for (const row of data.bookProgress ?? []) {
    if (!row?.bookId) continue
    progress[row.bookId] = {
      bookId: row.bookId,
      chapterUid: row.chapterUid,
      chapterIdx: row.chapterIdx,
      progress: row.progress,
      finished: row.finished,
      updateTime: row.updateTime,
    }
  }
  return {
    books: books.map(book => ({
      bookId: book.bookId,
      title: book.title ?? book.book?.title ?? 'Untitled',
      author: book.author ?? book.book?.author ?? '',
      cover: book.cover ?? book.book?.cover ?? '',
      progress: book.progress ?? progress[book.bookId]?.progress,
      finished: book.finished ?? progress[book.bookId]?.finished,
      format: book.format ?? book.book?.format,
    })),
    progress,
  }
}

export async function getChapters(cookie, bookId) {
  const { status, data } = await postJson(cookie, '/web/book/chapterInfos', {
    bookIds: [bookId],
    synckeys: [0],
  })
  if (unauthorized(status, data)) throw new Error('Login expired. Re-import your Weread Cookie.')
  if (status >= 400) throw new Error(`Weread HTTP ${status}`)
  const entry = (data.data ?? []).find(item => item.bookId === bookId)
  return (entry?.updated ?? []).map((chapter, index) => ({
    chapterUid: chapter.chapterUid,
    chapterIdx: chapter.chapterIdx ?? index,
    title: chapter.title ?? `Chapter ${index + 1}`,
    level: chapter.level ?? 1,
  }))
}

async function fetchShard(cookie, shard, bookId, chapterUid, st) {
  const payload = {
    b: calcHash(bookId),
    c: calcHash(chapterUid),
    r: Math.pow(Math.floor(10000 * Math.random()), 2),
    st,
    ct: currentTime(),
    ps: PS,
    pc: PC,
  }
  payload.s = sign(payload)
  const { status, raw } = await postText(cookie, `/web/book/chapter/${shard}`, payload)
  if (status < 200 || status >= 400 || !raw) return ''
  return chk(raw)
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function getChapterContent(cookie, bookId, chapterUid) {
  const info = await getJson(cookie, '/web/book/info', { bookId })
  if (unauthorized(info.status, info.data)) {
    throw new Error('Login expired. Re-import your Weread Cookie.')
  }
  const biz = info.data?.errCode ?? info.data?.errcode
  if (biz === -2012 || biz === -2010 || biz === -2013 || biz === -12013) {
    throw new Error('Login expired. Re-import your Weread Cookie.')
  }
  const format = info.data?.format || ''
  if (!format) {
    throw new Error('Could not read book format. The chapter may be paid, restricted, or the login is weak.')
  }

  const uid = Number(chapterUid)
  if (format === 'epub' || format === 'pdf') {
    const [r0, r1, r2, r3] = await Promise.all([
      fetchShard(cookie, 'e_0', bookId, uid, 0),
      fetchShard(cookie, 'e_1', bookId, uid, 0),
      fetchShard(cookie, 'e_2', bookId, uid, 1),
      fetchShard(cookie, 'e_3', bookId, uid, 0),
    ])
    if (!(r0 && r1 && r3)) {
      throw new Error('Chapter shards failed checksum. Try re-login, or the chapter may be paid/trial-only.')
    }
    const html = dH(r0 + r1 + r3)
    return { format, text: stripHtml(html), html, style: r2 ? dS(r2) : '' }
  }

  if (format === 'txt') {
    const [t0, t1] = await Promise.all([
      fetchShard(cookie, 't_0', bookId, uid, 0),
      fetchShard(cookie, 't_1', bookId, uid, 1),
    ])
    if (!(t0 && t1)) {
      throw new Error('Chapter shards failed checksum. Try re-login, or the chapter may be paid/trial-only.')
    }
    const content = dT(t0 + t1)
    return { format, text: content.trim(), html: '', style: '' }
  }

  throw new Error(`Unsupported Weread format: ${format}`)
}

export async function reportRead(cookie, { bookId, chapterUid, chapterIdx, rt, pr = 0 }) {
  const payload = {
    appId: 'wereader.dsh',
    b: calcHash(bookId),
    c: calcHash(chapterUid),
    ci: chapterIdx ?? 0,
    co: 0,
    sm: '',
    pr,
    rt: Math.max(1, Math.round(rt || 1)),
    ts: Date.now(),
    rn: Math.floor(Math.random() * 1000),
    ps: PS,
    pc: PC,
    ct: currentTime(),
  }
  payload.s = sign(payload)
  try {
    const { status } = await postJson(cookie, '/web/book/read', payload)
    return status >= 200 && status < 300
  } catch {
    return false
  }
}
