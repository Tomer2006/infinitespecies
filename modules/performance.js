// Centralized optimization and tuning settings

export const perf = {
  // Rendering and label/layout tunables
  rendering: {
    renderDistance: 1.0,
    minPxRadius: 4,
    labelMinPxRadius: 22,
    labelMinFontPx: 12,
    verticalPadPx: 100,
    // Performance knobs
    strokeMinPxRadius: 12,      // skip stroking tiny circles
    maxLabels: 300,             // cap labels per frame
    labelGridCellPx: 24         // spatial bin for label overlap checks
  },

  // Canvas/device related caps
  canvas: {
    maxDevicePixelRatio: 2
  },

  // Animation timing
  animation: {
    cameraAnimationMs: 700
  },

  // Network loading behavior
  loading: {
    maxConcurrentRequestsCeil: 8,
    minConcurrentRequestsFloor: 2,
    hardwareConcurrencyDivisor: 2,
    fallbackConcurrentRequests: 6
  },

  // Background indexing of tree data
  indexing: {
    chunkMs: 20,
    progressEvery: 2000
  }
};

// Helper to compute an appropriate fetch concurrency for the environment
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


