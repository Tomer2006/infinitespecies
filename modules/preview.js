import { bigPreview, bigPreviewCap, bigPreviewImg } from './dom.js';
import { state } from './state.js';

const thumbCache = new Map();
let lastThumbNodeId = null;
let previewReqToken = 0;

export const THUMB_SIZE = 96;

export async function fetchWikipediaThumb(title) {
  const key = title.toLowerCase();
  const existing = thumbCache.get(key);
  if (existing) return existing; // may be Promise or string/null
  const p = (async () => {
    try {
      const encoded = encodeURIComponent(title.replace(/\s+/g, '_'));
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.thumbnail?.source || data?.originalimage?.source || null;
    } catch (_e) {
      return null;
    }
  })();
  thumbCache.set(key, p);
  const src = await p;
  thumbCache.set(key, src);
  return src;
}

function isProbablyImageAllowed(src) {
  return /^https?:\/\//i.test(src);
}

export async function showBigFor(node) {
  lastThumbNodeId = node._id;
  const isSpecific = node.level === 'Species' || !node.children || node.children.length === 0;
  const query = node.name;
  const src = await fetchWikipediaThumb(query);
  if (!state.isPreviewPinned && lastThumbNodeId !== node._id) return;
  if (src && isProbablyImageAllowed(src)) {
    showBigPreview(src, query);
  } else {
    if (state.isPreviewPinned) {
      bigPreviewCap.textContent = node.name;
      bigPreviewImg.removeAttribute('src');
      bigPreview.style.display = 'block';
      bigPreview.style.opacity = '1';
      bigPreview.setAttribute('aria-hidden', 'false');
    } else {
      hideBigPreview();
    }
  }
}

export function showBigPreview(src, caption) {
  if (!bigPreview) return;
  const myToken = ++previewReqToken;
  bigPreviewCap.textContent = caption || '';
  bigPreviewImg.alt = caption || '';
  bigPreviewImg.setAttribute('loading', 'lazy');
  bigPreviewImg.removeAttribute('src');
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
    if (!state.isPreviewPinned) hideBigPreview();
  };
  loader.referrerPolicy = 'no-referrer';
  loader.src = src;
  if (state.isPreviewPinned && (state.hoverNode || state.current)) {
    const n = state.hoverNode || state.current;
    state.pinnedNodeId = n._id;
  }
}

export function hideBigPreview() {
  if (!bigPreview) return;
  previewReqToken++; // cancel in-flight load
  if (state.isPreviewPinned) return; // do not hide if pinned
  bigPreview.style.opacity = '0';
  setTimeout(() => {
    if (bigPreview.style.opacity === '0') bigPreview.style.display = 'none';
  }, 60);
  bigPreview.setAttribute('aria-hidden', 'true');
  bigPreviewImg.src = '';
  bigPreviewImg.alt = '';
  bigPreviewCap.textContent = '';
}


