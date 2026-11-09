import { useCallback, useEffect, useRef, useState } from 'react'
import { createApi } from './api.js'
import { buildBilingualMarkdown, defaultExportStem, saveMarkdownFile } from './exportMd.js'
import {
  modeAllowsAutoQueue,
  modeLabel,
  nextDisplayMode,
  nextTranslationTheme,
  normalizeDisplayMode,
  normalizeTranslationTheme,
  readLocalDisplayMode,
  readLocalTranslationTheme,
  themeLabel,
  writeLocalDisplayMode,
  writeLocalTranslationTheme,
} from './prefs.js'
import { CSS, CSS_VERSION } from './styles.js'

const api = createApi()
const PREFETCH = 12

function useStyles() {
  useEffect(() => {
    const id = 'wrb-styles'
    let style = document.getElementById(id)
    if (!style) {
      style = document.createElement('style')
      style.id = id
      document.head.appendChild(style)
    }
    if (style.dataset.wrbVersion !== CSS_VERSION) {
      style.dataset.wrbVersion = CSS_VERSION
      style.textContent = CSS
    }
  }, [])
}

function isTypingTarget(target) {
  if (!target || !(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function SentenceRow({
  sentence,
  translation,
  error,
  theme,
  revealed,
  active,
  showTranslate,
  registerRow,
  onHover,
  onLeave,
  onTranslate,
}) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    if (!node || !registerRow) return undefined
    registerRow(node, sentence)
    return () => registerRow(node, null)
  }, [registerRow, sentence])

  return (
    <div
      className="wrb-row"
      ref={ref}
      data-sid={sentence.sentenceId}
      data-revealed={revealed ? '1' : '0'}
      data-active={active ? '1' : '0'}
      onMouseEnter={() => onHover?.(sentence)}
      onMouseLeave={() => onLeave?.(sentence)}
      onClick={() => onHover?.(sentence)}
    >
      <div className="wrb-cell wrb-cell-src">{sentence.text}</div>
      <div className="wrb-cell wrb-cell-tr" data-theme={theme}>
        <div className="wrb-tr-body">
          {translation
            ? <span className="wrb-tr-text">{translation}</span>
            : error
              ? <span className="wrb-pending">{error}</span>
              : <span className="wrb-pending">…</span>}
          <div className="wrb-actions">
            {showTranslate ? (
              <button type="button" className="wrb-action" onClick={() => onTranslate?.(sentence)}>Translate</button>
            ) : null}
            {error ? (
              <button type="button" className="wrb-action" onClick={() => onTranslate?.(sentence)}>Retry</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReaderPanel() {
  useStyles()
  const [tab, setTab] = useState('shelf')
  const [status, setStatus] = useState(null)
  const [cookieDraft, setCookieDraft] = useState('')
  const [books, setBooks] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [book, setBook] = useState(null)
  const [chapters, setChapters] = useState([])
  const [chapterIdx, setChapterIdx] = useState(0)
  const [sentences, setSentences] = useState([])
  const [translations, setTranslations] = useState({})
  const [errors, setErrors] = useState({})
  const [showToc, setShowToc] = useState(false)
  const [displayMode, setDisplayMode] = useState(() => readLocalDisplayMode())
  const [translationTheme, setTranslationTheme] = useState(() => readLocalTranslationTheme())
  const [revealed, setRevealed] = useState(() => new Set())
  const [activeId, setActiveId] = useState(null)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef(null)

  const bodyRef = useRef(null)
  const queueRef = useRef([])
  const queuedIdsRef = useRef(new Set())
  const busyRef = useRef(false)
  const translationsRef = useRef({})
  const sentencesRef = useRef([])
  const bookRef = useRef(null)
  const chapterRef = useRef(null)
  const statusRef = useRef(null)
  const displayModeRef = useRef('hover')
  const heartbeatRef = useRef(null)
  const observerRef = useRef(null)
  const nodesRef = useRef(new Map())
  const loadingRef = useRef(false)
  const tabRef = useRef(tab)
  const chapterIdxRef = useRef(chapterIdx)
  const chaptersRef = useRef(chapters)

  translationsRef.current = translations
  sentencesRef.current = sentences
  bookRef.current = book
  chapterRef.current = chapters[chapterIdx] || null
  statusRef.current = status
  displayModeRef.current = displayMode
  loadingRef.current = loading
  tabRef.current = tab
  chapterIdxRef.current = chapterIdx
  chaptersRef.current = chapters

  const chapter = chapters[chapterIdx] || null
  const modelLabel = status?.model ? `${status.model.provider}/${status.model.model}` : 'no model'
  const canPrev = Boolean(book && chapterIdx > 0 && !loading)
  const canNext = Boolean(book && chapterIdx < chapters.length - 1 && !loading)
  const autoAllowed = modeAllowsAutoQueue(displayMode)
  const autoOn = autoAllowed && status?.autoTranslate !== false

  const showToast = useCallback((message) => {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2_800)
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const refreshStatus = useCallback(async () => {
    const next = await api.status()
    setStatus(next)
    // Only apply server values when present; otherwise keep local / localStorage choice.
    if (next.displayMode != null && next.displayMode !== '') {
      const mode = normalizeDisplayMode(next.displayMode)
      setDisplayMode(mode)
      displayModeRef.current = mode
      writeLocalDisplayMode(mode)
    }
    if (next.translationTheme != null && next.translationTheme !== '') {
      const theme = normalizeTranslationTheme(next.translationTheme)
      setTranslationTheme(theme)
      writeLocalTranslationTheme(theme)
    }
    return next
  }, [])

  const loadShelf = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await refreshStatus()
      if (!next.loggedIn) {
        setBooks([])
        return
      }
      const shelf = await api.shelf()
      setBooks(shelf.books || [])
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [refreshStatus])

  useEffect(() => {
    void loadShelf()
  }, [loadShelf])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const startHeartbeat = useCallback((payload) => {
    stopHeartbeat()
    void api.focus(payload).catch(() => {})
    heartbeatRef.current = setInterval(() => {
      void api.heartbeat({ ...payload, focused: document.visibilityState === 'visible' }).catch(() => {})
    }, 15_000)
  }, [stopHeartbeat])

  useEffect(() => () => stopHeartbeat(), [stopHeartbeat])

  const clearQueue = useCallback(() => {
    queueRef.current = []
    queuedIdsRef.current = new Set()
  }, [])

  const pumpQueue = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      while (queueRef.current.length) {
        const job = queueRef.current.shift()
        if (!job?.sentence) continue
        const { sentence, force = false, manual = false } = job
        queuedIdsRef.current.delete(sentence.sentenceId)
        const currentBook = bookRef.current
        const currentChapter = chapterRef.current
        const currentStatus = statusRef.current
        if (!currentBook || !currentChapter) continue
        if (!force && translationsRef.current[sentence.sentenceId]) continue
        if (!manual && !force) {
          if (currentStatus?.autoTranslate === false) continue
          if (!modeAllowsAutoQueue(displayModeRef.current)) continue
        }
        const previous = sentencesRef.current[sentence.index - 1]?.text || ''
        try {
          const result = await api.translate({
            bookId: currentBook.bookId,
            chapterUid: currentChapter.chapterUid,
            sentenceId: sentence.sentenceId,
            text: sentence.text,
            previous,
            direction: currentStatus?.direction || 'zh-en',
            force: force || undefined,
          })
          setTranslations(prev => ({ ...prev, [sentence.sentenceId]: result.translation }))
          setErrors(prev => {
            if (!prev[sentence.sentenceId]) return prev
            const next = { ...prev }
            delete next[sentence.sentenceId]
            return next
          })
          setRevealed(prev => {
            if (prev.has(sentence.sentenceId)) return prev
            const next = new Set(prev)
            next.add(sentence.sentenceId)
            return next
          })
        } catch (err) {
          setErrors(prev => ({ ...prev, [sentence.sentenceId]: err.message || String(err) }))
          setRevealed(prev => {
            const next = new Set(prev)
            next.add(sentence.sentenceId)
            return next
          })
        }
      }
    } finally {
      busyRef.current = false
      if (queueRef.current.length) void pumpQueue()
    }
  }, [])

  const enqueue = useCallback((sentence, options = {}) => {
    if (!sentence) return
    const force = options.force === true
    const manual = options.manual === true || force
    const priority = options.priority === true
    if (!force && translationsRef.current[sentence.sentenceId]) {
      if (manual || displayModeRef.current === 'hover') {
        setRevealed(prev => {
          if (prev.has(sentence.sentenceId)) return prev
          const next = new Set(prev)
          next.add(sentence.sentenceId)
          return next
        })
      }
      return
    }
    if (queuedIdsRef.current.has(sentence.sentenceId) && !force) return
    if (force) {
      setTranslations(prev => {
        if (!prev[sentence.sentenceId]) return prev
        const next = { ...prev }
        delete next[sentence.sentenceId]
        return next
      })
      queuedIdsRef.current.delete(sentence.sentenceId)
      queueRef.current = queueRef.current.filter(job => job.sentence?.sentenceId !== sentence.sentenceId)
    }
    queuedIdsRef.current.add(sentence.sentenceId)
    const job = { sentence, force, manual }
    if (priority) queueRef.current.unshift(job)
    else queueRef.current.push(job)
    void pumpQueue()
  }, [pumpQueue])

  const enqueueWindow = useCallback((fromIndex = 0, count = PREFETCH) => {
    if (!modeAllowsAutoQueue(displayModeRef.current)) return
    if (statusRef.current?.autoTranslate === false) return
    const list = sentencesRef.current
    for (let i = fromIndex; i < Math.min(list.length, fromIndex + count); i++) {
      enqueue(list[i])
    }
  }, [enqueue])

  const resetTranslationState = () => {
    setTranslations({})
    setErrors({})
    setRevealed(new Set())
    setActiveId(null)
    clearQueue()
    busyRef.current = false
  }

  const openChapter = useCallback(async (currentBook, currentChapter, index = chapterIdx, all = chapters) => {
    setLoading(true)
    setError('')
    resetTranslationState()
    try {
      const body = await api.chapter(currentBook.bookId, currentChapter.chapterUid)
      const nextSentences = body.sentences || []
      setSentences(nextSentences)
      sentencesRef.current = nextSentences
      setChapterIdx(index)
      setChapters(all)
      if (bodyRef.current) bodyRef.current.scrollTop = 0
      startHeartbeat({
        bookId: currentBook.bookId,
        chapterUid: currentChapter.chapterUid,
        chapterIdx: currentChapter.chapterIdx ?? index,
      })
      if (modeAllowsAutoQueue(displayModeRef.current) && statusRef.current?.autoTranslate !== false) {
        for (let i = 0; i < Math.min(nextSentences.length, PREFETCH); i++) enqueue(nextSentences[i])
      }
    } catch (err) {
      setError(err.message || String(err))
      setSentences([])
    } finally {
      setLoading(false)
    }
  }, [chapterIdx, chapters, clearQueue, enqueue, startHeartbeat])

  const goPrev = useCallback(() => {
    const currentBook = bookRef.current
    const idx = chapterIdxRef.current
    const list = chaptersRef.current
    if (!currentBook || loadingRef.current || idx <= 0) return
    void openChapter(currentBook, list[idx - 1], idx - 1, list)
  }, [openChapter])

  const goNext = useCallback(() => {
    const currentBook = bookRef.current
    const idx = chapterIdxRef.current
    const list = chaptersRef.current
    if (!currentBook || loadingRef.current || idx >= list.length - 1) return
    void openChapter(currentBook, list[idx + 1], idx + 1, list)
  }, [openChapter])

  const openBook = async (item) => {
    setLoading(true)
    setError('')
    try {
      const list = await api.chapters(item.bookId)
      const chaptersNext = list.chapters || []
      setBook(item)
      bookRef.current = item
      setChapters(chaptersNext)
      setChapterIdx(0)
      setTab('reading')
      if (chaptersNext[0]) await openChapter(item, chaptersNext[0], 0, chaptersNext)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const registerRow = useCallback((node, sentence) => {
    if (!node) return
    if (sentence) {
      nodesRef.current.set(node, sentence)
      node.setAttribute('data-sid', sentence.sentenceId)
      observerRef.current?.observe(node)
    } else {
      observerRef.current?.unobserve(node)
      nodesRef.current.delete(node)
    }
  }, [])

  useEffect(() => {
    const root = bodyRef.current
    if (!root || !autoAllowed) {
      observerRef.current?.disconnect()
      observerRef.current = null
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const sentence = nodesRef.current.get(entry.target)
          || sentencesRef.current.find(item => item.sentenceId === entry.target.getAttribute('data-sid'))
        if (!sentence) continue
        enqueue(sentence)
        enqueueWindow(sentence.index + 1, PREFETCH)
      }
    }, { root, rootMargin: '240px 0px', threshold: 0.01 })
    observerRef.current = observer
    for (const node of nodesRef.current.keys()) observer.observe(node)
    return () => {
      observer.disconnect()
      if (observerRef.current === observer) observerRef.current = null
    }
  }, [autoAllowed, enqueue, enqueueWindow, tab, book, chapterIdx])

  useEffect(() => {
    const root = bodyRef.current
    if (!root || tab !== 'reading' || !autoAllowed) return undefined
    const onScroll = () => {
      for (const [node, sentence] of nodesRef.current) {
        const rect = node.getBoundingClientRect()
        const rootRect = root.getBoundingClientRect()
        if (rect.bottom >= rootRect.top - 240 && rect.top <= rootRect.bottom + 240) {
          enqueue(sentence)
          enqueueWindow(sentence.index + 1, PREFETCH)
        }
      }
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => root.removeEventListener('scroll', onScroll)
  }, [autoAllowed, enqueue, enqueueWindow, tab, sentences])

  useEffect(() => {
    const onVis = () => {
      if (!book || !chapter) return
      const payload = {
        bookId: book.bookId,
        chapterUid: chapter.chapterUid,
        chapterIdx: chapter.chapterIdx ?? chapterIdx,
      }
      if (document.visibilityState === 'visible') void api.focus(payload).catch(() => {})
      else void api.blur(payload).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [book, chapter, chapterIdx])

  const saveCookie = async () => {
    setLoading(true)
    setError('')
    try {
      await api.saveCookie(cookieDraft)
      setCookieDraft('')
      await loadShelf()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const toggleAuto = useCallback(async ({ announce = false } = {}) => {
    if (!modeAllowsAutoQueue(displayModeRef.current)) {
      if (announce) showToast('按需模式：悬停句子即可翻译')
      return
    }
    const next = !(statusRef.current?.autoTranslate !== false)
    await api.prefs({ autoTranslate: next })
    await refreshStatus()
    if (next) {
      enqueueWindow(0, PREFETCH)
      if (announce) showToast('自动翻译已继续（空格可暂停）')
    } else {
      clearQueue()
      if (announce) showToast('自动翻译已暂停（空格可继续）')
    }
  }, [clearQueue, enqueueWindow, refreshStatus, showToast])

  const cycleMode = async (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    const next = nextDisplayMode(displayModeRef.current)
    setDisplayMode(next)
    displayModeRef.current = next
    writeLocalDisplayMode(next)
    try {
      const res = await api.prefs({ displayMode: next })
      if (res?.displayMode != null) {
        const mode = normalizeDisplayMode(res.displayMode)
        setDisplayMode(mode)
        displayModeRef.current = mode
        writeLocalDisplayMode(mode)
      }
      setStatus(prev => (prev ? { ...prev, displayMode: next } : prev))
    } catch (err) {
      showToast(err.message || '无法保存显示模式')
    }
    if (!modeAllowsAutoQueue(next)) {
      clearQueue()
      showToast(next === 'hover' ? '悬停模式：悬停句子翻译' : `已切换到 ${modeLabel(next)}`)
    } else {
      if (statusRef.current?.autoTranslate !== false) enqueueWindow(0, PREFETCH)
      showToast(`已切换到 ${modeLabel(next)}`)
    }
  }

  const cycleTheme = async (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    const next = nextTranslationTheme(translationTheme)
    setTranslationTheme(next)
    writeLocalTranslationTheme(next)
    try {
      const res = await api.prefs({ translationTheme: next })
      if (res?.translationTheme != null) {
        const theme = normalizeTranslationTheme(res.translationTheme)
        setTranslationTheme(theme)
        writeLocalTranslationTheme(theme)
      }
      setStatus(prev => (prev ? { ...prev, translationTheme: next } : prev))
      showToast(`译文样式：${themeLabel(next)}`)
    } catch (err) {
      showToast(err.message || '无法保存译文样式')
    }
  }

  const onRowHover = useCallback((sentence) => {
    setActiveId(sentence.sentenceId)
    if (displayModeRef.current !== 'hover') return
    setRevealed(prev => {
      if (prev.has(sentence.sentenceId)) return prev
      const next = new Set(prev)
      next.add(sentence.sentenceId)
      return next
    })
    enqueue(sentence, { manual: true, priority: true })
  }, [enqueue])

  const onRowLeave = useCallback(() => {
    setActiveId(null)
  }, [])

  const translateSentence = useCallback((sentence) => {
    setRevealed(prev => {
      const next = new Set(prev)
      next.add(sentence.sentenceId)
      return next
    })
    enqueue(sentence, { manual: true, priority: true })
  }, [enqueue])

  useEffect(() => {
    const onKey = (event) => {
      if (tabRef.current !== 'reading' || !bookRef.current) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (isTypingTarget(event.target)) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        goNext()
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        goPrev()
      } else if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault()
        void toggleAuto({ announce: true })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, toggleAuto])

  const toggleDirection = async () => {
    const next = status?.direction === 'en-zh' ? 'zh-en' : 'en-zh'
    await api.prefs({ direction: next })
    resetTranslationState()
    await refreshStatus()
    if (modeAllowsAutoQueue(displayModeRef.current)) enqueueWindow(0, PREFETCH)
  }

  const exportChapterMd = async () => {
    if (!book || !sentences.length) {
      showToast('当前章节没有可导出的句子')
      return
    }
    const stem = defaultExportStem(book.title, chapter?.title)
    const { markdown, translated, total, pending } = buildBilingualMarkdown({
      bookTitle: book.title,
      chapterTitle: chapter?.title,
      author: book.author,
      direction: status?.direction || 'zh-en',
      sentences,
      translations,
    })
    try {
      const saved = await saveMarkdownFile(`${stem}.md`, markdown)
      const note = pending
        ? `已保存 ${saved.name}（已译 ${translated}/${total}，未译 ${pending} 句留空）`
        : `已保存 ${saved.name}（${translated}/${total} 句）`
      showToast(note)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err.message || String(err))
    }
  }

  const rowRevealed = (sentenceId) => {
    if (displayMode !== 'hover') return true
    return revealed.has(sentenceId)
  }

  return (
    <div className="wrb-root" data-mode={displayMode} data-theme={translationTheme}>
      <div className="wrb-top">
        <button type="button" className="wrb-tab" data-active={tab === 'shelf' ? '1' : '0'} onClick={() => setTab('shelf')}>Shelf</button>
        <button type="button" className="wrb-tab" data-active={tab === 'reading' ? '1' : '0'} onClick={() => setTab('reading')} disabled={!book}>Reading</button>
        <div className="wrb-spacer" />
        <span className="wrb-meta">{modelLabel}</span>
      </div>
      <div className="wrb-body" ref={bodyRef}>
        {error ? <div className="wrb-error">{error}</div> : null}
        {tab === 'shelf' ? (
          !status?.loggedIn ? (
            <div className="wrb-login">
              <h3>Import WeChat Reading Cookie</h3>
              <p>Open weread.qq.com in a browser, sign in, copy the request Cookie, and paste it here. The plugin stores it in this DSH profile only.</p>
              <textarea value={cookieDraft} onChange={event => setCookieDraft(event.target.value)} placeholder="wr_vid=...; wr_skey=...; ..." />
              <button type="button" className="wrb-btn primary" onClick={saveCookie} disabled={loading || !cookieDraft.trim()}>Save Cookie</button>
            </div>
          ) : (
            <div className="wrb-shelf">
              <div className="wrb-reader-head">
                <button type="button" className="wrb-btn" onClick={loadShelf} disabled={loading}>Refresh</button>
                <button type="button" className="wrb-btn" onClick={async () => { await api.logout(); await loadShelf() }}>Log out</button>
                <span className="wrb-meta">{books.length} books</span>
              </div>
              {books.length === 0 && !loading ? <div className="wrb-empty">Shelf is empty.</div> : null}
              {books.map(item => (
                <button key={item.bookId} type="button" className="wrb-book" onClick={() => openBook(item)}>
                  {item.cover ? <img src={item.cover} alt="" /> : <div />}
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.author}</span>
                  </div>
                  <span>{typeof item.progress === 'number' ? `${item.progress}%` : ''}</span>
                </button>
              ))}
            </div>
          )
        ) : null}

        {tab === 'reading' && book ? (
          <div>
            <div className="wrb-reader-head">
              <h2>{book.title}</h2>
              <button type="button" className="wrb-btn" onClick={() => setShowToc(value => !value)}>Contents</button>
              <button
                type="button"
                className="wrb-btn wrb-btn-toggle"
                onClick={event => { void cycleMode(event) }}
                title="切换显示模式：Hover / Bilingual / Source / Translation"
              >
                {modeLabel(displayMode)}
              </button>
              <button
                type="button"
                className="wrb-btn wrb-btn-toggle"
                onClick={event => { void cycleTheme(event) }}
                title="切换译文样式"
              >
                Theme · {themeLabel(translationTheme)}
              </button>
              {autoAllowed ? (
                <button
                  type="button"
                  className={`wrb-btn${status?.autoTranslate === false ? ' warn' : ''}`}
                  data-active={status?.autoTranslate !== false ? '1' : '0'}
                  onClick={() => void toggleAuto({ announce: true })}
                  title="空格键也可暂停 / 继续自动翻译"
                >
                  {status?.autoTranslate === false ? 'Paused' : 'Auto On'}
                </button>
              ) : null}
              <button type="button" className="wrb-btn" onClick={toggleDirection}>
                {status?.direction === 'en-zh' ? 'EN→ZH' : 'ZH→EN'}
              </button>
              <button
                type="button"
                className="wrb-btn primary"
                onClick={exportChapterMd}
                disabled={!sentences.length}
                title="保存当前章原文与译文为 Markdown 双语表格"
              >
                Save MD
              </button>
            </div>
            {showToc ? (
              <div className="wrb-toc">
                {chapters.map((item, index) => (
                  <button
                    key={item.chapterUid}
                    type="button"
                    data-active={index === chapterIdx ? '1' : '0'}
                    onClick={() => openChapter(book, item, index)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="wrb-chapter-label">{chapter?.title || ''}</div>
            <div className="wrb-cols" data-mode={displayMode}>
              {sentences.map(sentence => {
                const hasTranslation = Boolean(translations[sentence.sentenceId])
                const isRevealed = rowRevealed(sentence.sentenceId)
                return (
                  <SentenceRow
                    key={sentence.sentenceId}
                    sentence={sentence}
                    translation={isRevealed ? translations[sentence.sentenceId] : undefined}
                    error={isRevealed ? errors[sentence.sentenceId] : undefined}
                    theme={translationTheme}
                    revealed={isRevealed}
                    active={activeId === sentence.sentenceId}
                    showTranslate={!hasTranslation && displayMode !== 'source'}
                    registerRow={registerRow}
                    onHover={onRowHover}
                    onLeave={onRowLeave}
                    onTranslate={translateSentence}
                  />
                )
              })}
            </div>
            {!sentences.length && !loading ? <div className="wrb-empty">No readable text in this chapter.</div> : null}
          </div>
        ) : null}
      </div>
      {toast ? <div className="wrb-toast" role="status">{toast}</div> : null}
      {tab === 'reading' && book ? (
        <div className="wrb-bottom-nav" role="navigation" aria-label="Chapter navigation">
          <button
            type="button"
            className="wrb-page-btn"
            disabled={!canPrev}
            onClick={goPrev}
            title="Previous chapter (←)"
            aria-label="Previous chapter"
          >
            ‹
          </button>
          <div className="wrb-page-info">
            <strong>{chapter?.title || book.title}</strong>
            <span>
              {chapters.length ? `${chapterIdx + 1} / ${chapters.length}` : ''}
              {autoAllowed ? ' · ← → · Space pause' : ' · ← → · hover translate'}
            </span>
          </div>
          {autoAllowed ? (
            <button
              type="button"
              className={`wrb-btn wrb-pause-btn${status?.autoTranslate === false ? ' warn' : ' primary'}`}
              onClick={() => void toggleAuto({ announce: true })}
              title="空格键暂停 / 继续自动翻译"
            >
              {status?.autoTranslate === false ? '继续' : '暂停'}
            </button>
          ) : null}
          <button
            type="button"
            className="wrb-page-btn"
            disabled={!canNext}
            onClick={goNext}
            title="Next chapter (→)"
            aria-label="Next chapter"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function ReaderTitle() {
  return 'Weread'
}
