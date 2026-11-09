export const DISPLAY_MODES = ['hover', 'bilingual', 'source', 'translation']
export const TRANSLATION_THEMES = ['plain', 'dashed', 'highlight', 'blockquote', 'weakening', 'mask']

export function normalizeDisplayMode(value, fallback = 'hover') {
  const mode = String(value || '').trim()
  return DISPLAY_MODES.includes(mode) ? mode : fallback
}

export function normalizeTranslationTheme(value, fallback = 'plain') {
  const theme = String(value || '').trim()
  return TRANSLATION_THEMES.includes(theme) ? theme : fallback
}

export function nextDisplayMode(current) {
  const mode = normalizeDisplayMode(current)
  const index = DISPLAY_MODES.indexOf(mode)
  return DISPLAY_MODES[(index + 1) % DISPLAY_MODES.length]
}

export function nextTranslationTheme(current) {
  const theme = normalizeTranslationTheme(current)
  const index = TRANSLATION_THEMES.indexOf(theme)
  return TRANSLATION_THEMES[(index + 1) % TRANSLATION_THEMES.length]
}

export function modeAllowsAutoQueue(displayMode) {
  const mode = normalizeDisplayMode(displayMode)
  return mode === 'bilingual' || mode === 'translation'
}
