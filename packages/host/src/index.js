import z from '@deepseek-ai/schemastery'
import { pathname, readJson, sendJson } from './http.js'
import { buildModelCatalog, normalizeModelPreference, resolveRoute } from './modelRoute.js'
import { createReadingClock } from './reading.js'
import { normalizeDisplayMode, normalizeTranslationTheme } from './prefs.js'
import { cacheKey, splitSentences } from './sentences.js'
import { createTranslator, TRANSLATE_PROMPT_VERSION } from './translate.js'
import * as weread from './weread/client.js'
import { createQrSession, finishLoginFromInfo, pollLoginInfo, refreshCookie } from './weread/login.js'

export const name = 'weread-bilingual'
export const inject = ['webServer', 'settings']

export const Config = z.object({
  cookie: z.string().default('').volatile(),
  cookieUpdatedAt: z.number().default(0).volatile(),
  direction: z.string().default('zh-en').volatile(),
  autoTranslate: z.boolean().default(true).volatile(),
  displayMode: z.string().default('hover').volatile(),
  translationTheme: z.string().default('plain').volatile(),
  modelProvider: z.string().default('').volatile(),
  modelId: z.string().default('').volatile(),
})

const API = '/weread-bilingual/api'
const translationCache = new Map()
const COOKIE_REFRESH_MS = 45 * 60 * 1000

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
    get cookieUpdatedAt() {
      const value = Number(live(raw.cookieUpdatedAt, 0) || 0)
      return Number.isFinite(value) ? value : 0
    },
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
    get modelProvider() {
      return String(live(raw.modelProvider, '') || '').trim()
    },
    get modelId() {
      return String(live(raw.modelId, '') || '').trim()
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

  const getRoute = async () => {
    const llm = ctx.get('llm')
    return resolveRoute({
      savedProvider: settings.modelProvider,
      savedModel: settings.modelId,
      dshSelection: ctx.get('agentDefaultModel')?.currentSelection?.() || null,
      listProviders: () => llm?.listProviders?.() || [],
      listModels: (id) => {
        if (!llm?.listModels) throw new Error('Harness LLM service is unavailable.')
        return llm.listModels(id)
      },
    })
  }

  const translate = createTranslator(() => ctx.get('llm'), getRoute)

  const persist = async (patch) => {
    const writer = ctx.get('settings')
    if (!writer?.mutate) throw new Error('Settings service unavailable.')
    const ops = Object.entries(patch).map(([path, value]) => ({ op: 'set', path: [path], value }))
    await writer.mutate(name, ops)
  }

  const saveCookie = async (cookie) => {
    await persist({ cookie, cookieUpdatedAt: Date.now() })
  }

  const maybeRefreshCookie = async ({ force = false } = {}) => {
    const cookie = settings.cookie.trim()
    if (!cookie) return null
    const age = Date.now() - settings.cookieUpdatedAt
    if (!force && settings.cookieUpdatedAt > 0 && age < COOKIE_REFRESH_MS) return cookie
    try {
      const refreshed = await refreshCookie(cookie)
      if (refreshed.changed) {
        const verified = await weread.getUser(refreshed.cookie)
        const next = verified.cookie || refreshed.cookie
        await saveCookie(next)
        return next
      }
      if (settings.cookieUpdatedAt <= 0) await persist({ cookieUpdatedAt: Date.now() })
      return cookie
    } catch {
      return cookie
    }
  }

  const pathIs = (path, suffix) => path === `${API}${suffix}` || path === suffix

  async function handle(req, res) {
    const path = pathname(req)
    try {
      if (pathIs(path, '/status') && req.method === 'GET') {
        if (settings.cookie.trim()) await maybeRefreshCookie()
        const route = await getRoute()
        const model = route
          ? { provider: route.provider, model: route.model, modelId: route.modelId }
          : null
        sendJson(res, 200, {
          loggedIn: Boolean(settings.cookie.trim()),
          direction: settings.direction,
          autoTranslate: settings.autoTranslate,
          displayMode: settings.displayMode,
          translationTheme: settings.translationTheme,
          model,
          modelSource: route?.source,
          modelProvider: settings.modelProvider,
          modelId: settings.modelId,
        })
        return
      }

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

      if (pathIs(path, '/auth/qr/start') && req.method === 'POST') {
        const session = await createQrSession()
        sendJson(res, 200, session)
        return
      }

      if (pathIs(path, '/auth/qr/wait') && req.method === 'POST') {
        const body = await readJson(req)
        const uid = String(body.uid || '').trim()
        if (!uid) {
          sendJson(res, 400, { error: 'uid required' })
          return
        }
        const poll = await pollLoginInfo(uid, { otp: String(body.otp || '') })
        if (poll.status !== 'ok') {
          sendJson(res, 200, {
            status: poll.status,
            error: poll.error || undefined,
          })
          return
        }
        const cookie = await finishLoginFromInfo(poll.info, {
          getUser: weread.getUser,
          refreshCookie,
        })
        await saveCookie(cookie)
        // Warm the shelf once so the first sidebar fetch is less likely empty.
        try { await weread.getShelf(cookie) } catch { /* ignore warm failures */ }
        sendJson(res, 200, { status: 'ok', loggedIn: true })
        return
      }

      if (pathIs(path, '/auth/cookie') && req.method === 'POST') {
        const body = await readJson(req)
        const cookie = String(body.cookie || '').trim()
        if (!cookie) {
          sendJson(res, 400, { error: 'Cookie is required.' })
          return
        }
        const verified = await weread.getUser(cookie)
        await saveCookie(verified.cookie || cookie)
        sendJson(res, 200, { ok: true })
        return
      }

      if (pathIs(path, '/auth/refresh') && req.method === 'POST') {
        const cookie = await maybeRefreshCookie({ force: true })
        if (!cookie) {
          sendJson(res, 401, { error: 'Not logged in.' })
          return
        }
        sendJson(res, 200, { ok: true, loggedIn: true })
        return
      }

      if (pathIs(path, '/auth/logout') && req.method === 'POST') {
        await persist({ cookie: '', cookieUpdatedAt: 0 })
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
        if (body.modelProvider != null || body.modelId != null) {
          const next = normalizeModelPreference(
            body.modelProvider != null ? body.modelProvider : settings.modelProvider,
            body.modelId != null ? body.modelId : settings.modelId,
          )
          patch.modelProvider = next.modelProvider
          patch.modelId = next.modelId
        }
        if (Object.keys(patch).length) await persist(patch)
        sendJson(res, 200, {
          direction: settings.direction,
          autoTranslate: settings.autoTranslate,
          displayMode: settings.displayMode,
          translationTheme: settings.translationTheme,
          modelProvider: settings.modelProvider,
          modelId: settings.modelId,
        })
        return
      }

      if (path === `${API}/shelf` && req.method === 'GET') {
        let cookie = requireCookie(settings, res)
        if (!cookie) return
        cookie = (await maybeRefreshCookie()) || cookie
        try {
          const shelf = await weread.getShelf(cookie)
          sendJson(res, 200, shelf)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (/expired|Login/i.test(message)) {
            const retryCookie = await maybeRefreshCookie({ force: true })
            if (retryCookie && retryCookie !== cookie) {
              const shelf = await weread.getShelf(retryCookie)
              sendJson(res, 200, shelf)
              return
            }
          }
          throw error
        }
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
        try {
          const route = await getRoute()
          const model = route
            ? { provider: route.provider, model: route.model, modelId: route.modelId }
            : null
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
