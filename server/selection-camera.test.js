import assert from 'node:assert/strict'
import test from 'node:test'
import { getSelectionCamera } from '../src/modules/selection-camera.ts'

test('zoom keeps the containing circle at the same screen position', () => {
  const before = { x: 20, y: -30, k: 2 }
  const container = { x: 100, y: 50 }
  for (const zoom of [0.5, 2, 8]) {
    const after = getSelectionCamera(before, container, zoom)
    assert.equal((container.x - after.x) * after.k, (container.x - before.x) * before.k)
    assert.equal((container.y - after.y) * after.k, (container.y - before.y) * before.k)
    assert.equal(after.k, zoom)
  }
})

test('a centered containing circle stays centered with no pan', () => {
  assert.deepEqual(getSelectionCamera({ x: 100, y: 50, k: 2 }, { x: 100, y: 50 }, 8), { x: 100, y: 50, k: 8 })
})

test('zooming in then out around the same container restores the camera', () => {
  const before = { x: 20, y: -30, k: 2 }
  const container = { x: 100, y: 50 }
  assert.deepEqual(getSelectionCamera(getSelectionCamera(before, container, 8), container, 2), before)
})
