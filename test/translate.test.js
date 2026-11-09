import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildTranslateMessages,
  looksLikeValidTranslation,
} from '../packages/host/src/translate.js'

test('first sentence always gets an explicit translate instruction', () => {
  const { user, system } = buildTranslateMessages({
    text: '我真倒霉，真的。',
    direction: 'zh-en',
  })
  assert.match(user, /Translate this Chinese sentence into English/)
  assert.match(user, /我真倒霉，真的。/)
  assert.match(system, /Output ONLY the English translation/)
  assert.doesNotMatch(user, /^我真倒霉/)
})

test('previous sentence is context-only', () => {
  const { user } = buildTranslateMessages({
    text: '下一句。',
    previous: '上一句。',
    direction: 'zh-en',
  })
  assert.match(user, /Previous sentence \(context only/)
  assert.match(user, /上一句。/)
  assert.match(user, /Translate this Chinese sentence/)
})

test('rejects chatty Chinese reply for ZH→EN', () => {
  assert.equal(
    looksLikeValidTranslation(
      '我真倒霉，真的。',
      '听起来你现在挺不好受的。想说说发生什么了吗？',
      'zh-en',
    ),
    false,
  )
})

test('accepts English translation for ZH→EN', () => {
  assert.equal(
    looksLikeValidTranslation('我真倒霉，真的。', "I'm really unlucky, seriously.", 'zh-en'),
    true,
  )
})
