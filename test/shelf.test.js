import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeShelfData,
  shouldRetryEmptyShelf,
  userVidFromCookie,
  assertWereadUser,
} from '../packages/host/src/weread/client.js'

test('userVidFromCookie reads wr_vid', () => {
  assert.equal(userVidFromCookie('wr_vid=321; wr_skey=abc; wr_pf=0'), '321')
  assert.equal(userVidFromCookie(''), '')
})

test('assertWereadUser rejects missing userVid param errors', () => {
  assert.throws(
    () => assertWereadUser(200, { errCode: -2003, errMsg: '参数格式错误' }),
    /参数格式错误|-2003|Login|expired/i,
  )
})

test('assertWereadUser accepts a normal profile', () => {
  const user = assertWereadUser(200, { name: '奕', userVid: 321176239 })
  assert.equal(user.name, '奕')
  assert.equal(user.userVid, 321176239)
})

test('normalizeShelfData maps books and progress', () => {
  const shelf = normalizeShelfData({
    bookCount: 2,
    books: [
      { bookId: '1', title: 'A', author: 'x', cover: 'c', format: 'epub' },
      { bookId: '2', book: { title: 'B', author: 'y', cover: 'd', format: 'txt' } },
    ],
    bookProgress: [
      { bookId: '1', progress: 12, chapterUid: 9, chapterIdx: 1, updateTime: 100 },
      { bookId: '2', progress: 40, finished: 1, updateTime: 200 },
    ],
  })
  assert.equal(shelf.books.length, 2)
  // Sorted by latest progress updateTime first.
  assert.equal(shelf.books[0].title, 'B')
  assert.equal(shelf.books[0].progress, 40)
  assert.equal(shelf.books[1].title, 'A')
  assert.equal(shelf.books[1].progress, 12)
  assert.equal(shelf.bookCount, 2)
})

test('shouldRetryEmptyShelf when bookCount says there are books', () => {
  assert.equal(shouldRetryEmptyShelf({ books: [], bookCount: 12 }), true)
  assert.equal(shouldRetryEmptyShelf({ books: [], bookCount: 0 }), false)
  assert.equal(shouldRetryEmptyShelf({ books: [{ bookId: '1' }], bookCount: 1 }), false)
})

test('normalizeShelfData sorts recently updated books first', () => {
  const shelf = normalizeShelfData({
    books: [
      { bookId: 'old', title: 'Old', readUpdateTime: 10 },
      { bookId: 'new', title: 'New', readUpdateTime: 99 },
    ],
    bookProgress: [],
  })
  assert.equal(shelf.books[0].bookId, 'new')
  assert.equal(shelf.books[1].bookId, 'old')
})
