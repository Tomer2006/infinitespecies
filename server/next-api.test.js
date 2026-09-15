import assert from 'node:assert/strict'
import test from 'node:test'
import { GET } from '../src/app/api/[...path]/route.ts'

test('Next API forwards paths, queries and upstream statuses without trailing slash changes', async () => {
  const original = globalThis.fetch
  const api = process.env.TAXONOMY_API_URL
  process.env.TAXONOMY_API_URL = 'http://taxonomy.test/api/'
  try {
    let requested
    globalThis.fetch = async (url, options) => {
      requested = url
      assert.equal(options.cache, 'no-store')
      assert.ok(options.signal instanceof AbortSignal)
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    const result = await GET(new Request('http://site.test/api/tree/path/?path=Life%2FHomo'), { params: Promise.resolve({ path: ['tree', 'path'] }) })
    assert.equal(requested, 'http://taxonomy.test/api/tree/path?path=Life%2FHomo')
    assert.equal(result.status, 404)
    assert.deepEqual(await result.json(), { error: 'Not found' })
    globalThis.fetch = async () => { throw new Error('offline') }
    const failed = await GET(new Request('http://site.test/api/tree/root'), { params: Promise.resolve({ path: ['tree', 'root'] }) })
    assert.equal(failed.status, 503, 'Client can fall back to static data')
  } finally {
    globalThis.fetch = original
    if (api === undefined) delete process.env.TAXONOMY_API_URL
    else process.env.TAXONOMY_API_URL = api
  }
})
