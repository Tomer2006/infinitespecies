import assert from 'node:assert/strict'
import { discoveryPages } from './discovery-pages.js'
import { startProductionServer } from './production-server.js'

const server = await startProductionServer()
try {
  const pages = ['/', ...discoveryPages.map(page => page.path)]
  const get = async route => {
    const response = await fetch(server.origin + route)
    assert.equal(response.status, 200, route)
    return response.text()
  }
  for (const route of pages) {
    const html = await get(route)
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${route}: server-rendered heading`)
    assert.ok(html.includes(`rel="canonical" href="https://infinitespecies.com${route}"`), `${route}: canonical`)
    assert.ok(html.includes('href="/tree-of-life/"'), `${route}: navigation`)
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1])
    const cssPaths = [...html.matchAll(/<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"[^>]*>/g)].map(match => match[1])
    assert.ok(cssPaths.length, `${route}: stylesheet present`)
    for (const cssPath of cssPaths) {
      const css = await get(cssPath)
      assert.ok(!css.includes('@apply'), 'Tailwind utilities are compiled')
      assert.ok(css.includes('.reading-page') && css.includes('.landing-page'), 'Shared styles shipped')
    }
  }
  const home = await get('/')
  assert.match(home, /Explore how life on Earth is connected/)
  assert.match(home, /href="\/explore\/humans\/"/)
  assert.ok(home.includes('/_next/'), 'Next runtime shipped')
  const robots = await get('/robots.txt')
  assert.ok(!robots.includes('Disallow: /_next/'))
  const sitemap = await get('/sitemap.xml')
  assert.equal((sitemap.match(/<loc>/g) || []).length, pages.length)
  for (const route of pages) assert.ok(sitemap.includes(`https://infinitespecies.com${route}</loc>`))
  const missing = await fetch(server.origin + '/this-page-does-not-exist/')
  assert.equal(missing.status, 404)
  assert.match(await missing.text(), /noindex/)
  const redirect = await fetch(server.origin + '/about', { redirect: 'manual' })
  assert.equal(redirect.status, 308)
  assert.equal(redirect.headers.get('location'), '/about/')
  const manifest = JSON.parse(await get('/data/manifest.json'))
  assert.ok(manifest.files.length > 0, 'Static data fallback available')
  const health = await fetch(server.origin + '/api/health')
  assert.ok([200, 503].includes(health.status), 'API requests reach the taxonomy handler')
  const healthBody = await health.json()
  if (health.status === 200) assert.equal(healthBody.ok, true)
  else assert.equal(healthBody.error, 'Taxonomy service unavailable')
  console.log(`Verified ${pages.length} Next.js pages, server-rendered content, compiled Tailwind, metadata, redirects, assets, data fallback and 404.`)
} finally { await server.close() }
