import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createModuleLoader } from './test-modules.js'

let server, getTooltipPosition
before(async () => {
  server = await createModuleLoader()
  const layout = await server.load('/src/modules/ui-layout.ts')
  getTooltipPosition = layout.getTooltipPosition
})
after(async () => { await server?.close() })

test('hover labels stay inside every map edge on desktop and small screens', () => {
  for (const [viewportWidth, viewportHeight] of [[1440, 800], [320, 240], [600, 120]]) {
    const width = Math.min(280, viewportWidth - 16)
    const height = Math.min(70, viewportHeight - 16)
    for (const x of [0, viewportWidth / 2, viewportWidth]) {
      for (const y of [0, viewportHeight / 2, viewportHeight]) {
        const position = getTooltipPosition(x, y, width, height, viewportWidth, viewportHeight)
        assert.ok(position.left >= 8)
        assert.ok(position.top >= 8)
        assert.ok(position.left + width <= viewportWidth - 8)
        assert.ok(position.top + height <= viewportHeight - 8)
      }
    }
  }
})

test('hover labels flip below the pointer when there is no room above', () => {
  assert.deepEqual(getTooltipPosition(160, 12, 200, 60, 320, 240), { left: 60, top: 24 })
  assert.deepEqual(getTooltipPosition(160, 160, 200, 60, 320, 240), { left: 60, top: 88 })
})
