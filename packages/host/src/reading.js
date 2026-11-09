/** Accumulate focused reading seconds for Weread `/web/book/read`. */
export function createReadingClock(now = () => Date.now()) {
  let focused = false
  let startedAt = null
  let accruedMs = 0

  return {
    focus() {
      if (focused) return
      focused = true
      startedAt = now()
    },
    blur() {
      if (!focused) return
      accruedMs += Math.max(0, now() - startedAt)
      focused = false
      startedAt = null
    },
    takeSeconds() {
      if (focused && startedAt !== null) {
        accruedMs += Math.max(0, now() - startedAt)
        startedAt = now()
      }
      const seconds = Math.floor(accruedMs / 1000)
      accruedMs -= seconds * 1000
      return seconds
    },
    peekSeconds() {
      let total = accruedMs
      if (focused && startedAt !== null) total += Math.max(0, now() - startedAt)
      return Math.floor(total / 1000)
    },
    get focused() {
      return focused
    },
  }
}
