// Weread web request signing (community protocol; see NOTICE).
import { createHash } from 'node:crypto'

function md5(raw) {
  return createHash('md5').update(raw).digest('hex')
}

export function currentTime() {
  return Math.floor(Date.now() / 1000)
}

function xorSign(data) {
  let n1 = 0x15051505
  let n2 = 0x15051505
  const strlen = data.length
  for (let i = strlen - 1; i > 0; i -= 2) {
    n1 = 0x7fffffff & (n1 ^ (data.charCodeAt(i) << ((strlen - i) % 30)))
    n2 = 0x7fffffff & (n2 ^ (data.charCodeAt(i - 1) << (i % 30)))
  }
  return (n1 + n2).toString(16).toLowerCase()
}

function stringify(data) {
  return Object.keys(data).sort()
    .map(key => `${key}=${encodeURIComponent(String(data[key]))}`)
    .join('&')
}

export function sign(payload) {
  return xorSign(stringify(payload))
}

export function calcHash(input) {
  const data = typeof input === 'number' ? String(input) : String(input)
  const dataMd5 = md5(data)
  let head = dataMd5.slice(0, 3)
  let kind
  let parts
  if (/^\d*$/.test(data)) {
    kind = '3'
    parts = []
    for (let i = 0; i < data.length; i += 9) {
      parts.push(parseInt(data.slice(i, Math.min(i + 9, data.length)), 10).toString(16))
    }
  } else {
    kind = '4'
    let hex = ''
    for (let i = 0; i < data.length; i++) hex += data.charCodeAt(i).toString(16)
    parts = [hex]
  }
  head += kind
  head += `2${dataMd5.slice(-2)}`
  for (let i = 0; i < parts.length; i++) {
    let lenHex = parts[i].length.toString(16)
    if (lenHex.length === 1) lenHex = `0${lenHex}`
    head += lenHex + parts[i]
    if (i < parts.length - 1) head += 'g'
  }
  if (head.length < 20) head += dataMd5.slice(0, 20 - head.length)
  return head + md5(head).slice(0, 3)
}
