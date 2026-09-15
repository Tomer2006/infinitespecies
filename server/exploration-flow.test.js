import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createModuleLoader } from './test-modules.js'

let server, store, search, links, previews, events
const originalFetch = globalThis.fetch
before(async () => {
  server = await createModuleLoader()
  store = await server.load('/src/modules/state.ts')
  search = await server.load('/src/modules/search-handler.ts')
  links = await server.load('/src/modules/deeplink.ts')
  previews = await server.load('/src/modules/preview.ts')
  events = await server.load('/src/modules/visual-events.ts')
})
after(async () => { globalThis.fetch = originalFetch; await server?.close() })

function fixture() {
  const make = (id, name, parent = null) => ({ _id: id, name, parent, children: [], level: parent ? 1 : 0, _vx: 0, _vy: 0, _vr: parent ? 1 : 10, _leaves: 1 })
  const root = make(1, 'Life')
  const human = make(2, 'Homo sapiens', root)
  const lion = make(3, 'Panthera leo', root)
  root.children = [human, lion]
  store.setTaxonomyData(root, { root, diameter: 20 }, 'eager')
  store.rebuildNodeMap()
  return { root, human, lion }
}

test('common-name results point at existing taxonomy nodes, including a misspelling', async () => {
  fixture()
  globalThis.fetch = async () => { throw new Error('No network expected') }
  assert.equal((await search.performSearch('lion')).matches[0].name, 'Panthera leo')
  assert.equal((await search.performSearch('huamn')).matches[0].name, 'Homo sapiens')
})

test('search cache uses the current tree, including when node IDs are reused', async () => {
  const first = fixture()
  assert.equal((await search.performSearch('Homo sapiens')).matches[0], first.human)
  const second = fixture()
  assert.equal((await search.performSearch('Homo sapiens')).matches[0], second.human)
})

test('an aborted request cannot return a cached success', async () => {
  fixture()
  await search.performSearch('Homo sapiens')
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(search.performSearch('Homo sapiens', { signal: controller.signal }), { name: 'AbortError' })
})

test('exact matches beyond the first candidate batch remain first', async () => {
  const { root, human } = fixture()
  // The stack visits the last child first, so the exact match is visited last.
  root.children = [human, ...Array.from({ length: 100 }, (_, i) => ({ ...human, _id: i + 10, name: `Homo sapiens variant ${i}` }))]
  const native = await server.load('/src/modules/search.ts')
  assert.equal(native.findAllByQuery('Homo sapiens', 2)[0], human)
  assert.deepEqual(native.findAllByQuery('Homo sapiens', 0), [])
})

test('GBIF fallback only includes names that actually exist in the loaded tree', async () => {
  fixture()
  globalThis.fetch = async () => new Response(JSON.stringify({ results: [{ canonicalName: 'Missing species' }, { canonicalName: 'Panthera leo' }] }))
  const result = await search.performSearch('simba')
  assert.equal(result.usedGbif, true)
  assert.deepEqual(result.matches.map(node => node.name), ['Panthera leo'])
  globalThis.fetch = async () => { throw new Error('Service unavailable') }
  assert.deepEqual((await search.performSearch('unknown-organism')).matches, [])
})

test('strict links reject a missing branch instead of silently returning its ancestor', async () => {
  const { human } = fixture()
  assert.equal(await links.findNodeByPath('Life/Homo sapiens'), human)
  assert.equal(await links.findNodeByPath('Life/missing'), null)
})

test('selecting a result updates the current node, share destination and preview event', async () => {
  const { human } = fixture()
  globalThis.window = { matchMedia: () => ({ matches: true }) }
  globalThis.requestAnimationFrame = () => 1
  globalThis.location = new URL('https://infinitespecies.com/?explore=random')
  globalThis.history = { replaceState: (_state, _title, value) => { globalThis.location = new URL(value, globalThis.location) } }
  let selected
  const unsubscribe = events.subscribeToPulse(node => { selected = node })
  await search.handleSearchResultClick(human)
  unsubscribe()
  assert.equal(store.state.current, human)
  assert.equal(selected, human)
  assert.equal(globalThis.location.search, '')
  assert.equal(decodeURIComponent(globalThis.location.hash), '#Life/Homo sapiens')
})

test('instant navigation cancels a previous camera transition', async () => {
  const { human } = fixture()
  human._vx = 42
  human._vy = 17
  store.state.nodeLayoutMap.set(human._id, human)
  const camera = await server.load('/src/modules/camera.ts')
  const navigation = await server.load('/src/modules/navigation.ts')
  let staleFrame
  const previousFrame = globalThis.requestAnimationFrame
  globalThis.window = { matchMedia: () => ({ matches: false }) }
  globalThis.requestAnimationFrame = callback => { staleFrame = callback; return 1 }
  try {
    camera.animateToCam(500, 500, 10)
    const step = staleFrame
    await navigation.goToNode(human, false)
    const settled = { ...store.state.camera }
    assert.equal(store.state.animating, false)
    assert.equal(settled.x, 42)
    assert.equal(settled.y, 17)
    assert.deepEqual(store.state.targetCam, settled)
    step(performance.now() + 10_000)
    assert.deepEqual(store.state.camera, settled)
  } finally { globalThis.requestAnimationFrame = previousFrame }
})

test('circle selection changes zoom while preserving camera X and Y', async () => {
  const { human } = fixture()
  human._vx = 42
  human._vy = 17
  store.state.nodeLayoutMap.set(human._id, human)
  store.state.camera = { x: -12, y: 35, k: 3 }
  const navigation = await server.load('/src/modules/navigation.ts')
  const previousFrame = globalThis.requestAnimationFrame
  globalThis.requestAnimationFrame = () => 1
  try {
    await navigation.goToNode(human, false, { preservePosition: true })
    assert.equal(store.state.current, human)
    assert.equal(store.state.camera.x, -12)
    assert.equal(store.state.camera.y, 35)
    assert.notEqual(store.state.camera.k, 3)
    assert.deepEqual(store.state.targetCam, store.state.camera)
    assert.equal(store.state.animating, false)
  } finally { globalThis.requestAnimationFrame = previousFrame }
})

test('cards retain descriptions and source URLs; missing enrichment keeps the organism usable', async () => {
  const { human, lion } = fixture()
  globalThis.fetch = async () => new Response(JSON.stringify({ query: { pages: { '1': { title: 'Human', fullurl: 'https://en.wikipedia.org/wiki/Human', extract: 'A test description.', thumbnail: { source: 'https://upload.wikimedia.org/example.jpg' } } } } }))
  const card = await previews.loadPreview(human)
  assert.equal(card.description, 'A test description.')
  assert.equal(card.sourceUrl, 'https://en.wikipedia.org/wiki/Human')
  assert.equal(card.commonName, 'Human')
  globalThis.fetch = async () => new Response('{}', { status: 503 })
  const unavailable = await previews.loadPreview(lion)
  assert.equal(unavailable.node, lion)
  assert.equal(unavailable.description, null)
  assert.equal(unavailable.sourceUrl, null)
})
