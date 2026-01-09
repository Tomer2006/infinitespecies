/**
 * External data provider integration module
 *
 * Provides URLs and integration with external biological data sources
 * including Wikipedia, GBIF, Google, NCBI, and iNaturalist.
 * Handles provider selection UI and generates appropriate search URLs.
 */

import { perf } from './settings.js';

export function providerUrl(provider, name) {
  const q = encodeURIComponent(name);
  switch (provider) {
    case 'google':
      return `https://www.google.com/search?q=${q}`;
    case 'wikipedia':
      return `https://en.wikipedia.org/wiki/Special:Search?search=${q}`;
    case 'gbif':
      return `https://www.gbif.org/species/search?q=${q}`;
    case 'ncbi':
      return `https://www.ncbi.nlm.nih.gov/taxonomy/?term=${q}`;
    case 'col':
      return `https://www.catalogueoflife.org/data/search?q=${q}`;
    case 'inat':
      return `https://www.inaturalist.org/search?q=${q}`;
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}

export function getSearchTargetName(forNode) {
  return forNode?.name || '';
}

export function getCurrentProvider() {
  // First check localStorage, then fall back to settings
  const saved = localStorage.getItem('infinitespecies_searchProvider');
  if (saved && perf.search.providers[saved]) {
    return saved;
  }
  return perf.search.currentProvider || 'google';
}

export function openProviderSearch(forNode) {
  if (!forNode) return;
  const provider = getCurrentProvider();
  const url = providerUrl(provider, forNode.name);
  window.open(url, '_blank', 'noopener,noreferrer');
}
