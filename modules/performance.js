/**
 * Centralized performance and tuning settings for rendering, loading,
 * and background processing.
 *
 * Tweak these to trade visual fidelity for speed on different devices.
 * Most values are in pixels (px) or milliseconds (ms) and are used across
 * rendering, canvas, loading, and indexing modules.
 */

export const perf = {
  // Rendering and label/layout tunables
  rendering: {
    renderDistance: 0.9,          // tighter culling for better FPS
    minPxRadius: 10,              // prune tiny nodes & their subtrees early
    labelMinPxRadius: 22,         // minimum node radius (px) to consider it for labeling
    labelMinFontPx: 12,           // minimum font size (px) for labels; smaller are skipped
    verticalPadPx: 100,           // extra vertical padding (px) when culling to keep near-edge nodes visible
    // Performance knobs
    strokeMinPxRadius: 24,
    maxLabels: 180,
    labelGridCellPx: 30,
    maxNodesPerFrame: 9000,
    labelOutline: true,
    showGrid: false
  },

  // Canvas/device related caps
  canvas: {
    maxDevicePixelRatio: 1.5
  },

  // Animation timing
  animation: {
    cameraAnimationMs: 700        // duration (ms) for camera pan/zoom transitions
  },

  // Network loading behavior
  loading: {
    maxConcurrentRequestsCeil: 8, // upper bound for parallel fetches regardless of cores
    minConcurrentRequestsFloor: 2, // lower bound for parallel fetches
    hardwareConcurrencyDivisor: 2, // suggested concurrency = ceil(navigator.hardwareConcurrency / divisor)
    fallbackConcurrentRequests: 6  // used when hardwareConcurrency is unavailable
  },

  // Background indexing of tree data
  indexing: {
    chunkMs: 20,                  // time budget (ms) before yielding control back to the event loop
    progressEvery: 2000           // update the progress UI every N nodes processed
  }
};

/**
 * Compute an appropriate fetch concurrency for the current environment.
 *
 * Uses navigator.hardwareConcurrency when available, scaled by
 * perf.loading.hardwareConcurrencyDivisor, and then clamped to the
 * configured floor/ceiling. Falls back to a fixed value when cores
 * are unknown.
 */
export function computeFetchConcurrency() {
  const ceil = perf.loading.maxConcurrentRequestsCeil;
  const floor = perf.loading.minConcurrentRequestsFloor;
  const fallback = perf.loading.fallbackConcurrentRequests;
  const divisor = perf.loading.hardwareConcurrencyDivisor;
  const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 0;
  if (cores && divisor > 0) {
    const suggested = Math.ceil(cores / divisor);
    return Math.min(ceil, Math.max(floor, suggested));
  }
  return fallback;
}

// Simple adaptive quality scaler based on current FPS
export let perfTier = 'high';
let lastTuneMs = 0;

export function tuneForFps(fps) {
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (now - lastTuneMs < 1500) return false; // throttle adjustments to ~1.5s

  let needsResize = false;

  if (fps > 0 && fps < 24 && perfTier !== 'low') {
    // Drop quality to keep interaction smooth
    perfTier = 'low';
    perf.rendering.maxNodesPerFrame = 3500;
    perf.rendering.maxLabels = 120;
    perf.rendering.minPxRadius = 14;
    perf.rendering.labelMinPxRadius = 26;
    perf.rendering.strokeMinPxRadius = 30;
    perf.rendering.labelGridCellPx = 36;
    perf.rendering.labelOutline = false;
    if (perf.canvas.maxDevicePixelRatio !== 1) {
      perf.canvas.maxDevicePixelRatio = 1;
      needsResize = true;
    }
    lastTuneMs = now;
    return needsResize;
  }

  if (fps > 45 && perfTier !== 'high') {
    // Restore higher quality when we have headroom
    perfTier = 'high';
    perf.rendering.maxNodesPerFrame = 9000;
    perf.rendering.maxLabels = 180;
    perf.rendering.minPxRadius = 10;
    perf.rendering.labelMinPxRadius = 22;
    perf.rendering.strokeMinPxRadius = 24;
    perf.rendering.labelGridCellPx = 30;
    perf.rendering.labelOutline = true;
    if (perf.canvas.maxDevicePixelRatio !== 1.5) {
      perf.canvas.maxDevicePixelRatio = 1.5;
      needsResize = true;
    }
    lastTuneMs = now;
    return needsResize;
  }

  return false;
}


