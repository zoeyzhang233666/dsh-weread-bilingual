import z from '@deepseek-ai/schemastery'
import { pathname, readJson, sendJson } from './http.js'
import { createReadingClock } from './reading.js'
import { normalizeDisplayMode, normalizeTranslationTheme } from './prefs.js'
import { cacheKey, splitSentences } from './sentences.js'
import { createTranslator, currentModelLabel, TRANSLATE_PROMPT_VERSION } from './translate.js'
import * as weread from './weread/client.js'

export const name = 'weread-bilingual-host'
export const inject = ['webServer', 'settings']

export const Config = z.object({
  cookie: z.string().default('').volatile(),
  direction: z.string().default('zh-en').volatile(),
  autoTranslate: z.boolean().default(true).volatile(),
  displayMode: z.string().default('hover').volatile(),
  translationTheme: z.string().default('plain').volatile(),
})

const API = '/weread-bilingual/api'
const translationCache = new Map()

function live(value, fallback) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    return value.get()
  }
  return value ?? fallback
}

function settingsOf(config) {
  const raw = config && typeof config === 'object' ? config : {}
  return {
    get cookie() { return String(live(raw.cookie, '') || '') },
    get direction() {
      const value = String(live(raw.direction, 'zh-en') || 'zh-en')
      return value === 'en-zh' ? 'en-zh' : 'zh-en'
    },
    get autoTranslate() {
      const value = live(raw.autoTranslate, true)
      return value !== false
    },
    get displayMode() {
      return normalizeDisplayMode(live(raw.displayMode, 'hover'))
    },
    get translationTheme() {
      return normalizeTranslationTheme(live(raw.translationTheme, 'plain'))
    },
  }
}

function requireCookie(settings, res) {
  if (settings.cookie.trim()) return settings.cookie.trim()
  sendJson(res, 401, { error: 'Import a Weread Cookie in the Weread reader settings.' })
  return null
}

export function apply(ctx, config) {
  const settings = settingsOf(config)
  const clocks = new Map()
  const translate = createTranslator(
    () => ctx.get('llm'),
    () => ctx.get('agentDefaultModel'),
  )

  const persist = async (patch) => {
    const writer = ctx.get('settings')
    if (!writer?.mutate) throw new Error('Settings service unavailable.')
    const ops = Object.entries(patch).map(([path, value]) => ({ op: 'set', path: [path], value }))
    await writer.mutate(name, ops)
  }

  async function handle(req, res) {
    const path = pathname(req)
    try {
      if (path === `${API}/status` && req.method === 'GET') {
        sendJson(res, 200, {
          loggedIn: Boolean(settings.cookie.trim()),
          direction: settings.direction,
          autoTranslate: settings.autoTranslate,
          displayMode: settings.displayMode,
          translationTheme: settings.translationTheme,
          model: currentModelLabel(() => ctx.get('agentDefaultModel')),
        })
        return
      }

      if (path === `${API}/auth/cookie` && req.method === 'POST') {
        const body = await readJson(req)
        const cookie = String(body.cookie || '').trim()
        if (!cookie) {
          sendJson(res, 400, { error: 'Cookie is required.' })
          return
        }
        await weread.getUser(cookie)
        await persist({ cookie })
        sendJson(res, 200, { ok: true })
        return
      }

      if (path === `${API}/auth/logout` && req.method === 'POST') {
        await persist({ cookie: '' })
        sendJson(res, 200, { ok: true })
        return
      }

      if (path === `${API}/prefs` && req.method === 'POST') {
        const body = await readJson(req)
        const patch = {}
        if (body.direction === 'zh-en' || body.direction === 'en-zh') patch.direction = body.direction
        if (typeof body.autoTranslate === 'boolean') patch.autoTranslate = body.autoTranslate
        if (body.displayMode != null) patch.displayMode = normalizeDisplayMode(body.displayMode)
        if (body.translationTheme != null) patch.translationTheme = normalizeTranslationTheme(body.translationTheme)
        if (Object.keys(patch).length) await persist(patch)
        sendJson(res, 200, {
          direction: settings.direction,
          autoTranslate: settings.autoTranslate,
          displayMode: settings.displayMode,
          translationTheme: settings.translationTheme,
        })
        return
      }

      if (path === `${API}/shelf` && req.method === 'GET') {
        const cookie = requireCookie(settings, res)
        if (!cookie) return
        const shelf = await weread.getShelf(cookie)
        sendJson(res, 200, shelf)
        return
      }

      if (path === `${API}/chapters` && req.method === 'GET') {
        const cookie = requireCookie(settings, res)
        if (!cookie) return
        const url = new URL(req.url || '/', 'http://localhost')
        const bookId = url.searchParams.get('bookId')
        if (!bookId) {
          sendJson(res, 400, { error: 'bookId required' })
          return
        }
        const chapters = await weread.getChapters(cookie, bookId)
        sendJson(res, 200, { chapters })
        return
      }

      if (path === `${API}/chapter` && req.method === 'GET') {
        const cookie = requireCookie(settings, res)
        if (!cookie) return
        const url = new URL(req.url || '/', 'http://localhost')
        const bookId = url.searchParams.get('bookId')
        const chapterUid = url.searchParams.get('chapterUid')
        if (!bookId || !chapterUid) {
          sendJson(res, 400, { error: 'bookId and chapterUid required' })
          return
        }
        const content = await weread.getChapterContent(cookie, bookId, chapterUid)
        const sentences = splitSentences(content.text)
        sendJson(res, 200, {
          format: content.format,
          text: content.text,
          sentences,
          direction: settings.direction,
        })
        return
      }

      if (path === `${API}/translate` && req.method === 'POST') {
        const cookie = requireCookie(settings, res)
        if (!cookie) return
        const body = await readJson(req)
        const text = String(body.text || '').trim()
        const bookId = String(body.bookId || '')
        const chapterUid = String(body.chapterUid || '')
        const sentenceId = String(body.sentenceId || '')
        const direction = body.direction === 'en-zh' ? 'en-zh' : 'zh-en'
        const previous = String(body.previous || '')
        const force = body.force === true
        if (!text || !sentenceId) {
          sendJson(res, 400, { error: 'text and sentenceId required' })
          return
        }
        const model = currentModelLabel(() => ctx.get('agentDefaultModel'))
        const key = cacheKey({
          bookId,
          chapterUid,
          sentenceId,
          direction,
          modelId: model?.modelId,
          promptVersion: TRANSLATE_PROMPT_VERSION,
        })
        if (!force && translationCache.has(key)) {
          sendJson(res, 200, { translation: translationCache.get(key), cached: true, model })
          return
        }
        if (force) translationCache.delete(key)
        const result = await translate({ text, direction, previous, signal: AbortSignal.timeout(90_000) })
        translationCache.set(key, result.translation)
        if (translationCache.size > 2000) {
          const first = translationCache.keys().next().value
          translationCache.delete(first)
        }
        sendJson(res, 200, { translation: result.translation, cached: false, model: result })
        return
      }

      if (path === `${API}/reading/focus` && req.method === 'POST') {
        const body = await readJson(req)
        const key = `${body.bookId}:${body.chapterUid}`
        const clock = clocks.get(key) ?? createReadingClock()
        clocks.set(key, clock)
        clock.focus()
        sendJson(res, 200, { ok: true })
        return
      }

      if (path === `${API}/reading/blur` && req.method === 'POST') {
        const body = await readJson(req)
        const key = `${body.bookId}:${body.chapterUid}`
        clocks.get(key)?.blur()
        sendJson(res, 200, { ok: true })
        return
      }

      if (path === `${API}/reading/heartbeat` && req.method === 'POST') {
        const cookie = requireCookie(settings, res)
        if (!cookie) return
        const body = await readJson(req)
        const key = `${body.bookId}:${body.chapterUid}`
        const clock = clocks.get(key) ?? createReadingClock()
        clocks.set(key, clock)
        if (body.focused !== false) clock.focus()
        else clock.blur()
        const rt = clock.takeSeconds()
        if (rt <= 0) {
          sendJson(res, 200, { ok: true, rt: 0, reported: false })
          return
        }
        const reported = await weread.reportRead(cookie, {
          bookId: body.bookId,
          chapterUid: body.chapterUid,
          chapterIdx: body.chapterIdx ?? 0,
          rt,
          pr: body.pr ?? 0,
        })
        sendJson(res, 200, { ok: true, rt, reported })
        return
      }

      sendJson(res, 404, { error: 'not found' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendJson(res, 502, { error: message })
    }
  }

  ctx.effect(() => {
    console.log('[weread-bilingual] host loaded')
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: API,
      handler: (req, res) => {
        handle(req, res).catch(error => {
          if (!res.headersSent) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
          }
        })
      },
    })
    return () => {
      dispose()
      console.log('[weread-bilingual] host unloaded')
    }
  })
}
