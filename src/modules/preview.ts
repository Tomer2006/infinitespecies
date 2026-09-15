/** Data-only preview service. React owns rendering and image lifecycle. */
import { getNodePath } from './deeplink'
import { logError, logWarn } from './logger'
import { perf } from './settings'
import type { TaxonomyNode } from './types'
import { getCommonName } from './taxon-names.js'

export interface PreviewData {
  node: TaxonomyNode
  caption: string
  path: string
  thumbnail: string | null
  description: string | null
  commonName: string | null
  rank: string | null
  sourceUrl: string | null
  loading?: boolean
}

interface WikipediaPreview {
  thumbnail: string | null
  taxonomicRank: string | null
  description: string | null
  title: string | null
  sourceUrl: string | null
  wikidataId?: string
  rankRequest?: Promise<string | null>
}

interface WikipediaPage {
  title?: string
  fullurl?: string
  missing?: unknown
  thumbnail?: { source?: string }
  extract?: string
  pageprops?: { wikibase_item?: string; disambiguation?: string }
}

interface WikipediaResponse {
  query?: { pages?: Record<string, WikipediaPage> }
}

interface WikidataResponse {
  results?: { bindings?: Array<{ rankLabel?: { value?: string } }> }
}

const thumbnailCache = new Map<string, Promise<WikipediaPreview | null> | WikipediaPreview | null>()

function remember(key: string, value: Promise<WikipediaPreview | null> | WikipediaPreview | null) {
  thumbnailCache.delete(key)
  thumbnailCache.set(key, value)
  while (thumbnailCache.size > perf.preview.maxThumbnails) {
    const oldest = thumbnailCache.keys().next().value as string | undefined
    if (oldest === undefined) break
    thumbnailCache.delete(oldest)
  }
}

async function getTaxonomicRank(wikidataId?: string): Promise<string | null> {
  if (!wikidataId || !/^Q\d+$/.test(wikidataId)) return null
  try {
    const query = `SELECT ?rank ?rankLabel WHERE { wd:${wikidataId} wdt:P105 ?rank . ?rank rdfs:label ?rankLabel . FILTER(LANG(?rankLabel) = "en") }`
    const response = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(2000) },
    )
    if (!response.ok) return null
    const data = await response.json() as WikidataResponse
    return data.results?.bindings?.[0]?.rankLabel?.value ?? null
  } catch (error) {
    logWarn('Error fetching Wikidata rank', error)
    return null
  }
}

async function fetchWikipediaPreview(title: string): Promise<WikipediaPreview | null> {
  const key = title.toLocaleLowerCase()
  const cached = thumbnailCache.get(key)
  if (cached !== undefined) {
    remember(key, cached)
    return cached
  }

  const pending = (async (): Promise<WikipediaPreview | null> => {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages|extracts|pageprops|info&inprop=url&titles=${encodeURIComponent(title)}&piprop=thumbnail&pithumbsize=500&exintro=1&explaintext=1&exsentences=3&redirects=1`
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) return null
      const data = await response.json() as WikipediaResponse
      const pages = data.query?.pages
      if (!pages) return null
      const [pageId] = Object.keys(pages)
      const page = pageId ? pages[pageId] : undefined
      if (!page || pageId === '-1' || page.missing !== undefined || page.pageprops?.disambiguation !== undefined) return null
      return {
        thumbnail: page.thumbnail?.source ?? null,
        taxonomicRank: null,
        wikidataId: page.pageprops?.wikibase_item,
        description: page.extract ?? null,
        title: page.title ?? null,
        sourceUrl: page.fullurl?.startsWith('https://en.wikipedia.org/') ? page.fullurl : null,
      }
    } catch (error) {
      logError('Error fetching Wikipedia data', error)
      return null
    }
  })()

  remember(key, pending)
  const result = await pending
  if (result) remember(key, result)
  else if (thumbnailCache.get(key) === pending) thumbnailCache.delete(key)
  return result
}

function presentPreview(node: TaxonomyNode, result: WikipediaPreview | null): PreviewData {
  const rank = result?.taxonomicRank
  return {
    node,
    caption: rank ? `${node.name} (${rank})` : node.name,
    path: getNodePath(node).join(' > '),
    thumbnail: result?.thumbnail && /^https?:\/\//i.test(result.thumbnail) ? result.thumbnail : null,
    description: result?.description ?? null,
    commonName: getCommonName(node.name) || (result?.title !== node.name ? result?.title ?? null : null),
    rank: rank ?? null,
    sourceUrl: result?.sourceUrl ?? null,
    loading: false,
  }
}

export async function loadPreview(node: TaxonomyNode, onUpdate?: (preview: PreviewData) => void): Promise<PreviewData> {
  const result = await fetchWikipediaPreview(node.name)
  if (result?.wikidataId && result.taxonomicRank === null) {
    result.rankRequest ??= getTaxonomicRank(result.wikidataId).then(rank => {
      result.taxonomicRank = rank
      return rank
    })
    // Optional rank enrichment never holds up the image or description.
    void result.rankRequest.then(rank => { if (rank) onUpdate?.(presentPreview(node, result)) })
  }
  return presentPreview(node, result)
}

export function prefetchPreview(node: TaxonomyNode) {
  void fetchWikipediaPreview(node.name)
}

export function initialPreview(node: TaxonomyNode): PreviewData {
  const cached = thumbnailCache.get(node.name.toLocaleLowerCase())
  if (cached !== undefined && !(cached instanceof Promise)) return presentPreview(node, cached)
  return { node, caption: node.name, path: getNodePath(node).join(' > '), thumbnail: null,
    description: null, commonName: getCommonName(node.name), rank: null, sourceUrl: null, loading: true }
}
