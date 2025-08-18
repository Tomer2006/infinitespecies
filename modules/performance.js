/**
 * Centralized performance and tuning settings for rendering, loading,
 * and background processing.
 *
 * Tweak these to trade visual fidelity for speed on different devices.
 * Most values are in pixels (px) or milliseconds (ms) and are used across
 * rendering, canvas, loading, and indexing modules.
 */

// Define two presets: "normal" (current defaults) and "performance" (faster on low-end)
export const presets = {
  normal: {
    rendering: {
      renderDistance: 0.9,
      minPxRadius: 10,
      labelMinPxRadius: 22,
      labelMinFontPx: 12,
      verticalPadPx: 100,
      strokeMinPxRadius: 24,
      maxLabels: 180,
      labelGridCellPx: 30,
      maxNodesPerFrame: 9000,
      showGrid: false
    },
    canvas: {
      maxDevicePixelRatio: 1.5
    },
    animation: {
      cameraAnimationMs: 700
    },
    loading: {
      maxConcurrentRequestsCeil: 8,
      minConcurrentRequestsFloor: 2,
      hardwareConcurrencyDivisor: 2,
      fallbackConcurrentRequests: 6
    },
    indexing: {
      chunkMs: 20,
      progressEvery: 2000
    }
  },
  performance: {
    rendering: {
      renderDistance: 0.75,
      minPxRadius: 16,
      labelMinPxRadius: 26,
      labelMinFontPx: 12,
      verticalPadPx: 100,
      strokeMinPxRadius: 28,
      maxLabels: 120,
      labelGridCellPx: 30,
      maxNodesPerFrame: 6000,
      showGrid: false
    },
    canvas: {
      maxDevicePixelRatio: 1.0
    },
    animation: {
      cameraAnimationMs: 700
    },
    loading: {
      maxConcurrentRequestsCeil: 8,
      minConcurrentRequestsFloor: 2,
      hardwareConcurrencyDivisor: 2,
      fallbackConcurrentRequests: 6
    },
    indexing: {
      chunkMs: 20,
      progressEvery: 2000
    }
  }
};

// Mutable config used across modules; start with the normal preset
export const perf = JSON.parse(JSON.stringify(presets.normal));

let currentPreset = 'normal';
export function applyPreset(name) {
  if (!presets[name]) return currentPreset;
  const src = presets[name];
  // Deep copy to shared perf object to keep references stable
  Object.assign(perf.rendering, src.rendering);
  Object.assign(perf.canvas, src.canvas);
  Object.assign(perf.animation, src.animation);
  Object.assign(perf.loading, src.loading);
  Object.assign(perf.indexing, src.indexing);
  currentPreset = name;
  return currentPreset;
}

export function getCurrentPresetName() {
  return currentPreset;
}

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


