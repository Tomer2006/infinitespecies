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
    renderDistance: 1.0,          // multiplier for view radius used for culling; 1.0 ≈ screen diagonal/2
    minPxRadius: 4,               // do not draw circles smaller than this screen-space radius (px)
    labelMinPxRadius: 22,         // minimum node radius (px) to consider it for labeling
    labelMinFontPx: 12,           // minimum font size (px) for labels; smaller are skipped
    verticalPadPx: 100,           // extra vertical padding (px) when culling to keep near-edge nodes visible
    // Performance knobs
    strokeMinPxRadius: 12,        // only add outline stroke if circle radius ≥ this (px)
    maxLabels: 300,               // hard cap on number of labels placed/drawn per frame
    labelGridCellPx: 24,          // size of spatial grid cell (px) for fast label overlap checks
    // Micro-dot fallback for tiny circles (helps visibility during scroll-zoom)
    microDotPx: 1,                // size of the fallback dot (px) for circles below minPxRadius
    maxMicroDots: 2000            // cap tiny fallback dots per frame to protect performance
  },

  // Canvas/device related caps
  canvas: {
    maxDevicePixelRatio: 2        // clamp devicePixelRatio to avoid excessive canvas sizes on HiDPI screens
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


