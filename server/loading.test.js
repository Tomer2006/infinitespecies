import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createModuleLoader } from './test-modules.js'

let server, loading, loadEager
before(async () => {
  server = await createModuleLoader()
  loading = await server.load('/src/modules/loading.ts')
  ;({ loadEager } = await server.load('/src/modules/data-eager.ts'))
})
after(async () => { await server?.close() })

test('loading progress spans file download and tree preparation without resetting', () => {
  const values = []
  const unsubscribe = loading.subscribeProgress(update => values.push(update.percentage))
  for (const [fraction, stage] of [[0, 1], [0.5, 1], [1, 1], [0, 2], [0.5, 2], [1, 2]]) {
    loading.setProgress(fraction, 'Loading', stage, 2)
  }
  unsubscribe()
  loading.setProgress(0)
  assert.deepEqual(values, [0, 25, 50, 50, 75, 100])
})

test('invalid progress and stage values cannot produce invalid percentages', () => {
  const updates = []
  const unsubscribe = loading.subscribeProgress(update => updates.push(update))
  loading.setProgress(NaN, '', NaN, Infinity)
  loading.setProgress(-1, '', -2, 0)
  loading.setProgress(2, '', 5, 2)
  unsubscribe()
  assert.deepEqual(updates.map(update => update.percentage), [0, 0, 100])
  assert.ok(updates.every(update => update.currentStage >= 1 && update.currentStage <= update.totalStages))
})

test('empty or malformed manifests fail promptly and manifest requests have a timeout signal', async () => {
  const originalFetch = globalThis.fetch
  try {
    for (const manifest of [null, {}, { version: 1, files: [], layout_size: 4000, total_nodes: 1 },
      { version: 1, files: [{}], layout_size: 4000, total_nodes: 1 }]) {
      globalThis.fetch = async (_url, options) => {
        assert.ok(options.signal instanceof AbortSignal)
        return { ok: true, json: async () => manifest }
      }
      await assert.rejects(loadEager('/data/manifest.json'), /Invalid baked manifest/)
    }
  } finally { globalThis.fetch = originalFetch }
})
