import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import ReadingPage, { generateMetadata, generateStaticParams } from '../src/app/[...slug]/page.tsx'
import { discoveryPages } from '../build/discovery-pages.js'

test('Next routes render every guide, exploration link and canonical metadata', async () => {
  assert.equal(generateStaticParams().length, discoveryPages.length)
  for (const page of discoveryPages) {
    const props = { params: Promise.resolve({ slug: page.path.split('/').filter(Boolean) }) }
    const html = renderToStaticMarkup(await ReadingPage(props))
    assert.ok(html.includes('reading-page'), page.path)
    assert.ok(html.includes(`href="/?explore=${encodeURIComponent(page.target)}"`), page.path)
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1)
    assert.equal((await generateMetadata(props)).alternates.canonical, page.path)
  }
})
