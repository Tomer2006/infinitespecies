import { providerSelect } from './dom.js';

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

export function openProviderSearch(forNode) {
  if (!forNode) return;
  const provider = providerSelect?.value || 'google';
  const url = providerUrl(provider, forNode.name);
  window.open(url, '_blank', 'noopener,noreferrer');
}


