import { createElement as h } from 'react'
import { ReaderPanel, ReaderTitle } from './panel.js'

export const name = 'weread-bilingual-client'
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

const TAB_ID = 'weread-bilingual'
const TAB_KIND = 'weread-bilingual'
const NS = 'weread.bilingual'

const zh = {
  title: '微信读书双语',
  guideDescription: '在右侧栏打开微信读书书架，中英对照逐句翻译，并上报阅读时长。',
  open: '微信读书',
}

const en = {
  title: 'Weread Bilingual',
  guideDescription: 'Open your WeChat Reading shelf in the right sidebar with sentence-by-sentence bilingual translation and reading-time sync.',
  open: 'Weread',
}

function BookIcon(props = {}) {
  const size = props.size || 36
  return h(
    'svg',
    { width: size, height: size, viewBox: '0 0 36 36', fill: 'none', 'aria-hidden': true },
    h('rect', { x: 8, y: 7, width: 20, height: 22, rx: 2, stroke: 'currentColor', strokeWidth: 2 }),
    h('path', { d: 'M13 14h10M13 19h10M13 24h6', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  )
}

function TabBody(props) {
  return h(ReaderPanel, props)
}

function TabTitle() {
  return h(ReaderTitle)
}

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }))
  const t = ctx.locale.bind(NS)

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_KIND,
    title: () => t('title'),
    guide: [{
      id: 'weread-bilingual',
      order: 35,
      title: () => t('title'),
      description: () => t('guideDescription'),
      icon: BookIcon,
    }],
  }))

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: TAB_ID,
    locale: NS,
  }, TabBody)))

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: TAB_ID,
    locale: NS,
  }, TabTitle)))
}
