/**
 * Framework-independent typed search orchestration.
 * 
 * Handles all search logic including scientific name lookup and result processing.
 * React components should only call these functions and update UI state.
 */

import { findAllByQuery } from './search';
import { goToNode } from './navigation';
import { perf } from './settings';
import { ensureBackendViewport, loadBackendNodeById, prefetchBackendNodeById, searchBackendNodes } from './data-backend';
import { state } from './state';
import { requestNodePulse } from './visual-events'
import type { TaxonomyNode } from './types'
import { findCommonTaxa, normalizeName } from './taxon-names.js'
import { updateDeepLinkFromNode } from './deeplink'

const MAX_QUERY_LENGTH = 100;
const MAX_CACHE_ENTRIES = 100;
export interface SearchResponse {
  matches: TaxonomyNode[]
  hasResults: boolean
  singleResult: boolean
  usedGbif?: boolean
}
interface SearchOptions { signal?: AbortSignal }
const searchCache = new Map<string, SearchResponse>();
let cacheRoot: TaxonomyNode | null = null;
let cacheBackend = '';

/**
 * Perform search
 * @param {string} query - The search query
 * @returns {Promise<{matches: Array, hasResults: boolean, singleResult: boolean}>}
 */
export async function performSearch(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  options.signal?.throwIfAborted();
  if (cacheRoot !== state.DATA_ROOT || cacheBackend !== state.backendApiBase) {
    searchCache.clear();
    cacheRoot = state.DATA_ROOT;
    cacheBackend = state.backendApiBase;
  }
  const trimmedQuery = String(query || '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH);
  if (trimmedQuery.length < 2) {
    return { matches: [], hasResults: false, singleResult: false };
  }

  const cacheKey = `${state.loadMode}:${perf.search.maxResults}:${trimmedQuery.toLowerCase()}`;
  const requestRoot = state.DATA_ROOT;
  const requestBackend = state.backendApiBase;
  const cached = searchCache.get(cacheKey)
  if (cached) {
    searchCache.delete(cacheKey);
    searchCache.set(cacheKey, cached);
    return cached;
  }

  const lookup = (name: string) => state.loadMode === 'backend'
    ? searchBackendNodes(name, perf.search.maxResults, options.signal)
    : Promise.resolve(findAllByQuery(name, perf.search.maxResults));
  const aliases = findCommonTaxa(trimmedQuery);
  const [native, ...resolved] = await Promise.all([
    lookup(trimmedQuery), ...aliases.map(taxon => lookup(taxon.scientific)),
  ]);
  // Alias resolution must match the scientific name exactly: a search for lion
  // must not quietly select another species that merely contains "leo".
  const aliasNodes = resolved.flatMap((nodes, i) => nodes.filter(node =>
    normalizeName(node.name) === normalizeName(aliases[i].scientific)));
  const exactNative = native.filter(node => normalizeName(node.name) === normalizeName(trimmedQuery));
  let matches = [...new Map([...exactNative, ...aliasNodes, ...native].map(node => [node._id, node])).values()]
    .slice(0, perf.search.maxResults);
  let usedGbif = false;
  // Broader common-name coverage is an optional fallback. The local taxonomy
  // remains authoritative: show only scientific names present in our tree.
  if (!matches.length && trimmedQuery.length >= 3) {
    try {
      const signal = options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(4500)])
        : AbortSignal.timeout(4500);
      const response = await fetch(`https://api.gbif.org/v1/species/search?q=${encodeURIComponent(trimmedQuery)}&limit=5`, { signal });
      if (response.ok) {
        const data = await response.json() as { results?: Array<{ canonicalName?: string }> };
        const names = [...new Set((data.results ?? []).map(item => item.canonicalName).filter((name): name is string => !!name))].slice(0, 3);
        const groups = await Promise.all(names.map(name => lookup(name)));
        matches = [...new Map(groups.flatMap((nodes, i) => nodes.filter(node =>
          normalizeName(node.name) === normalizeName(names[i]))).map(node => [node._id, node])).values()].slice(0, perf.search.maxResults);
        usedGbif = matches.length > 0;
      }
    } catch (error) {
      if (options.signal?.aborted) throw error;
      // An unavailable enrichment service must not break taxonomy search.
    }
  }
  options.signal?.throwIfAborted();

  const result = {
    matches,
    hasResults: matches.length > 0,
    singleResult: matches.length === 1,
    usedGbif,
  };

  if (matches.length && requestRoot === state.DATA_ROOT && requestBackend === state.backendApiBase) searchCache.set(cacheKey, result);
  if (searchCache.size > MAX_CACHE_ENTRIES) {
    const oldest = searchCache.keys().next().value as string | undefined
    if (oldest) searchCache.delete(oldest)
  }
  return result;
}

export function supportsLiveSearch() {
  return state.loadMode === 'backend';
}

export function prefetchSearchResult(node: TaxonomyNode): Promise<TaxonomyNode | null> {
  if (state.loadMode !== 'backend' || !node?._id) return Promise.resolve(node);
  return prefetchBackendNodeById(node._id);
}

/**
 * Handle search result click - zoom to node without changing navigation
 * @param {Object} node - The node to zoom to
 */
export async function handleSearchResultClick(node: TaxonomyNode): Promise<void> {
  const readyNode = state.loadMode === 'backend'
    ? await loadBackendNodeById(node._id)
    : node;
  if (!readyNode) throw new Error(`Unable to load taxonomy node ${node._id}`)
  await goToNode(readyNode, true);
  updateDeepLinkFromNode(readyNode);
  requestNodePulse(readyNode);
  if (state.loadMode === 'backend') {
    await ensureBackendViewport({ force: true });
  }
}
