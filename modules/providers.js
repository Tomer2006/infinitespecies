/* External provider search */
import { providerSelect } from './dom.js';

export function getSearchTarget() {
  // Placeholder: callers often pass hover/current separately
  return null;
}

export function openProviderSearch(node) {
  if (!node) return;
  const provider = providerSelect ? providerSelect.value : 'google';
  const q = encodeURIComponent(node.name || '');
  let url = `https://www.google.com/search?q=${q}`;
  if (provider === 'wikipedia') url = `https://en.wikipedia.org/wiki/Special:Search?search=${q}`;
  if (provider === 'gbif') url = `https://www.gbif.org/occurrence/search?taxon_name=${q}`;
  if (provider === 'ncbi') url = `https://www.ncbi.nlm.nih.gov/taxonomy/?term=${q}`;
  if (provider === 'col') url = `https://www.catalogueoflife.org/data/search?q=${q}`;
  if (provider === 'inat') url = `https://www.inaturalist.org/search?q=${q}`;
  window.open(url, '_blank', 'noopener');
}


