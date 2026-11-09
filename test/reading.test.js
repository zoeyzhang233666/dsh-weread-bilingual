import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createReadingClock } from '../packages/host/src/reading.js'

test('accrues focused seconds and pauses on blur', () => {
  let now = 1_000_000
  const clock = createReadingClock(() => now)
  clock.focus()
  now += 5_500
  assert.equal(clock.takeSeconds(), 5)
  now += 2_000
  clock.blur()
  now += 10_000
  assert.equal(clock.takeSeconds(), 2)
  clock.focus()
  now += 1_200
  assert.equal(clock.takeSeconds(), 1)
})
