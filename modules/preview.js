import { bigPreview, bigPreviewCap, bigPreviewImg, bigPreviewEmpty } from './dom.js';
import { state } from './state.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';

const thumbCache = new Map();
const MAX_THUMBS = 300; // cap to prevent runaway memory
let lastThumbNodeId = null;
let previewReqToken = 0;

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
      const encoded = encodeURIComponent(title.replace(/\s+/g, '_'));
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
      const wikiRes = await fetch(wikiUrl, { headers: { Accept: 'application/json' } });
      if (!wikiRes.ok) return null;
      const wikiData = await wikiRes.json();

      // Get taxonomic rank from Wikidata using the Wikidata ID from Wikipedia
      const taxonomicRank = await getTaxonomicRankFromWikidata(wikiData?.wikibase_item);

      // Return both thumbnail and taxonomic rank info
      return {
        thumbnail: wikiData?.thumbnail?.source || wikiData?.originalimage?.source || null,
        taxonomicRank: taxonomicRank,
        description: wikiData?.extract || null
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

  if (result && result.thumbnail && isProbablyImageAllowed(result.thumbnail)) {
    // ensure placeholder hidden when we do have an image
    if (bigPreviewEmpty) {
      bigPreviewEmpty.style.display = 'none';
      bigPreviewEmpty.setAttribute('aria-hidden', 'true');
    }
    if (bigPreviewImg) bigPreviewImg.style.display = 'block';
    showBigPreview(result.thumbnail, caption);
  } else {
    // Show fallback box with centered text even when not pinned
    bigPreviewCap.textContent = caption;
    if (bigPreviewImg) {
      bigPreviewImg.removeAttribute('src');
      bigPreviewImg.style.display = 'none';
    }
    if (bigPreviewEmpty) {
      bigPreviewEmpty.style.display = 'flex';
      bigPreviewEmpty.setAttribute('aria-hidden', 'false');
    }
    bigPreview.style.display = 'block';
    bigPreview.style.opacity = '1';
    bigPreview.setAttribute('aria-hidden', 'false');
  }
}

function showBigPreview(src, caption) {
  if (!bigPreview) return;
  const myToken = ++previewReqToken;
  bigPreviewCap.textContent = caption || '';
  bigPreviewImg.alt = caption || '';
  bigPreviewImg.removeAttribute('src');
  if (bigPreviewEmpty) {
    bigPreviewEmpty.style.display = 'none';
    bigPreviewEmpty.setAttribute('aria-hidden', 'true');
  }
  bigPreviewImg.style.display = 'block';
  bigPreview.style.display = 'block';
  bigPreview.style.opacity = '0';
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
    bigPreviewImg.src = src;
    // Force reflow then fade in
    // eslint-disable-next-line no-unused-expressions
    bigPreview.offsetHeight;
    bigPreview.style.opacity = '1';
  };
  loader.onerror = () => {
    if (myToken !== previewReqToken) return;
    // Fall back to placeholder text instead of hiding
    bigPreviewImg.removeAttribute('src');
    bigPreviewImg.style.display = 'none';
    if (bigPreviewEmpty) {
      bigPreviewEmpty.style.display = 'flex';
      bigPreviewEmpty.setAttribute('aria-hidden', 'false');
    }
    bigPreviewCap.textContent = caption || '';
    bigPreview.style.display = 'block';
    bigPreview.style.opacity = '1';
    bigPreview.setAttribute('aria-hidden', 'false');
  };
  loader.referrerPolicy = 'no-referrer';
  loader.src = src;
  // no pin behavior
}

export function hideBigPreview() {
  if (!bigPreview) return;
  previewReqToken++; // cancel in-flight load
  bigPreview.style.opacity = '0';
  setTimeout(() => {
    if (bigPreview.style.opacity === '0') bigPreview.style.display = 'none';
  }, 60);
  bigPreview.setAttribute('aria-hidden', 'true');
  bigPreviewImg.src = '';
  bigPreviewImg.alt = '';
  bigPreviewCap.textContent = '';
}

