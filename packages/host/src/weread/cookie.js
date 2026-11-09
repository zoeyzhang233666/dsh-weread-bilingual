export function parseCookieHeader(header) {
  const map = new Map()
  for (const part of String(header || '').split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const name = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!name) continue
    map.set(name, value)
  }
  return map
}

export function serializeCookieMap(map) {
  return [...map.entries()]
    .filter(([name, value]) => name && value != null && value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

/** Parse one or more Set-Cookie header values into name→value. */
export function parseSetCookieHeaders(headers) {
  const list = Array.isArray(headers) ? headers : headers ? [headers] : []
  const map = new Map()
  for (const raw of list) {
    const first = String(raw || '').split(';')[0] || ''
    const eq = first.indexOf('=')
    if (eq <= 0) continue
    const name = first.slice(0, eq).trim()
    const value = first.slice(eq + 1).trim()
    if (name) map.set(name, value)
  }
  return map
}

export function mergeCookieHeader(existing, setCookieHeaders) {
  const map = parseCookieHeader(existing)
  for (const [name, value] of parseSetCookieHeaders(setCookieHeaders)) {
    map.set(name, value)
  }
  return serializeCookieMap(map)
}

export function cookieFromLoginInfo(info = {}) {
  const vid = info.vid ?? info.webLoginVid ?? info.userVid
  const skey = info.skey ?? info.accessToken ?? info.wr_skey
  const pf = info.pf ?? info.wr_pf ?? 0
  if (vid == null || vid === '' || skey == null || skey === '') {
    throw new Error('Login response is missing vid or skey.')
  }
  const map = new Map([
    ['wr_vid', String(vid)],
    ['wr_skey', String(skey)],
    ['wr_pf', String(pf)],
  ])
  if (info.refreshToken || info.wr_rt) {
    map.set('wr_rt', String(info.refreshToken || info.wr_rt))
  }
  return serializeCookieMap(map)
}

export const COOKIE_REFRESH_MS = 45 * 60 * 1000
