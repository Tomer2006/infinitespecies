import { bigPreview, bigPreviewCap, bigPreviewImg, bigPreviewEmpty } from './dom.js';
import { state } from './state.js';

const thumbCache = new Map();
let lastThumbNodeId = null;
let previewReqToken = 0;

// Performance optimization variables
let previewDebounceTimer = null;
let lastPreviewState = {
  nodeId: null,
  content: '',
  imageSrc: '',
  visible: false,
  loading: false
};

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
  if (!node) {
    if (lastPreviewState.visible) {
      hideBigPreview();
    }
    return;
  }

  // Clear any pending debounce timer
  if (previewDebounceTimer) {
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = null;
  }

  // Check if this is the same node and content hasn't changed
  const newContent = node.name;
  const nodeChanged = node._id !== lastPreviewState.nodeId;
  const contentChanged = newContent !== lastPreviewState.content;

  if (!nodeChanged && !contentChanged && lastPreviewState.visible) {
    return; // Nothing to update
  }

  // Debounce the preview update to avoid excessive DOM manipulation
  previewDebounceTimer = setTimeout(async () => {
    const myNodeId = node._id;
    lastThumbNodeId = myNodeId;
    lastPreviewState.nodeId = myNodeId;
    lastPreviewState.content = newContent;
    lastPreviewState.loading = true;

    const isSpecific = node.level === 'Species' || !node.children || node.children.length === 0;
    const query = node.name;
    const src = await fetchWikipediaThumb(query);

    // Check if we're still showing the same node
    if (lastThumbNodeId !== myNodeId) return;

    if (src && isProbablyImageAllowed(src)) {
      // Batch DOM updates for image display
      const updates = [];
      if (bigPreviewEmpty) {
        updates.push(() => {
          bigPreviewEmpty.style.display = 'none';
          bigPreviewEmpty.setAttribute('aria-hidden', 'true');
        });
      }
      if (bigPreviewImg) {
        updates.push(() => bigPreviewImg.style.display = 'block');
      }
      updates.push(() => showBigPreview(src, query));

      // Apply all updates in batch
      updates.forEach(update => update());

      lastPreviewState.imageSrc = src;
      lastPreviewState.visible = true;
      lastPreviewState.loading = false;
    } else {
      // Show fallback with batched updates
      const updates = [];
      updates.push(() => bigPreviewCap.textContent = node.name);

      if (bigPreviewImg) {
        updates.push(() => {
          bigPreviewImg.removeAttribute('src');
          bigPreviewImg.style.display = 'none';
        });
      }

      if (bigPreviewEmpty) {
        updates.push(() => {
          bigPreviewEmpty.style.display = 'flex';
          bigPreviewEmpty.setAttribute('aria-hidden', 'false');
        });
      }

      updates.push(() => {
        bigPreview.style.display = 'block';
        bigPreview.style.opacity = '1';
        bigPreview.setAttribute('aria-hidden', 'false');
      });

      // Apply all updates in batch
      updates.forEach(update => update());

      lastPreviewState.imageSrc = '';
      lastPreviewState.visible = true;
      lastPreviewState.loading = false;
    }
  }, 16); // ~60fps debounce
}

export function showBigPreview(src, caption) {
  if (!bigPreview) return;
  const myToken = ++previewReqToken;

  // Batch initial DOM updates
  const initialUpdates = [];

  if (bigPreviewCap) initialUpdates.push(() => bigPreviewCap.textContent = caption || '');
  if (bigPreviewImg) {
    initialUpdates.push(() => {
      bigPreviewImg.alt = caption || '';
      bigPreviewImg.setAttribute('loading', 'lazy');
      bigPreviewImg.removeAttribute('src');
      bigPreviewImg.style.display = 'block';
    });
  }

  if (bigPreviewEmpty) {
    initialUpdates.push(() => {
      bigPreviewEmpty.style.display = 'none';
      bigPreviewEmpty.setAttribute('aria-hidden', 'true');
    });
  }

  initialUpdates.push(() => {
    bigPreview.style.display = 'block';
    bigPreview.style.opacity = '0';
    bigPreview.setAttribute('aria-hidden', 'false');
  });

  // Apply initial updates in batch
  initialUpdates.forEach(update => update());

  // Optimized image loading with better error handling
  const loader = new Image();
  loader.decoding = 'async';
  loader.referrerPolicy = 'no-referrer';

  loader.onload = async () => {
    if (myToken !== previewReqToken) return;

    try {
      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(async () => {
        if (myToken !== previewReqToken) return;

        try {
          if (loader.decode) await loader.decode();
        } catch (_) {
          // ignore decode errors, fallback to immediate swap
        }

        if (myToken !== previewReqToken) return;

        // Batch the final DOM updates
        const finalUpdates = [];
        if (bigPreviewImg) finalUpdates.push(() => bigPreviewImg.src = src);

        finalUpdates.push(() => {
          // Force reflow then fade in using transform for better performance
          bigPreview.offsetHeight; // Force reflow
          bigPreview.style.opacity = '1';
        });

        finalUpdates.forEach(update => update());
      });
    } catch (_) {
      // Handle any unexpected errors gracefully
    }
  };

  loader.onerror = () => {
    if (myToken !== previewReqToken) return;

    // Optimized fallback with batched updates
    requestAnimationFrame(() => {
      if (myToken !== previewReqToken) return;

      const fallbackUpdates = [];
      if (bigPreviewImg) {
        fallbackUpdates.push(() => {
          bigPreviewImg.removeAttribute('src');
          bigPreviewImg.style.display = 'none';
        });
      }

      if (bigPreviewEmpty) {
        fallbackUpdates.push(() => {
          bigPreviewEmpty.style.display = 'flex';
          bigPreviewEmpty.setAttribute('aria-hidden', 'false');
        });
      }

      if (bigPreviewCap) fallbackUpdates.push(() => bigPreviewCap.textContent = caption || '');

      fallbackUpdates.push(() => {
        bigPreview.style.display = 'block';
        bigPreview.style.opacity = '1';
        bigPreview.setAttribute('aria-hidden', 'false');
      });

      fallbackUpdates.forEach(update => update());
    });
  };

  loader.src = src;
}

export function hideBigPreview() {
  if (!bigPreview) return;

  // Clear any pending debounce timer
  if (previewDebounceTimer) {
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = null;
  }

  // Update state
  lastPreviewState.nodeId = null;
  lastPreviewState.content = '';
  lastPreviewState.imageSrc = '';
  lastPreviewState.visible = false;
  lastPreviewState.loading = false;

  previewReqToken++; // cancel in-flight load

  // Batch DOM cleanup updates
  const cleanupUpdates = [];
  cleanupUpdates.push(() => bigPreview.style.opacity = '0');
  cleanupUpdates.push(() => bigPreview.setAttribute('aria-hidden', 'true'));

  if (bigPreviewImg) {
    cleanupUpdates.push(() => {
      bigPreviewImg.src = '';
      bigPreviewImg.alt = '';
    });
  }

  if (bigPreviewCap) {
    cleanupUpdates.push(() => bigPreviewCap.textContent = '');
  }

  // Apply cleanup updates in batch
  cleanupUpdates.forEach(update => update());

  // Use requestAnimationFrame instead of setTimeout for better performance
  requestAnimationFrame(() => {
    if (bigPreview && bigPreview.style.opacity === '0') {
      bigPreview.style.display = 'none';
    }
  });
}


