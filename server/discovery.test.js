import assert from 'node:assert/strict'
import test from 'node:test'
import { findCommonTaxa, nameDistance, getCommonName } from '../src/modules/taxon-names.js'
import { TaxonomySearchIndex } from './search-index.js'
import { discoveryPages } from '../build/discovery-pages.js'

test('everyday names, Hebrew, synonyms and typos resolve to scientific identities', () => {
  for (const [query, expected] of [['lion', 'Panthera leo'], ['people', 'Homo sapiens'], ['אריה', 'Panthera leo'], ['oak', 'Quercus'], ['huamn', 'Homo sapiens']]) {
    assert.equal(findCommonTaxa(query)[0]?.scientific, expected, query)
  }
  assert.equal(getCommonName('HOMO SAPIENS', 'he'), 'אדם')
  assert.deepEqual(findCommonTaxa('unrelated-xyz'), [])
})

test('scientific typo fallback finds nearby names without replacing exact results', () => {
  const index = new TaxonomySearchIndex()
  index.add(1, 'Homo sapiens')
  index.add(2, 'Homo sapiens sapiens')
  index.add(3, 'Panthera leo')
  index.finalize()
  assert.equal(index.search('homo sapines')[0]?.id, 1)
  assert.equal(index.search('panthera le')[0]?.id, 3)
  assert.equal(index.search('homo sapiens')[0]?.id, 1)
  assert.deepEqual(index.search('unrelated-xyz'), [])
  assert.equal(nameDistance('huamn', 'human'), 1)
})

test('editorial pages have unique real URLs, useful content and source links', () => {
  assert.equal(new Set(discoveryPages.map(page => page.path)).size, discoveryPages.length)
  for (const page of discoveryPages) {
    assert.match(page.path, /^\/[a-z/-]+\/$/)
    assert.ok(page.sections.length >= 4)
    assert.ok(page.sections.every(([heading, text]) => heading && text.length > 100))
    assert.ok(page.sources.every(([, url]) => new URL(url).protocol === 'https:'))
    assert.ok(page.target)
  }
})
