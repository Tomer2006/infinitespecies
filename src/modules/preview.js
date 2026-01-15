/**
 * Preview and thumbnail management module
 *
 * Handles loading and caching of preview images for taxonomy nodes.
 * Manages the large preview popup that appears when hovering over nodes,
 * including thumbnail generation, caching, and Wikipedia image fetching.
 */

import { state } from './state.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { perf } from './settings.js';
import { getNodePath } from './deeplink.js';

// Direct DOM access functions for React compatibility
const getBigPreview = () => document.getElementById('bigPreview');
const getBigPreviewImg = () => document.getElementById('bigPreviewImg');
const getBigPreviewCap = () => document.getElementById('bigPreviewCap');
const getBigPreviewEmpty = () => document.getElementById('bigPreviewEmpty');
const getBigPreviewPath = () => document.getElementById('bigPreviewPath');

const thumbCache = new Map();
const MAX_THUMBS = perf.preview.maxThumbnails;
let lastThumbNodeId = null;
let previewReqToken = 0;
let currentPreviewNode = null; // Store current node for breadcrumb updates

async function fetchWikipediaThumb(title) {
  const key = title.toLowerCase();
  const existing = thumbCache.get(key);
  if (existing && typeof existing === 'object' && existing !== null && !existing.then) {
    // Refresh insertion order to implement simple LRU behavior
    thumbCache.delete(key);
    thumbCache.set(key, existing);
    return existing; // may be Promise or object/null
  }
  const p = (async () => {
    try {
      // Get Wikipedia summary for thumbnail, description, and Wikidata ID
      // Use Action API instead of REST API to avoid 404 errors in console
      const encoded = encodeURIComponent(title);
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages|extracts|pageprops&titles=${encoded}&piprop=thumbnail&pithumbsize=500&exintro=1&explaintext=1&redirects=1`;

      const wikiRes = await fetch(wikiUrl);
      if (!wikiRes.ok) return null;
      const wikiData = await wikiRes.json();

      const pages = wikiData?.query?.pages;
      if (!pages) return null;

      const pageId = Object.keys(pages)[0];
      if (pageId === '-1' || !pages[pageId] || pages[pageId].missing) return null;

      const page = pages[pageId];

      // Get taxonomic rank from Wikidata using the Wikidata ID from Wikipedia
      const taxonomicRank = await getTaxonomicRankFromWikidata(page.pageprops?.wikibase_item);

      // Return both thumbnail and taxonomic rank info
      return {
        thumbnail: page.thumbnail?.source || null,
        taxonomicRank: taxonomicRank,
        description: page.extract || null
      };
    } catch (_e) {
      logError('Error fetching Wikipedia data', _e);
      return null;
    }
  })();
  thumbCache.set(key, p);
  // Evict oldest entries if we exceed the cap
  while (thumbCache.size > MAX_THUMBS) {
    const oldest = thumbCache.keys().next().value;
    if (oldest == null) break;
    thumbCache.delete(oldest);
  }
  const result = await p;
  // Store the result (object or null)
  thumbCache.set(key, result);
  // Evict after finalization as well
  while (thumbCache.size > MAX_THUMBS) {
    const oldest = thumbCache.keys().next().value;
    if (oldest == null) break;
    thumbCache.delete(oldest);
  }
  return result;
}

// Get taxonomic rank from Wikidata (structured data source)
async function getTaxonomicRankFromWikidata(wikidataId) {
  if (!wikidataId) return null;

  try {
    // Query Wikidata for taxonomic rank (P105 property)
    const sparqlQuery = `
      SELECT ?rank ?rankLabel WHERE {
        wd:${wikidataId} wdt:P105 ?rank .
        ?rank rdfs:label ?rankLabel .
        FILTER(LANG(?rankLabel) = "en")
      }
    `;

    const wikidataUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
    const wikidataRes = await fetch(wikidataUrl, {
      headers: { Accept: 'application/json' }
    });

    if (!wikidataRes.ok) return null;

    const wikidataData = await wikidataRes.json();
    const bindings = wikidataData?.results?.bindings;

    if (!bindings || bindings.length === 0) return null;

    // Extract the rank label
    const rankLabel = bindings[0]?.rankLabel?.value;
    if (!rankLabel) return null;

    logDebug('Found Wikidata rank', { rank: rankLabel });
    return rankLabel;

  } catch (error) {
    logWarn('Error fetching Wikidata rank', error);
    return null;
  }
}

function isProbablyImageAllowed(src) {
  return /^https?:\/\//i.test(src);
}

export async function showBigFor(node) {
  const bigPreview = getBigPreview();
  const bigPreviewImg = getBigPreviewImg();
  const bigPreviewCap = getBigPreviewCap();
  const bigPreviewEmpty = getBigPreviewEmpty();
  const bigPreviewPath = getBigPreviewPath();
  
  if (!bigPreview) return;
  
  // Store current node for breadcrumb updates
  currentPreviewNode = node;
  
  lastThumbNodeId = node._id;
  const isSpecific = node.level === 'Species' || !node.children || node.children.length === 0;
  const query = node.name;
  const result = await fetchWikipediaThumb(query);
  if (lastThumbNodeId !== node._id) return;

  // Build caption with taxonomic rank if available
  let caption = node.name;
  if (result && result.taxonomicRank) {
    caption += ` (${result.taxonomicRank})`;
  }

  // Get path for this node
  const path = node ? getNodePath(node).join(' > ') : '';

  if (result && result.thumbnail && isProbablyImageAllowed(result.thumbnail)) {
    // ensure placeholder hidden when we do have an image
    if (bigPreviewEmpty) {
      bigPreviewEmpty.style.display = 'none';
      bigPreviewEmpty.setAttribute('aria-hidden', 'true');
    }
    if (bigPreviewImg) bigPreviewImg.style.display = 'block';
    showBigPreview(result.thumbnail, caption, node, path);
  } else {
    // Show fallback box with centered text - update everything together
    if (bigPreviewCap) bigPreviewCap.textContent = caption;
    if (bigPreviewPath) bigPreviewPath.textContent = path;
    if (bigPreviewImg) {
      // Use transparent placeholder instead of removing src to prevent broken icon
      bigPreviewImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
      bigPreviewImg.style.display = 'none';
    }
    if (bigPreviewEmpty) {
      bigPreviewEmpty.style.display = 'flex';
      bigPreviewEmpty.setAttribute('aria-hidden', 'false');
    }
    bigPreview.style.display = 'block';
    bigPreview.style.opacity = '1';
    bigPreview.setAttribute('aria-hidden', 'false');
    
    // Breadcrumbs are no longer updated on hover - only on click
  }
}

function showBigPreview(src, caption, node, path) {
  const bigPreview = getBigPreview();
  const bigPreviewImg = getBigPreviewImg();
  const bigPreviewCap = getBigPreviewCap();
  const bigPreviewEmpty = getBigPreviewEmpty();
  const bigPreviewPath = getBigPreviewPath();
  
  if (!bigPreview) return;
  const myToken = ++previewReqToken;
  
  // Update position based on current breadcrumbs height
  const breadcrumbsEl = document.querySelector('.breadcrumbs');
  const topbarEl = document.querySelector('.topbar');
  if (breadcrumbsEl && topbarEl) {
    const breadcrumbsHeight = breadcrumbsEl.offsetHeight;
    const topbarHeight = topbarEl.offsetHeight;
    const topPosition = topbarHeight + breadcrumbsHeight + 16; // 16px = var(--space-md)
    bigPreview.style.top = `${topPosition}px`;
  }
  
  // Keep empty state hidden while loading - only show when confirmed no image exists
  if (bigPreviewEmpty) {
    bigPreviewEmpty.style.display = 'none';
    bigPreviewEmpty.setAttribute('aria-hidden', 'true');
  }
  
  // Keep the previous image visible while loading the new one
  // Use transparent placeholder to prevent broken image icon
  if (bigPreviewImg) {
    bigPreviewImg.alt = caption || '';
    const currentSrc = bigPreviewImg.src;
    // If no valid src, use transparent 1x1 pixel placeholder to prevent broken icon
    if (!currentSrc || currentSrc === '' || currentSrc === window.location.href) {
      // Use transparent data URI to prevent broken image icon
      bigPreviewImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
      bigPreviewImg.style.display = 'none'; // Hide until new image loads
    } else {
      // Keep old image visible while new one loads
      bigPreviewImg.style.display = 'block';
    }
  }
  
  bigPreview.style.display = 'block';
  bigPreview.style.opacity = '1'; // Keep preview visible with old image
  bigPreview.setAttribute('aria-hidden', 'false');
  
  const loader = new Image();
  loader.decoding = 'async';
  loader.onload = async () => {
    if (myToken !== previewReqToken) return;
    try {
      if (loader.decode) await loader.decode();
    } catch (_) {
      // ignore decode errors, fallback to immediate swap
    }
    if (myToken !== previewReqToken) return;
    const img = getBigPreviewImg();
    const cap = getBigPreviewCap();
    const pathEl = getBigPreviewPath();
    const preview = getBigPreview();
    if (img) {
      // Update everything together when image is ready
      img.src = src;
      img.style.display = 'block'; // Ensure image is visible
      if (cap) cap.textContent = caption || '';
      if (pathEl) pathEl.textContent = path || '';
      // Force reflow then ensure it's visible
      if (preview) {
        // eslint-disable-next-line no-unused-expressions
        preview.offsetHeight;
        preview.style.opacity = '1';
      }
    }
  };
  loader.onerror = () => {
    if (myToken !== previewReqToken) return;
    const img = getBigPreviewImg();
    const cap = getBigPreviewCap();
    const pathEl = getBigPreviewPath();
    const empty = getBigPreviewEmpty();
    const preview = getBigPreview();
    // Fall back to placeholder text - update everything together
    if (img) {
      // Use transparent placeholder instead of removing src to prevent broken icon
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
      img.style.display = 'none';
    }
    if (cap) cap.textContent = caption || '';
    if (pathEl) pathEl.textContent = path || '';
    if (empty) {
      empty.style.display = 'flex';
      empty.setAttribute('aria-hidden', 'false');
    }
    if (preview) {
      preview.style.display = 'block';
      preview.style.opacity = '1';
      preview.setAttribute('aria-hidden', 'false');
    }
  };
  loader.referrerPolicy = 'no-referrer';
  loader.src = src;
  // no pin behavior
}

export function hideBigPreview() {
  const bigPreview = getBigPreview();
  const bigPreviewImg = getBigPreviewImg();
  const bigPreviewCap = getBigPreviewCap();
  const bigPreviewPath = getBigPreviewPath();
  
  if (!bigPreview) return;
  previewReqToken++; // cancel in-flight load
  bigPreview.style.opacity = '0';
  setTimeout(() => {
    const preview = getBigPreview();
    if (preview && preview.style.opacity === '0') preview.style.display = 'none';
  }, 60);
  bigPreview.setAttribute('aria-hidden', 'true');
  if (bigPreviewImg) {
    // Use transparent placeholder instead of empty string to prevent broken icon
    bigPreviewImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
    bigPreviewImg.alt = '';
  }
  if (bigPreviewCap) bigPreviewCap.textContent = '';
  if (bigPreviewPath) bigPreviewPath.textContent = '';
}

