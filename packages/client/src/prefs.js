export const DISPLAY_MODES = ['hover', 'bilingual', 'source', 'translation']
export const TRANSLATION_THEMES = ['plain', 'dashed', 'highlight', 'blockquote', 'weakening', 'mask']

const LOCAL_MODE_KEY = 'wrb.displayMode'
const LOCAL_THEME_KEY = 'wrb.translationTheme'

export function readLocalDisplayMode() {
  try {
    return normalizeDisplayMode(localStorage.getItem(LOCAL_MODE_KEY), 'hover')
  } catch {
    return 'hover'
  }
}

export function readLocalTranslationTheme() {
  try {
    return normalizeTranslationTheme(localStorage.getItem(LOCAL_THEME_KEY), 'plain')
  } catch {
    return 'plain'
  }
}

export function writeLocalDisplayMode(mode) {
  try { localStorage.setItem(LOCAL_MODE_KEY, normalizeDisplayMode(mode)) } catch { /* ignore */ }
}

export function writeLocalTranslationTheme(theme) {
  try { localStorage.setItem(LOCAL_THEME_KEY, normalizeTranslationTheme(theme)) } catch { /* ignore */ }
}

const MODE_LABEL = {
  hover: 'Hover',
  bilingual: 'Bilingual',
  source: 'Source',
  translation: 'Translation',
}

const THEME_LABEL = {
  plain: 'Plain',
  dashed: 'Dashed',
  highlight: 'Highlight',
  blockquote: 'Quote',
  weakening: 'Weak',
  mask: 'Mask',
}

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
  return DISPLAY_MODES[(DISPLAY_MODES.indexOf(mode) + 1) % DISPLAY_MODES.length]
}

export function nextTranslationTheme(current) {
  const theme = normalizeTranslationTheme(current)
  return TRANSLATION_THEMES[(TRANSLATION_THEMES.indexOf(theme) + 1) % TRANSLATION_THEMES.length]
}

export function modeAllowsAutoQueue(displayMode) {
  const mode = normalizeDisplayMode(displayMode)
  return mode === 'bilingual' || mode === 'translation'
}

export function modeLabel(displayMode) {
  return MODE_LABEL[normalizeDisplayMode(displayMode)] || 'Hover'
}

export function themeLabel(theme) {
  return THEME_LABEL[normalizeTranslationTheme(theme)] || 'Plain'
}
