/**
 * Performance and configuration settings module
 *
 * Centralized configuration for all performance tuning, rendering parameters,
 * loading behavior, and UI settings. Values are organized by functional area
 * and can be tweaked to balance visual fidelity against performance on
 * different devices and data sizes.
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
    gridColor: 'rgba(138,161,255,1)',      // Grid line color
    gridAlpha: 0.15,           // Grid line opacity (0.05 = very faint, 0.15 = visible, 0.3 = prominent)
    gridLineWidth: 1,          // Grid line width in pixels

    // Stroke colors
    strokeColorWithChildren: 'rgba(220,230,255,0.75)',    // Stroke color for nodes with children
    strokeColorLeaf: 'rgba(220,230,255,0.75)',            // Stroke color for leaf nodes
    strokeColorWithChildrenDetail: 'rgba(220,230,255,0.75)', // Detailed stroke color for nodes with children
    strokeColorLeafDetail: 'rgba(220,230,255,0.75)',     // Detailed stroke color for leaf nodes
    strokeLineWidthBase: 1.5,  // Base stroke line width multiplier
    strokeLineWidthMin: 1,     // Minimum stroke line width
    strokeLineWidthMax: 3,     // Maximum stroke line width
    strokeLineWidthMinRatio: 0.25,  // Minimum ratio for stroke width calculation

    // Label rendering settings
    labelFillColor: 'rgba(233,238,255,1)',      // Label text fill color
    labelStrokeColor: 'rgba(0,0,0,0.8)',  // Label text stroke/outline color for small fonts (≤14px)
    labelStrokeColorLarge: 'rgba(0,0,0,0.8)',  // Label text stroke/outline color for large fonts (>14px)
    labelAlpha: 1,                  // Label text opacity (1 = fully opaque, best for readability)
    labelFontSizeMin: 10,           // Minimum label font size in pixels
    labelFontSizeMax: 18,           // Maximum label font size in pixels
    labelFontSizeDivisor: 3,        // Divisor for calculating font size from screen radius (fontSize = sr / divisor)
    labelFontWeight: 600,           // Font weight (600 = semi-bold)
    labelFontFamily: 'ui-sans-serif', // Font family
    labelStrokeWidthMin: 2,         // Minimum stroke width (applies to all fonts)
    labelStrokeWidthMax: 5,         // Maximum stroke width (applies to all fonts)
    labelLargeFontThreshold: 14    // Font size threshold (px) - no longer used for stroke width, kept for compatibility
  },

  // Canvas/device related caps
  canvas: {
    maxDevicePixelRatio: 1,
    targetFPS: 60,              // Target frames per second (60 FPS  / 60 = 16.66ms frame time)
    adaptiveFrameRate: true,    // Enable adaptive frame rate based on performance
    fpsUpdateIntervalMs: 125,   // Update FPS display every N ms (~8 times per second)
    viewportRadiusMultiplier: 0.5  // Multiplier for viewport radius calculation (0.5 = half diagonal)
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
    viewportCheckDebounceMs: 150,     // Debounce delay (ms) for viewport checks
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
    progressEvery: 100000,          // update the progress UI every N nodes processed
    progressMergePercent: 0.95,   // Progress percentage when merging split files
    progressProcessPercent: 0.98, // Progress percentage when processing merged tree
    progressIndexPercent: 0.5,    // Progress percentage when indexing skeleton
    progressDescendantsPercent: 0.95  // Progress percentage when computing descendant counts
  },

  // Memory management settings
  memory: {
    maxTextCacheSize: 1000,       // maximum text measurement cache entries
    cacheCleanupThreshold: 800,   // cleanup when cache exceeds this size
    gcHintInterval: 20000,        // suggest GC every 20 seconds during heavy usage
    progressiveCleanupBatch: 100,  // cleanup batch size for progressive operations
    maxThumbnailCache: 300         // maximum number of thumbnail images to cache
  },

  // Performance metrics settings
  metrics: {
    lagThresholdMs: 0.5  // Event loop lag threshold (ms) to display lag warning
  },

  // Preview/Thumbnail settings
  preview: {
    maxThumbnails: 300,           // maximum number of thumbnails to cache (prevents memory runaway)
    thumbnailDelayMs: 30          // delay (ms) before showing thumbnail preview
  },

  // Navigation settings
  navigation: {
    fitTargetRadiusMultiplier: 0.7  // Multiplier for fitNodeInView target radius (0.5 = 50% of viewport)
  },

  // Search settings
  search: {
    maxResults: 100,               // maximum number of search results to return
    noMatchDisplayMs: 900,        // duration (ms) to display "No match" message
    pulseMinScreenRadius: 2,       // Minimum screen radius (px) to show pulse animation
    pulsePositionMultiplier: 1.2,  // Multiplier for pulse element position offset
    pulseSizeMultiplier: 2.4,      // Multiplier for pulse element size
    pulseBorderWidth: 2,          // Pulse border width in pixels
    pulseShadowOuter: 0.6,        // Outer shadow multiplier for pulse effect
    pulseShadowInner: 0.3,        // Inner shadow multiplier for pulse effect
    pulseShadowOuter2: 0.5,       // Secondary outer shadow multiplier
    pulseShadowInner2: 0.25,      // Secondary inner shadow multiplier
    pulseOpacity: 0.7,            // Pulse animation opacity
    pulseScaleStart: 0.9,         // Pulse animation start scale
    pulseScaleEnd: 1.2,           // Pulse animation end scale
    pulseScaleOffset: 0.2,        // Pulse scale animation offset
    pulseDurationMs: 900,         // Pulse animation duration in milliseconds
    pulseColor: 'rgb(113, 247, 198)'  // Pulse border color
  },

  // Color palette (Tableau 10 colors for level-based assignment)
  colors: {
    palette: [
      'rgb(31, 118, 180)', // Blue
      'rgb(255, 126, 14)', // Orange
      'rgb(214, 39, 39)', // Red
      'rgb(44, 160, 44)', // Green
      'rgb(23, 189, 207)', // Teal
      'rgb(189, 189, 34)', // Yellow
      'rgb(147, 103, 189)', // Purple
      'rgb(227, 119, 195)', // Pink
      'rgb(140, 86, 75)', // Brown
      'rgb(127, 127, 127)'  // Gray
    ]
  },

  // Start page UI settings
  startPage: {
    showEagerLoadButton: true,     // whether to show the eager loading button
    showTestDataButton: false,     // whether to show the test data button
    defaultLoadMode: 'eager'        // default loading mode
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
