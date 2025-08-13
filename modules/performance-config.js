// Performance Configuration
// Centralized control for all optimization settings

export const PERFORMANCE_CONFIG = {
  // === RENDERING OPTIMIZATIONS ===
  
  // View culling and rendering distance
  renderDistance: 1.0,                    // how far outside viewport to render (1.0 = screen diagonal)
  verticalPadPx: 100,                     // extra pixels above/below viewport for culling
  
  // Circle rendering thresholds
  minPxRadius: 0,                         // minimum circle size to draw (0 = draw all)
  strokeMinPxRadius: 12,                  // minimum size to draw circle outlines
  useMinRadius: false,                    // enable/disable minimum radius filtering
  
  // Label rendering
  labelMinPxRadius: 22,                   // minimum circle size to show labels
  labelMinFontPx: 12,                     // minimum font size for labels
  maxLabels: 300,                         // maximum labels to render per frame
  labelGridCellPx: 24,                    // spatial grid cell size for label overlap detection
  
  // Text measurement caching
  textCacheSize: 2000,                    // max cached text measurements
  enableTextCache: true,                  // enable/disable text measurement cache
  
  // Background grid
  enableGridPattern: true,                // use cached pattern vs drawing lines
  gridSize: 40,                          // grid line spacing in pixels
  gridAlpha: 0.05,                       // grid transparency
  
  // === DATA LOADING OPTIMIZATIONS ===
  
  // Progressive indexing
  indexingChunkMs: 20,                    // milliseconds between yields during indexing
  progressUpdateEvery: 2000,              // update progress every N nodes
  enableProgressiveIndexing: true,        // enable chunked processing
  
  // Split file loading
  maxConcurrentFiles: 8,                  // max parallel file downloads
  useConcurrencyLimit: true,              // enable concurrency-limited loading
  
  // Background tab handling
  skipYieldInBackground: true,            // don't yield in hidden tabs (faster loading)
  suppressProgressInBackground: true,     // don't update progress labels when hidden
  
  // === INTERACTION OPTIMIZATIONS ===
  
  // Picking/hit testing
  enablePickCache: true,                  // cache pick order per layout
  enableViewRadiusCache: true,            // cache viewport radius per frame
  
  // Camera/animation
  enablePrecomputedOrders: true,          // cache draw/pick orders
  
  // === EXPERIMENTAL/DEBUG ===
  
  // Debug rendering
  showPerformanceStats: true,            // display frame timing info
  maxNodesPerFrame: Infinity,             // artificial limit for testing
  
  // Fallback modes
  useFallbackRendering: false,            // simple rendering for very slow devices
  disableAnimations: false                // disable smooth camera transitions
};

// === HELPER FUNCTIONS ===

// Get effective minimum radius (with adaptive scaling if enabled)
export function getEffectiveMinRadius(zoomLevel) {
  if (!PERFORMANCE_CONFIG.useMinRadius) return 0;
  
  const base = PERFORMANCE_CONFIG.minPxRadius;
  // Optional: make it adaptive to zoom level
  return Math.max(1, base / Math.max(1, Math.sqrt(zoomLevel)));
}

// Check if we should render a circle of given screen radius
export function shouldRenderCircle(screenRadius) {
  return screenRadius >= getEffectiveMinRadius(1); // simplified - no zoom passed here
}

// Check if we should show labels for a circle
export function shouldShowLabel(screenRadius, fontSize) {
  return screenRadius >= PERFORMANCE_CONFIG.labelMinPxRadius && 
         fontSize >= PERFORMANCE_CONFIG.labelMinFontPx;
}

// Get concurrency limit based on hardware
export function getConcurrencyLimit() {
  if (!PERFORMANCE_CONFIG.useConcurrencyLimit) return Infinity;
  
  const base = PERFORMANCE_CONFIG.maxConcurrentFiles;
  const hwConcurrency = navigator.hardwareConcurrency || 4;
  return Math.min(base, Math.max(2, Math.ceil(hwConcurrency / 2)));
}

// === PRESETS ===

export const PERFORMANCE_PRESETS = {
  // High performance - all optimizations enabled, aggressive settings
  HIGH_PERFORMANCE: {
    ...PERFORMANCE_CONFIG,
    renderDistance: 0.8,
    minPxRadius: 3,
    useMinRadius: true,
    strokeMinPxRadius: 15,
    maxLabels: 200,
    labelGridCellPx: 32,
    indexingChunkMs: 10,
    progressUpdateEvery: 5000,
    maxConcurrentFiles: 12
  },
  
  // Balanced - good performance with visual quality
  BALANCED: {
    ...PERFORMANCE_CONFIG,
    renderDistance: 1.0,
    minPxRadius: 2,
    useMinRadius: true,
    strokeMinPxRadius: 12,
    maxLabels: 300,
    indexingChunkMs: 20
  },
  
  // High quality - favor visual quality over performance
  HIGH_QUALITY: {
    ...PERFORMANCE_CONFIG,
    renderDistance: 1.2,
    minPxRadius: 0,
    useMinRadius: false,
    strokeMinPxRadius: 8,
    maxLabels: 500,
    labelGridCellPx: 16,
    indexingChunkMs: 5,
    progressUpdateEvery: 1000
  },
  
  // Debug mode - show everything, enable debug features
  DEBUG: {
    ...PERFORMANCE_CONFIG,
    minPxRadius: 0,
    useMinRadius: false,
    maxLabels: Infinity,
    showPerformanceStats: true,
    indexingChunkMs: 50, // slower for debugging
    enableTextCache: false // force fresh measurements
  }
};

// Apply a preset configuration
export function applyPreset(presetName) {
  const preset = PERFORMANCE_PRESETS[presetName];
  if (!preset) {
    console.warn(`Unknown preset: ${presetName}`);
    return false;
  }
  
  Object.assign(PERFORMANCE_CONFIG, preset);
  console.log(`Applied performance preset: ${presetName}`);
  return true;
}

// === RUNTIME CONFIGURATION ===

// Auto-detect device capabilities and apply appropriate preset
export function autoConfigurePerformance() {
  const isLowEnd = navigator.hardwareConcurrency <= 2 || 
                   navigator.deviceMemory <= 2 ||
                   /Android.*Chrome\/[0-5]/.test(navigator.userAgent);
  
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  
  if (isLowEnd) {
    applyPreset('HIGH_PERFORMANCE');
    console.log('Auto-configured for low-end device');
  } else if (isMobile) {
    applyPreset('BALANCED');
    console.log('Auto-configured for mobile device');
  } else {
    applyPreset('HIGH_QUALITY');
    console.log('Auto-configured for desktop device');
  }
}

// Export for external configuration
if (typeof window !== 'undefined') {
  window.BIOZOOM_PERFORMANCE = {
    config: PERFORMANCE_CONFIG,
    presets: PERFORMANCE_PRESETS,
    applyPreset,
    autoConfigurePerformance
  };
}
