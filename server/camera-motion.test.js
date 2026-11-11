import assert from 'node:assert/strict'
import { before, beforeEach, test } from 'node:test'
import { createModuleLoader } from './test-modules.js'

let store, camera, settings
let frames = []

before(async () => {
  const server = await createModuleLoader()
  store = await server.load('/src/modules/state.ts')
  camera = await server.load('/src/modules/camera.ts')
  settings = await server.load('/src/modules/settings.ts')
  // Stubbed after loading: modules start browser-only timers when they see `window`.
  globalThis.window = { matchMedia: () => ({ matches: false }) }
  // Camera motions are stepped by hand; the canvas render loop is not under test.
  globalThis.requestAnimationFrame = callback => { if (callback.name !== 'loop') frames.push(callback); return 1 }
})

beforeEach(() => {
  camera.stopCameraAnimation()
  frames = []
})

const nextFrame = time => frames.shift()(time)
const wheel = deltaY => camera.handleWheelZoom(
  { clientX: 300, clientY: 200, deltaY, preventDefault() {} },
  { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
)

test('a fly-to keeps its destination on screen for the whole flight', () => {
  const target = { x: 247.76, y: -0.09, k: 1880 }
  store.state.camera = { x: 0, y: 0, k: 0.1 }
  const startOffset = Math.hypot(target.x, target.y) * 0.1
  const started = performance.now()
  camera.animateToCam(target.x, target.y, target.k, 700)

  let previousZoom = 0.1
  let previousOffset = startOffset + 0.001
  for (let elapsed = 35; elapsed < 700; elapsed += 35) {
    nextFrame(started + elapsed)
    const { x, y, k } = store.state.camera
    const offset = Math.hypot(target.x - x, target.y - y) * k
    assert.ok(offset <= previousOffset, `destination drifted away at ${elapsed}ms: ${offset}px`)
    assert.ok(k >= previousZoom && k <= target.k, `zoom overshot at ${elapsed}ms: ${k}`)
    previousOffset = offset
    previousZoom = k
  }
  nextFrame(started + 10_000)
  assert.deepEqual(store.state.camera, target)
  assert.equal(store.state.animating, false)
  assert.equal(frames.length, 0)
})

test('flying back out keeps the place it left on screen', () => {
  const origin = { x: 247.76, y: -0.09 }
  store.state.camera = { ...origin, k: 1880 }
  const endOffset = Math.hypot(origin.x, origin.y) * 0.1
  const started = performance.now()
  camera.animateToCam(0, 0, 0.1, 700)

  for (let elapsed = 35; elapsed < 700; elapsed += 35) {
    nextFrame(started + elapsed)
    const { x, y, k } = store.state.camera
    const offset = Math.hypot(origin.x - x, origin.y - y) * k
    assert.ok(offset <= endOffset + 0.001, `origin left the screen at ${elapsed}ms: ${offset}px`)
  }
  nextFrame(started + 10_000)
  assert.deepEqual(store.state.camera, { x: 0, y: 0, k: 0.1 })
})

test('taking over the camera ends a wheel zoom that is still easing', () => {
  store.state.camera = { x: 0, y: 0, k: 1 }
  wheel(-600)
  nextFrame(performance.now())
  assert.ok(store.state.camera.k > 1)
  assert.equal(frames.length, 1)

  // A drag, pinch or circle selection takes the camera over.
  camera.stopCameraAnimation()
  store.state.camera = { x: 50, y: -20, k: 3 }
  nextFrame(performance.now())
  assert.deepEqual(store.state.camera, { x: 50, y: -20, k: 3 })
  assert.equal(frames.length, 0)

  // The cancelled ease must not run alongside the next wheel burst.
  wheel(-600)
  wheel(-600)
  assert.equal(frames.length, 1)
})

test('a fly-to replaces a wheel zoom instead of fighting it', () => {
  store.state.camera = { x: 0, y: 0, k: 1 }
  wheel(-600)
  const started = performance.now()
  camera.animateToCam(10, 10, 2, 700)
  while (frames.length) nextFrame(started + 10_000)
  assert.deepEqual(store.state.camera, { x: 10, y: 10, k: 2 })
})

test('a wheel zoom finishes when the zoom limit moves past its target', () => {
  const limits = settings.perf.navigation
  const previousLimit = limits.maxCameraZoom
  store.state.camera = { x: 0, y: 0, k: 100 }
  try {
    wheel(-1200)
    limits.maxCameraZoom = 150
    let count = 0
    while (frames.length && count++ < 500) nextFrame(performance.now())
    assert.equal(frames.length, 0, 'the ease never stopped requesting frames')
    assert.equal(store.state.camera.k, 150)
  } finally { limits.maxCameraZoom = previousLimit }
})
