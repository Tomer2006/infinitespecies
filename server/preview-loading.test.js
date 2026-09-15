import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPreview, initialPreview, prefetchPreview } from '../src/modules/preview.ts'

const node = name => ({ _id: 1, name, parent: null, children: [] })
const wikiResponse = (name, wikidataId) => Response.json({ query: { pages: { '1': {
  title: name, extract: 'A description ready to read.',
  thumbnail: { source: 'https://upload.wikimedia.org/example.jpg' },
  fullurl: 'https://en.wikipedia.org/wiki/Example', pageprops: { wikibase_item: wikidataId },
} } } })

test('description and image appear before slow rank enrichment, then cache opens instantly', { timeout: 2000 }, async () => {
  const original = globalThis.fetch
  const organism = node('Preview timing fixture')
  let finishRank, rankCalls = 0
  let enriched
  const update = new Promise(resolve => { enriched = resolve })
  globalThis.fetch = async url => {
    if (url.includes('query.wikidata.org')) {
      rankCalls++
      return new Promise(resolve => { finishRank = resolve })
    }
    return wikiResponse(organism.name, 'Q123')
  }
  try {
    const first = await loadPreview(organism, enriched)
    assert.equal(first.loading, false)
    assert.equal(first.description, 'A description ready to read.')
    assert.ok(first.thumbnail)
    assert.equal(first.rank, null)
    assert.equal(initialPreview(organism).loading, false)
    await loadPreview(organism)
    assert.equal(rankCalls, 1, 'Repeated selections share enrichment')
    finishRank(Response.json({ results: { bindings: [{ rankLabel: { value: 'species' } }] } }))
    assert.equal((await update).rank, 'species')
    assert.equal(initialPreview(organism).rank, 'species')
  } finally { globalThis.fetch = original }
})

test('hover prefetch and selection share the same Wikipedia request', async () => {
  const original = globalThis.fetch
  const organism = node('Hover loading fixture')
  let calls = 0, finish
  globalThis.fetch = () => { calls++; return new Promise(resolve => { finish = resolve }) }
  try {
    prefetchPreview(organism)
    const selected = loadPreview(organism)
    assert.equal(calls, 1)
    finish(wikiResponse(organism.name))
    assert.ok((await selected).description)
    assert.equal(initialPreview(organism).loading, false)
  } finally { globalThis.fetch = original }
})

test('a failed prefetch can be retried when the organism is selected again', async () => {
  const original = globalThis.fetch
  const organism = node('Retry loading fixture')
  try {
    globalThis.fetch = async () => new Response('{}', { status: 503 })
    assert.equal((await loadPreview(organism)).description, null)
    globalThis.fetch = async () => wikiResponse(organism.name)
    assert.ok((await loadPreview(organism)).description)
  } finally { globalThis.fetch = original }
})
