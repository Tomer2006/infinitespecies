import assert from 'node:assert/strict'
import test from 'node:test'
import { MapGesture } from '../src/modules/map-gesture.js'

test('a click or tap tolerates small finger movement and selects once', () => {
  const gesture = new MapGesture()
  gesture.start(1, { x: 10, y: 10 })
  assert.equal(gesture.move(1, { x: 12, y: 13 }), null)
  assert.deepEqual(gesture.end(1, { x: 12, y: 13 }), { x: 12, y: 13 })
  assert.equal(gesture.end(1, { x: 12, y: 13 }), null)
})

test('left drag moves the map without accidentally selecting a circle', () => {
  const gesture = new MapGesture()
  gesture.start(1, { x: 0, y: 0 })
  gesture.move(1, { x: 2, y: 0 })
  assert.deepEqual(gesture.move(1, { x: 10, y: 0 }), { type: 'pan', dx: 10, dy: 0 })
  assert.deepEqual(gesture.move(1, { x: 16, y: 3 }), { type: 'pan', dx: 6, dy: 3 })
  assert.equal(gesture.end(1, { x: 16, y: 3 }), null)
})

test('pinch supports zoom and translation without a tap on finger release', () => {
  const gesture = new MapGesture()
  gesture.start(1, { x: 0, y: 0 })
  gesture.start(2, { x: 10, y: 0 })
  assert.deepEqual(gesture.move(2, { x: 20, y: 0 }), { type: 'zoom', scale: 2, from: { x: 5, y: 0 }, to: { x: 10, y: 0 } })
  assert.equal(gesture.end(2, { x: 20, y: 0 }), null)
  assert.deepEqual(gesture.move(1, { x: 3, y: 2 }), { type: 'pan', dx: 3, dy: 2 })
  assert.equal(gesture.end(1, { x: 3, y: 2 }), null)
})

test('cancelled gestures and middle clicks never select', () => {
  const gesture = new MapGesture()
  gesture.start(1, { x: 0, y: 0 }, false)
  assert.equal(gesture.end(1, { x: 0, y: 0 }), null)
  gesture.start(1, { x: 0, y: 0 })
  assert.equal(gesture.end(1, { x: 0, y: 0 }, true), null)
  gesture.start(1, { x: 0, y: 0 })
  gesture.cancel()
  assert.equal(gesture.end(1, { x: 0, y: 0 }), null)
})
