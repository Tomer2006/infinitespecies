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
    minPxRadius: 8,               // prune tiny nodes & their subtrees early (reduced for better detail)
    labelMinPxRadius: 18,         // minimum node radius (px) to consider it for labeling (reduced)
    labelMinFontPx: 10,           // minimum font size (px) for labels; smaller are skipped (reduced)
    verticalPadPx: 100,           // extra vertical padding (px) when culling to keep near-edge nodes visible
    // Performance knobs
    strokeMinPxRadius: 20,        // reduced for better performance
    // Nodes smaller than this on-screen are ignored for picking (in pixels)
    pickMinPxRadius: 4,
    maxLabels: 150,               // reduced for better performance
    labelGridCellPx: 40,          // increased for better performance
    maxNodesPerFrame: 12000,      // increased to handle more nodes
    showGrid: false,
    // New performance optimizations
    useFastRendering: true,       // enable fast rendering mode
    batchDrawCalls: true,         // batch similar draw operations
    lodLevels: 3,                 // number of level-of-detail levels
    lodThresholds: [50, 200, 500] // pixel radius thresholds for LOD
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


