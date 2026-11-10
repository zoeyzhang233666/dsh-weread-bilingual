/** Prompt revision — bump when wording changes so in-memory cache keys invalidate. */
export const TRANSLATE_PROMPT_VERSION = 'v2'

function cjkRatio(text) {
  const chars = [...String(text || '')].filter(ch => !/\s/.test(ch))
  if (!chars.length) return 0
  const cjk = chars.filter(ch => /[\u3400-\u9fff\uF900-\uFAFF]/.test(ch)).length
  return cjk / chars.length
}

/** Reject chatty replies and wrong-language outputs. */
export function looksLikeValidTranslation(source, translation, direction = 'zh-en') {
  const src = String(source || '').trim()
  const out = String(translation || '').trim()
  if (!out) return false
  if (out === src) return false

  const chatty = /^(听起来|看起来|似乎|想说说|要不要|需要聊聊|我理解|很抱歉|作为|当然可以)/
  if (chatty.test(out)) return false
  if (/[？?]\s*$/.test(out) && !/[？?]/.test(src) && out.length > src.length * 1.4) return false

  const srcCjk = cjkRatio(src)
  const outCjk = cjkRatio(out)
  if (direction !== 'en-zh') {
    // ZH→EN: translation should not stay mostly Chinese.
    if (srcCjk >= 0.4 && outCjk >= 0.45) return false
  } else if (srcCjk < 0.2 && outCjk < 0.2) {
    // EN→ZH: translation should become mostly Chinese.
    return false
  }
  return true
}

export function buildTranslateMessages({ text, direction = 'zh-en', previous = '' }) {
  const source = String(text || '').trim()
  const toEnglish = direction !== 'en-zh'
  const system = toEnglish
    ? [
        'You are a precise literary translator for bilingual reading.',
        'Task: translate the user\'s Chinese sentence into natural English.',
        'Output ONLY the English translation — no quotes, no preface, no explanation, no questions, no empathy reply.',
        'Never answer the speaker; never continue the story; never chat.',
        'Keep proper names and established terms.',
      ].join(' ')
    : [
        'You are a precise literary translator for bilingual reading.',
        'Task: translate the user\'s English sentence into Simplified Chinese.',
        'Output ONLY the Chinese translation — no quotes, no preface, no explanation, no questions, no empathy reply.',
        'Never answer the speaker; never continue the story; never chat.',
        'Keep proper names and established terms.',
      ].join(' ')

  const parts = []
  if (previous) {
    parts.push(`Previous sentence (context only, do not translate it):\n${previous}`)
  }
  parts.push(
    toEnglish
      ? `Translate this Chinese sentence into English:\n${source}`
      : `Translate this English sentence into Simplified Chinese:\n${source}`,
  )
  parts.push('Reminder: output only the translation text.')
  return { system, user: parts.join('\n\n'), source, toEnglish }
}

async function runOnce(llm, route, system, user, signal) {
  const parent = signal ?? AbortSignal.timeout(90_000)
  const call = await llm.prepareCall(
    { provider: route.provider, model: route.model, temperature: 0.1, maxTokens: 2048 },
    parent,
    (controls, info) => {
      const effort = info.reasoning?.efforts?.[0]?.id
      return effort ? { ...controls, reasoningEffort: effort } : controls
    },
  )
  parent.throwIfAborted()

  const blocks = new Map()
  let complete = false
  for await (const chunk of call.stream({
    ...call.config,
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
    signal: parent,
  })) {
    parent.throwIfAborted()
    if (chunk.type === 'block-end' && chunk.block?.type === 'text' && typeof chunk.block.text === 'string') {
      blocks.set(chunk.index, chunk.block.text)
    }
    if (chunk.type === 'finish') {
      if (chunk.reason?.kind !== 'stop') {
        throw new Error(chunk.reason?.failure?.message ?? `Translation incomplete (${chunk.reason?.kind ?? 'unknown'}).`)
      }
      complete = true
    }
  }
  if (!complete) throw new Error('Translation stream ended early.')
  return [...blocks].sort((a, b) => a[0] - b[0]).map(([, value]) => value).join('\n').trim()
}

/** One-shot sentence translation through the Harness model registry. */
export function createTranslator(getLlm, getRoute) {
  return async function translateSentence({ text, direction = 'zh-en', previous = '', signal }) {
    const source = String(text || '').trim()
    if (!source) throw new Error('Empty sentence.')
    if (source.length > 4000) throw new Error('Sentence too long to translate.')

    const route = await getRoute()
    if (!route?.provider || !route?.model) {
      throw new Error('No usable translation model. Pick one in 翻译模型 settings or configure a provider on the DSH Models page.')
    }
    const llm = getLlm()
    if (!llm?.prepareCall) {
      throw new Error('Harness LLM service is unavailable.')
    }

    const first = buildTranslateMessages({ text: source, direction, previous })
    let result = await runOnce(llm, route, first.system, first.user, signal)

    if (!looksLikeValidTranslation(source, result, direction)) {
      const retryUser = [
        first.user,
        '',
        'Your previous reply was NOT a translation. Do not chat. Do not ask questions.',
        direction !== 'en-zh'
          ? 'Write the English rendering of the Chinese sentence only.'
          : 'Write the Simplified Chinese rendering of the English sentence only.',
      ].join('\n')
      result = await runOnce(llm, route, first.system, retryUser, signal)
      if (!looksLikeValidTranslation(source, result, direction)) {
        throw new Error('Model returned a non-translation reply. Tap Retry.')
      }
    }

    if (!result) throw new Error('The model returned no translation.')
    return {
      translation: result,
      modelId: route.modelId || `${route.provider}/${route.model}`,
      provider: route.provider,
      model: route.model,
    }
  }
}

export async function currentModelLabel(getRoute) {
  const route = await getRoute()
  if (!route?.provider || !route?.model) return null
  return {
    provider: route.provider,
    model: route.model,
    modelId: route.modelId || `${route.provider}/${route.model}`,
  }
}
