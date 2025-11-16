/**
 * Centralized settings for performance tuning, rendering, loading,
 * background processing, and UI configuration.
 *
 * Tweak these to trade visual fidelity for speed on different devices.
 * Most values are in pixels (px) or milliseconds (ms) and are used across
 * rendering, canvas, loading, and indexing modules.
 */

export const perf = {
  // Rendering and label/layout tunables
  rendering: {
    renderDistance: 1,          // tighter culling for better FPS
    minPxRadius: 10,              // prune tiny nodes & their subtrees early
    labelMinPxRadius: 22,         // minimum node radius (px) to consider it for labeling
    labelMinFontPx: 12,           // minimum font size (px) for labels; smaller are skipped
    verticalPadPx: 100,           // extra vertical padding (px) when culling to keep near-edge nodes visible
    // Performance knobs
    strokeMinPxRadius: 24,
    // Nodes smaller than this on-screen are ignored for picking (in pixels)
    pickMinPxRadius: 4,
    maxLabels: 180,
    labelGridCellPx: 30,
    maxNodesPerFrame: 9000,
    showGrid: false,

    // Level-of-detail thresholds (in pixels)
    lodDetailThreshold: 8,     // Above this size, render with full detail
    lodMediumThreshold: 4,     // Above this size, render with medium detail
    lodSimpleThreshold: 2,     // Above this size, render simplified version
    lodSkipThreshold: 1,       // Below this size, skip rendering entirely

    // Grid pattern settings
    gridTileSize: 40,          // Grid tile size in pixels
    gridColor: '#8aa1ff',      // Grid line color
    gridAlpha: 0.05,           // Grid line opacity
    gridLineWidth: 1,          // Grid line width in pixels

    // Stroke colors
    strokeColorWithChildren: 'rgba(220,230,255,0.6)',    // Stroke color for nodes with children
    strokeColorLeaf: 'rgba(180,195,240,0.6)',            // Stroke color for leaf nodes
    strokeColorWithChildrenDetail: 'rgba(220,230,255,0.85)', // Detailed stroke color for nodes with children
    strokeColorLeafDetail: 'rgba(180,195,240,0.85)',     // Detailed stroke color for leaf nodes
    strokeLineWidthBase: 1.5,  // Base stroke line width multiplier
    strokeLineWidthMin: 1,     // Minimum stroke line width
    strokeLineWidthMax: 3      // Maximum stroke line width
  },

  // Canvas/device related caps
  canvas: {
    maxDevicePixelRatio: 1,
    targetFPS: 60,              // Target frames per second (1000 / targetFPS = frame time in ms)
    adaptiveFrameRate: true,    // Enable adaptive frame rate based on performance
    fpsUpdateIntervalMs: 125    // Update FPS display every N ms (~8 times per second)
  },

  // Animation timing
  animation: {
    cameraAnimationMs: 700        // duration (ms) for camera pan/zoom transitions
  },

  // Input/Interaction settings
  input: {
    zoomSensitivity: 0.0015,      // Mouse wheel zoom sensitivity (higher = more sensitive)
    clickDisabledFeedbackMs: 200, // Duration (ms) to show disabled cursor feedback on click during loading
    tooltipThumbDelayMs: 60,      // Delay (ms) before showing thumbnail preview in tooltip
    searchNoMatchDisplayMs: 900  // Duration (ms) to display "No match" message in search
  },

  // Debounce/Timing settings
  timing: {
    viewportCheckDebounceMs: 150,     // Debounce delay (ms) for lazy loading viewport checks
    navigationViewportDelayMs: 500,   // Delay (ms) after navigation before triggering viewport check
    searchDebounceMs: 300,             // Debounce delay (ms) for search input
    metricsUpdateIntervalMs: 500,      // Interval (ms) for updating performance metrics
    eventLoopLagAlpha: 0.2             // Exponential moving average alpha for event loop lag smoothing
  },

  // Network loading behavior
  loading: {
    maxConcurrentRequestsCeil: 8,     // upper bound for parallel fetches regardless of cores
    minConcurrentRequestsFloor: 2,    // lower bound for parallel fetches
    hardwareConcurrencyDivisor: 2,     // suggested concurrency = ceil(navigator.hardwareConcurrency / divisor)
    fallbackConcurrentRequests: 6,    // used when hardwareConcurrency is unavailable
    fetchTimeoutMs: 30000,             // Timeout (ms) for fetch requests
    maxRetries: 3,                     // Maximum number of retry attempts for failed fetches
    retryBaseDelayMs: 1000             // Base delay (ms) for exponential backoff retry (delay = base * 2^retryCount)
  },

  // Background indexing of tree data
  indexing: {
    chunkMs: 20,                  // time budget (ms) before yielding control back to the event loop
    progressEvery: 2000           // update the progress UI every N nodes processed
  },

  // Memory management settings
  memory: {
    maxTextCacheSize: 1000,       // maximum text measurement cache entries
    cacheCleanupThreshold: 800,   // cleanup when cache exceeds this size
    gcHintInterval: 20000,        // suggest GC every 20 seconds during heavy usage
    progressiveCleanupBatch: 100,  // cleanup batch size for progressive operations
    maxThumbnailCache: 300         // maximum number of thumbnail images to cache
  },

  // Preview/Thumbnail settings
  preview: {
    maxThumbnails: 300,           // maximum number of thumbnails to cache (prevents memory runaway)
    thumbnailDelayMs: 60          // delay (ms) before showing thumbnail preview
  },

  // Navigation settings
  navigation: {
    fitTargetRadiusMultiplier: 0.5  // Multiplier for fitNodeInView target radius (0.5 = 50% of viewport)
  },

  // Search settings
  search: {
    maxResults: 50,               // maximum number of search results to return
    noMatchDisplayMs: 900,        // duration (ms) to display "No match" message
    pulseShadowOuter: 0.6,        // Outer shadow multiplier for pulse effect
    pulseShadowInner: 0.3,        // Inner shadow multiplier for pulse effect
    pulseShadowOuter2: 0.5,       // Secondary outer shadow multiplier
    pulseShadowInner2: 0.25,      // Secondary inner shadow multiplier
    pulseOpacity: 0.7,            // Pulse animation opacity
    pulseScaleOffset: 0.2,        // Pulse scale animation offset
    pulseDurationMs: 900,         // Pulse animation duration in milliseconds
    pulseColor: 'rgba(113,247,197,0.6)'  // Pulse border color
  },

  // Color palette (Tableau 10 colors for level-based assignment)
  colors: {
    palette: [
      '#1f77b4', // Blue
      '#ff7f0e', // Orange
      '#d62728', // Red
      '#2ca02c', // Green (Teal-ish)
      '#17becf', // Teal
      '#bcbd22', // Yellow
      '#9467bd', // Purple
      '#e377c2', // Pink
      '#8c564b', // Brown
      '#7f7f7f'  // Gray
    ]
  },

  // Start page UI settings
  startPage: {
    showLazyLoadButton: false,      // whether to show the lazy loading button
    showEagerLoadButton: true,     // whether to show the eager loading button
    showTestDataButton: false,     // whether to show the test data button
    defaultLoadMode: 'eager'        // default loading mode ('lazy' or 'eager')
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
