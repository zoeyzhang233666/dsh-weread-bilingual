// Weread chapter shard decrypt (community protocol; see NOTICE).
import { createHash } from 'node:crypto'

function md5(raw) {
  return createHash('md5').update(raw).digest('hex')
}

function base64Decode(input) {
  return Buffer.from(input, 'base64').toString('utf8')
}

function decryptInternal(data) {
  if (!data || typeof data !== 'string' || data.length <= 1) return ''
  let result = data.slice(1)
  const positions = (() => {
    const out = []
    const len = result.length
    if (len < 4) return out
    if (len < 11) return [0, 2]
    const take = Math.min(4, Math.ceil(len / 10))
    let bits = ''
    for (let i = len - 1; i > len - 1 - take; i--) {
      bits += parseInt(result.charCodeAt(i).toString(2), 4)
    }
    const mod = len - take - 2
    const width = String(mod).length
    for (let i = 0; out.length < 10 && i + width < bits.length; i += width) {
      let v = parseInt(bits.slice(i, i + width), 10)
      out.push(v % mod)
      v = parseInt(bits.slice(i + 1, i + 1 + width), 10)
      out.push(v % mod)
    }
    return out
  })()
  const chars = result.split('')
  for (let i = positions.length - 1; i >= 0; i -= 2) {
    for (let j = 1; j >= 0; j--) {
      const a = positions[i] + j
      const b = positions[i - 1] + j
      const tmp = chars[a]
      chars[a] = chars[b]
      chars[b] = tmp
    }
  }
  return base64Decode(chars.join(''))
}

export function chk(data) {
  if (!data || data.length <= 32) return data ?? ''
  const header = data.slice(0, 32)
  const body = data.slice(32)
  return header === md5(body).toUpperCase() ? body : ''
}

export function dH(data) {
  return data ? decryptInternal(data) : ''
}

export function dS(data) {
  return data ? decryptInternal(data) : ''
}

export function dT(data) {
  return data ? decryptInternal(data) : ''
}
