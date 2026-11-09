import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cookieFromLoginInfo,
  mergeCookieHeader,
  parseCookieHeader,
  serializeCookieMap,
} from '../packages/host/src/weread/cookie.js'
import { confirmUrlForUid } from '../packages/host/src/weread/login.js'

test('cookieFromLoginInfo builds wr_* cookies', () => {
  const cookie = cookieFromLoginInfo({ vid: 12345, skey: 'abc', pf: 2 })
  const map = parseCookieHeader(cookie)
  assert.equal(map.get('wr_vid'), '12345')
  assert.equal(map.get('wr_skey'), 'abc')
  assert.equal(map.get('wr_pf'), '2')
})

test('cookieFromLoginInfo accepts alternate field names', () => {
  const cookie = cookieFromLoginInfo({ webLoginVid: '9', accessToken: 'tok' })
  assert.match(cookie, /wr_vid=9/)
  assert.match(cookie, /wr_skey=tok/)
})

test('mergeCookieHeader updates wr_skey from Set-Cookie', () => {
  const next = mergeCookieHeader(
    'wr_vid=1; wr_skey=old; wr_pf=0',
    ['wr_skey=new; Path=/; HttpOnly', 'wr_name=Alice; Path=/'],
  )
  const map = parseCookieHeader(next)
  assert.equal(map.get('wr_skey'), 'new')
  assert.equal(map.get('wr_vid'), '1')
  assert.equal(map.get('wr_name'), 'Alice')
})

test('serializeCookieMap skips empty values', () => {
  const map = new Map([['wr_vid', '1'], ['wr_skey', ''], ['wr_pf', '0']])
  assert.equal(serializeCookieMap(map), 'wr_vid=1; wr_pf=0')
})

test('confirmUrlForUid points at weread confirm page', () => {
  assert.equal(
    confirmUrlForUid('uid-1'),
    'https://weread.qq.com/web/confirm?uid=uid-1',
  )
})

test('finishLoginFromInfo keeps enriched cookie from getUser and refresh', async () => {
  const { finishLoginFromInfo } = await import('../packages/host/src/weread/login.js')
  const cookie = await finishLoginFromInfo(
    { vid: 9, skey: 'tok', pf: 0 },
    {
      getUser: async (current) => ({ cookie: `${current}; wr_name=Ada`, changed: true }),
      refreshCookie: async (current) => ({ cookie: `${current}; wr_gid=1`, changed: true }),
    },
  )
  assert.match(cookie, /wr_vid=9/)
  assert.match(cookie, /wr_skey=tok/)
  assert.match(cookie, /wr_name=Ada/)
  assert.match(cookie, /wr_gid=1/)
})
