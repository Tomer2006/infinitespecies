import assert from 'node:assert/strict'
import { before, after, afterEach, test } from 'node:test'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { createModuleLoader } from './test-modules.js'

let server, tree, components, store, links, settings
const listeners = new Map()
const documentListeners = new Map()
const saved = new Map()
const noop = () => {}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
before(async () => {
  server = await createModuleLoader()
  components = {}
  for (const name of ['LandingPage', 'Breadcrumbs', 'BigPreview', 'SettingsModal', 'SettingsLabModal', 'HelpModal', 'Topbar', 'MapControls', 'LoadingOverlay']) {
    components[name] = (await server.load(`/src/components/${name}.tsx`)).default
  }
  store = await server.load('/src/modules/state.ts')
  links = await server.load('/src/modules/deeplink.ts')
  settings = await server.load('/src/modules/settings.ts')
  globalThis.HTMLElement = class {}
  globalThis.document = { activeElement: null, querySelector: () => null,
    addEventListener: (name, fn) => { if (!documentListeners.has(name)) documentListeners.set(name, new Set()); documentListeners.get(name).add(fn) },
    removeEventListener: (name, fn) => documentListeners.get(name)?.delete(fn) }
  globalThis.window = {
    addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn) },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
    matchMedia: () => ({ matches: true }), setTimeout, clearTimeout,
  }
  globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) }
  window.localStorage = globalThis.localStorage
  globalThis.requestAnimationFrame = () => 1
  globalThis.cancelAnimationFrame = noop
})
afterEach(async () => { await act(async () => { tree?.unmount() }); tree = null })
after(async () => { await server?.close() })
const mount = async (name, props) => { await act(async () => { tree = create(React.createElement(components[name], props), { createNodeMock: element => element.props.className === 'searchbar' ? { contains: () => false } : null }) }); return tree.root }
const click = async button => { await act(async () => { await button.props.onClick() }) }
const text = node => node.children.map(child => typeof child === 'string' ? child : text(child)).join('')
const button = label => tree.root.findAllByType('button').find(item => text(item).includes(label))
const node = (id, name, parent = null) => ({ _id: id, name, parent, children: [], _vx: 0, _vy: 0, _vr: 1, _leaves: 1 })

test('landing buttons dispatch start, destinations, help and settings', async () => {
  const calls = []
  await mount('LandingPage', { language: 'en', colorPreset: 'tableau10', isStarting: false,
    onStart: () => calls.push('start'), onDiscover: value => calls.push(value),
    onHelp: () => calls.push('help'), onSettings: () => calls.push('settings') })
  for (const item of tree.root.findAllByType('button')) await click(item)
  assert.deepEqual(calls, ['help', 'settings', 'start', 'Homo sapiens', 'Aves', 'random'])
})

test('breadcrumb buttons expand the path and navigate to the selected ancestor', async () => {
  const root = node(1, 'Life'), a = node(2, 'A', root), b = node(3, 'B', a), c = node(4, 'C', b)
  const calls = []
  await mount('Breadcrumbs', { language: 'en', crumbs: [root, a, b, c].map(node => ({ id: node._id, name: node.name, node })), onCrumbClick: n => calls.push(n._id) })
  await click(tree.root.findByProps({ className: 'crumb path-toggle' }))
  const path = tree.root.findByProps({ id: 'full-taxonomy-path' })
  for (const item of path.findAllByType('button')) await click(item)
  await click(tree.root.findByProps({ className: 'location-back' }))
  assert.deepEqual(calls, [1, 2, 3, 4, 3])
})

test('species card collapse, expand, pin, close and web search buttons respond', async () => {
  const calls = []
  await mount('BigPreview', { language: 'en', pinned: false, preview: { node: node(1, 'Homo sapiens'), path: 'Life/Homo sapiens' },
    onTogglePin: () => calls.push('pin'), onClose: () => calls.push('close'), onWebSearch: () => calls.push('web') })
  const toggle = () => tree.root.findByProps({ 'aria-controls': 'species-card-details' })
  await click(toggle())
  assert.equal(tree.root.findByProps({ id: 'species-card-details' }).props.hidden, true)
  await click(toggle())
  assert.equal(tree.root.findByProps({ id: 'species-card-details' }).props.hidden, false)
  await click(tree.root.findByProps({ 'aria-pressed': false }))
  await click(tree.root.findByProps({ className: 'species-web' }))
  await click(tree.root.findByProps({ className: 'species-card-header' }).findByType('button'))
  assert.deepEqual(calls, ['pin', 'web', 'close'])
})

test('settings selects update the saved palette; close responds', async () => {
  const calls = []
  await mount('SettingsModal', { isOpen: true, language: 'en', colorPreset: 'tableau10',
    onColorPresetChange: value => calls.push(value), onClose: () => calls.push('close') })
  await act(async () => { tree.root.findByProps({ id: 'color-select' }).props.onChange({ target: { value: 'blueGradient' } }) })
  assert.equal(tree.root.findAllByProps({ id: 'language-select' }).length, 0)
  await click(tree.root.findByProps({ className: 'modal-close' }))
  assert.equal(settings.perf.colors.currentPreset, 'blueGradient')
  assert.equal(saved.get('infinitespecies_colorPreset'), 'blueGradient')
  assert.deepEqual(calls, ['blueGradient', 'close'])
})

test('Settings Lab closes by button and Escape', async () => {
  let closed = 0
  let changed = 0
  await mount('SettingsLabModal', { isOpen: true, onPerfChange: () => changed++, onClose: () => closed++ })
  await click(button('Reset Defaults'))
  assert.equal(changed, 1)
  assert.equal(settings.perf.colors.currentPreset, 'tableau10')
  await click(tree.root.findByProps({ 'aria-label': 'Close Settings Lab' }))
  await act(async () => { for (const fn of listeners.get('keydown') || []) fn({ key: 'Escape' }) })
  assert.equal(closed, 2)
})

test('empty search button opens suggestions and topbar actions dispatch', async () => {
  const calls = []
  await mount('Topbar', { language: 'en', onBackToMenu: () => calls.push('home'), onCopyLink: () => calls.push('share'),
    onLanguage: () => calls.push('language'), onSettings: () => calls.push('settings'), onSettingsLab: noop, onHelp: () => calls.push('help') })
  await click(tree.root.findByProps({ className: 'searchbar-btn' }))
  assert.equal(tree.root.findByProps({ className: 'search-results search-starts' }).findAllByType('button').length, 3)
  await click(tree.root.findByProps({ className: 'topbar-brand' }))
  for (const item of tree.root.findAllByProps({ className: 'btn btn-icon' })) await click(item)
  await click(tree.root.findByProps({ className: 'btn btn-icon topbar-settings-btn' }))
  assert.deepEqual(calls, ['home', 'share', 'help', 'settings'])
})

test('map links always use the app route, even when the hash already matches', () => {
  const root = node(1, 'Life')
  globalThis.location = new URL('https://infinitespecies.com/explore/humans/?explore=random#Life')
  globalThis.history = { replaceState: (_a, _b, url) => { globalThis.location = new URL(url) } }
  links.updateDeepLinkFromNode(root)
  assert.equal(location.href, 'https://infinitespecies.com/#Life')
})

test('English is used even with an old Hebrew preference', async () => {
  const i18n = await server.load('/src/modules/i18n.ts')
  saved.set('infinitespecies_language', 'he')
  document.documentElement = { lang: 'he', dir: 'rtl' }
  document.body = { setAttribute: (key, value) => { document.body[key] = value } }
  i18n.initializeLanguage()
  assert.equal(i18n.getCurrentLanguage(), 'en')
  assert.equal(document.documentElement.lang, 'en')
  assert.equal(document.documentElement.dir, 'ltr')
  assert.equal(saved.has('infinitespecies_language'), false)
  i18n.setCurrentLanguage('he')
  assert.equal(i18n.getCurrentLanguage(), 'en')
  let closed = false
  await mount('HelpModal', { language: 'en', onClose: () => { closed = true } })
  await click(tree.root.findByProps({ className: 'modal-close' }))
  assert.equal(closed, true)
})

function fixture() {
  const root = node(1, 'Life'), human = node(2, 'Homo sapiens', root)
  root._vr = 10
  root.children = [human]
  store.setTaxonomyData(root, { root, diameter: 20 }, 'eager')
  store.rebuildNodeMap()
  store.setCurrentNode(root)
  return { root, human }
}

test('zoom, browse, child navigation, close, random and dismiss controls respond', async () => {
  const { human } = fixture()
  let random = 0
  store.state.camera = { x: 0, y: 0, k: 1 }
  await mount('MapControls', { language: 'en', hasPreview: false, onRandom: async () => random++ })
  const toolbarButtons = () => tree.root.findByProps({ className: 'map-controls' }).findAllByType('button')
  await click(toolbarButtons()[0])
  assert.equal(store.state.camera.k, 1.6)
  await click(toolbarButtons()[1])
  assert.equal(store.state.camera.k, 1)
  await click(tree.root.findByProps({ className: 'map-tip' }).findByType('button'))
  assert.equal(saved.get('infinitespecies_mapTipsSeen'), 'true')
  await click(toolbarButtons()[2])
  assert.equal(tree.root.findByProps({ className: 'group-list' }).findAllByType('button').length, 1)
  await click(tree.root.findByProps({ className: 'group-list' }).findByType('button'))
  assert.equal(store.state.current, human)
  await click(tree.root.findByProps({ id: 'group-browser' }).findByType('header').findByType('button'))
  assert.equal(toolbarButtons()[2].props['aria-expanded'], false)
  await click(toolbarButtons()[3])
  assert.equal(random, 1)
  assert.equal(toolbarButtons()[3].props.disabled, false)
})

test('search button submits local queries and result selection navigates', async () => {
  const { human } = fixture()
  await mount('Topbar', { language: 'en', onBackToMenu: noop, onCopyLink: noop, onSettings: noop, onSettingsLab: noop, onHelp: noop })
  await act(async () => { tree.root.findByType('input').props.onChange({ target: { value: 'Homo sapiens' } }) })
  await click(tree.root.findByProps({ className: 'searchbar-btn' }))
  const results = tree.root.findAllByProps({ role: 'option' })
  assert.equal(results.length, 1)
  await click(results[0])
  assert.equal(store.state.current, human)
  assert.equal(tree.root.findByType('input').props.value, '')
})

test('browse pagination appends the next page without losing previous groups', async () => {
  const { root } = fixture()
  root.children = Array.from({ length: 51 }, (_, i) => node(i + 2, `Group ${i}`, root))
  store.rebuildNodeMap()
  await mount('MapControls', { language: 'en', hasPreview: false, onRandom: async () => {} })
  await click(tree.root.findByProps({ className: 'map-browse-button' }))
  let list = tree.root.findByProps({ className: 'group-list' })
  assert.equal(list.findAllByType('button').length, 51)
  await click(list.findAllByType('button').at(-1))
  list = tree.root.findByProps({ className: 'group-list' })
  assert.equal(list.findAllByType('button').length, 51)
  assert.ok(text(list).includes('Group 50'))
  assert.ok(text(list).includes('Group 0'))
})

test('random action recovers from failures and can be clicked again', async () => {
  fixture()
  let attempts = 0
  await mount('MapControls', { language: 'en', hasPreview: false, onRandom: async () => { if (++attempts === 1) throw new Error('Temporary failure') } })
  const random = () => tree.root.findByProps({ className: 'map-controls' }).findAllByType('button')[3]
  await click(random())
  assert.equal(tree.root.findAllByProps({ role: 'alert' }).length, 1)
  assert.equal(random().props.disabled, false)
  await click(random())
  assert.equal(attempts, 2)
  assert.equal(tree.root.findAllByProps({ role: 'alert' }).length, 0)
})

test('a dismissed search stays closed when its pending request finishes', async () => {
  fixture()
  const originalFetch = globalThis.fetch
  let finish
  globalThis.fetch = async () => new Promise(resolve => { finish = resolve })
  try {
    await mount('Topbar', { language: 'en', onBackToMenu: noop, onCopyLink: noop, onSettings: noop, onSettingsLab: noop, onHelp: noop })
    await act(async () => { tree.root.findByType('input').props.onChange({ target: { value: 'unknown-pending-name' } }) })
    await click(tree.root.findByProps({ className: 'searchbar-btn' }))
    assert.equal(typeof finish, 'function')
    await act(async () => { for (const listener of documentListeners.get('click') || []) listener({ target: {} }) })
    await act(async () => { finish(new Response(JSON.stringify({ results: [] }))) })
    assert.equal(tree.root.findByType('input').props['aria-expanded'], false)
    assert.equal(tree.root.findAllByProps({ role: 'status' }).length, 0)
  } finally { globalThis.fetch = originalFetch }
})

test('starting another search clears stale result options and active descendant', async () => {
  fixture()
  await mount('Topbar', { language: 'en', onBackToMenu: noop, onCopyLink: noop, onSettings: noop, onSettingsLab: noop, onHelp: noop })
  await act(async () => { tree.root.findByType('input').props.onChange({ target: { value: 'Homo sapiens' } }) })
  await click(tree.root.findByProps({ className: 'searchbar-btn' }))
  assert.equal(tree.root.findAllByProps({ role: 'option' }).length, 1)
  // Inspect after synchronous state updates, before the cached promise resolves.
  act(() => { tree.root.findByProps({ className: 'searchbar-btn' }).props.onClick() })
  assert.equal(tree.root.findAllByProps({ role: 'option' }).length, 0)
  assert.equal(tree.root.findByType('input').props['aria-activedescendant'], undefined)
  await act(async () => {})
})


test('loading dialog bounds progress and prevents tabbing into background controls', async () => {
  for (const [progress, expected] of [[-10, 0], [150, 100], [NaN, 0], [42.6, 43]]) {
    await mount('LoadingOverlay', { language: 'en', title: 'Preparing map', stage: 'Stage 1', progress, pct: 'wrong', timer: '00:01' })
    assert.equal(tree.root.findByProps({ role: 'progressbar' }).props['aria-valuenow'], expected)
    assert.equal(tree.root.findByProps({ className: 'progress-fill' }).props.style.width, `${expected}%`)
    let prevented = false
    tree.root.findByProps({ role: 'dialog' }).props.onKeyDown({ key: 'Tab', preventDefault: () => { prevented = true } })
    assert.equal(prevented, true)
    await act(async () => tree.unmount())
    tree = null
  }
})
