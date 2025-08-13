/**
 * BioZoom Performance Optimization Configuration
 * 
 * Centralized configuration for all performance-related settings.
 * Adjust these values to optimize for different scenarios:
 * - Large datasets vs small datasets
 * - High-end devices vs mobile devices  
 * - Fast networks vs slow networks
 * - Memory-constrained environments
 */

// =============================================================================
// RENDERING PERFORMANCE
// =============================================================================

export const RENDERING = {
  // Viewport and distance settings
  renderDistance: 1.0,           // How far outside viewport to render (1.0 = screen diagonal)
  
  // Circle rendering thresholds (pixels)
  minPxRadius: 4,                // Skip circles smaller than this
  strokeMinPxRadius: 12,         // Skip circle strokes for tiny circles
  
  // Label rendering thresholds  
  labelMinPxRadius: 22,          // Skip labels for circles smaller than this
  labelMinFontPx: 12,            // Skip labels smaller than this font size
  maxLabels: 300,                // Maximum labels to render per frame
  
  // Label collision detection
  labelGridCellPx: 24,           // Spatial grid cell size for overlap detection
  
  // Canvas and frame settings
  maxDevicePixelRatio: 2,        // Cap DPR to prevent excessive memory usage
  targetFPS: 60,                 // Target frame rate
  
  // Text measurement caching
  textMeasureCacheSize: 2000,    // Max cached text measurements
  
  // Grid pattern optimization
  gridTileSize: 40,              // Background grid tile size (pixels)
  gridOpacity: 0.05,             // Grid opacity
  
  // Font rendering
  minFontSize: 10,               // Minimum font size to render
  maxFontSize: 18,               // Maximum font size to render
  fontScaleFactor: 3,            // Divide circle radius by this for font size
  
  // Stroke optimization  
  minStrokeWidth: 1,             // Minimum stroke width
  maxStrokeWidth: 6,             // Maximum stroke width for highlights
  strokeScaleFactor: 40,         // Circle radius divisor for stroke calculation
};

// =============================================================================
// DATA LOADING PERFORMANCE
// =============================================================================

export const DATA_LOADING = {
  // Progressive indexing
  chunkTimeMs: 20,               // Time slice for progressive operations (ms)
  yieldAfterNodes: 1000,         // Yield to browser after processing this many nodes
  
  // Network concurrency
  maxConcurrentRequests: 8,      // Max parallel file downloads
  minConcurrentRequests: 2,      // Min parallel file downloads
  autoDetectConcurrency: true,   // Use navigator.hardwareConcurrency
  
  // Cache settings
  disableCache: true,            // Disable HTTP cache for fresh data
  
  // Split file handling
  preferredChunkSizeMB: 5,       // Preferred size for data chunks
  maxChunkSizeMB: 15,            // Maximum size before splitting further
  
  // Progress reporting
  progressUpdateIntervalMs: 100, // How often to update progress UI
  
  // Memory management
  clearCacheThreshold: 10000,    // Clear caches when they exceed this size
  
  // Timeout settings
  requestTimeoutMs: 30000,       // Network request timeout
  parseTimeoutMs: 5000,          // JSON parsing timeout per chunk
};

// =============================================================================
// INTERACTION PERFORMANCE
// =============================================================================

export const INTERACTION = {
  // Animation settings
  animationDurationMs: 800,      // Default animation duration
  animationEasing: 'ease-out',   // CSS easing function
  
  // Hover and tooltip delays
  tooltipDelayMs: 500,           // Delay before showing tooltip
  thumbnailDelayMs: 1000,        // Delay before loading thumbnail
  
  // Search performance
  searchDebounceMs: 150,         // Debounce search input
  maxSearchResults: 100,         // Limit search results
  
  // Touch and mobile
  touchMoveThreshold: 10,        // Pixels to move before considering it a drag
  doubleTapMaxMs: 300,           // Max time between taps for double-tap
  
  // Smooth zoom
  wheelSensitivity: 0.001,       // Mouse wheel zoom sensitivity
  minZoomLevel: 0.1,             // Minimum zoom level
  maxZoomLevel: 50,              // Maximum zoom level
  
  // Navigation
  breadcrumbMaxVisible: 8,       // Max breadcrumb items to show
  historyMaxEntries: 50,         // Max navigation history entries
};

// =============================================================================
// MEMORY OPTIMIZATION
// =============================================================================

export const MEMORY = {
  // Cache limits
  thumbnailCacheSize: 200,       // Max cached thumbnails
  imageCacheSize: 100,           // Max cached images
  layoutCacheSize: 1000,         // Max cached layout calculations
  
  // Garbage collection hints
  gcAfterDataLoad: true,         // Suggest GC after loading large datasets
  gcAfterNavigation: false,      // Suggest GC after major navigation
  
  // Object pooling
  useObjectPools: true,          // Use object pools for frequent allocations
  poolInitialSize: 100,          // Initial pool sizes
  poolMaxSize: 1000,             // Maximum pool sizes
  
  // Memory monitoring
  enableMemoryMonitoring: true,  // Monitor memory usage
  memoryWarningThresholdMB: 500, // Warn when memory usage exceeds this
  memoryLimitMB: 1000,           // Hard limit for memory usage
};

// =============================================================================
// DEVICE-SPECIFIC PRESETS
// =============================================================================

export const PRESETS = {
  // High-performance desktop
  DESKTOP_HIGH: {
    rendering: {
      ...RENDERING,
      maxLabels: 500,
      textMeasureCacheSize: 5000,
      maxDevicePixelRatio: 3,
    },
    dataLoading: {
      ...DATA_LOADING,
      maxConcurrentRequests: 12,
      chunkTimeMs: 10,
    },
    memory: {
      ...MEMORY,
      thumbnailCacheSize: 500,
      memoryLimitMB: 2000,
    }
  },
  
  // Standard desktop
  DESKTOP_STANDARD: {
    rendering: RENDERING,
    dataLoading: DATA_LOADING,
    interaction: INTERACTION,
    memory: MEMORY,
  },
  
  // Mobile devices
  MOBILE: {
    rendering: {
      ...RENDERING,
      maxLabels: 150,
      textMeasureCacheSize: 500,
      maxDevicePixelRatio: 2,
      minPxRadius: 6,
      labelMinPxRadius: 28,
    },
    dataLoading: {
      ...DATA_LOADING,
      maxConcurrentRequests: 4,
      chunkTimeMs: 50,
      preferredChunkSizeMB: 2,
      maxChunkSizeMB: 5,
    },
    interaction: {
      ...INTERACTION,
      tooltipDelayMs: 300,
      thumbnailDelayMs: 2000,
    },
    memory: {
      ...MEMORY,
      thumbnailCacheSize: 50,
      imageCacheSize: 25,
      memoryLimitMB: 200,
    }
  },
  
  // Low-end devices
  LOW_END: {
    rendering: {
      ...RENDERING,
      maxLabels: 100,
      textMeasureCacheSize: 200,
      maxDevicePixelRatio: 1,
      minPxRadius: 8,
      labelMinPxRadius: 32,
      targetFPS: 30,
    },
    dataLoading: {
      ...DATA_LOADING,
      maxConcurrentRequests: 2,
      chunkTimeMs: 100,
      preferredChunkSizeMB: 1,
      maxChunkSizeMB: 2,
    },
    interaction: {
      ...INTERACTION,
      animationDurationMs: 400,
      tooltipDelayMs: 200,
      thumbnailDelayMs: 3000,
    },
    memory: {
      ...MEMORY,
      thumbnailCacheSize: 20,
      imageCacheSize: 10,
      memoryLimitMB: 100,
    }
  },
  
  // Large dataset optimization
  LARGE_DATASET: {
    rendering: {
      ...RENDERING,
      maxLabels: 200,
      renderDistance: 0.8,
      labelMinPxRadius: 26,
    },
    dataLoading: {
      ...DATA_LOADING,
      chunkTimeMs: 5,
      maxConcurrentRequests: 16,
    },
    memory: {
      ...MEMORY,
      gcAfterDataLoad: true,
      memoryLimitMB: 3000,
    }
  }
};

// =============================================================================
// AUTO-DETECTION AND CONFIGURATION
// =============================================================================

/**
 * Automatically detect device capabilities and return optimal configuration
 */
export function getOptimalConfig() {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|tablet/.test(ua);
  const isLowEnd = navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 2;
  
  // Detect device type
  if (isMobile || isLowEnd) {
    return isLowEnd ? PRESETS.LOW_END : PRESETS.MOBILE;
  }
  
  // Desktop detection
  const isHighEnd = navigator.hardwareConcurrency >= 8 && (!navigator.deviceMemory || navigator.deviceMemory >= 8);
  return isHighEnd ? PRESETS.DESKTOP_HIGH : PRESETS.DESKTOP_STANDARD;
}

/**
 * Get current active configuration
 */
let activeConfig = getOptimalConfig();

export function getConfig() {
  return activeConfig;
}

/**
 * Override configuration with custom settings
 */
export function setConfig(config) {
  activeConfig = { ...getOptimalConfig(), ...config };
  console.log('🎛️ Performance configuration updated:', activeConfig);
  return activeConfig;
}

/**
 * Apply a preset configuration
 */
export function applyPreset(presetName) {
  if (!PRESETS[presetName]) {
    console.warn(`Unknown preset: ${presetName}`);
    return activeConfig;
  }
  
  activeConfig = PRESETS[presetName];
  console.log(`🎛️ Applied ${presetName} performance preset`);
  return activeConfig;
}

/**
 * Get configuration for a specific category
 */
export function getRenderingConfig() {
  return activeConfig.rendering || RENDERING;
}

export function getDataLoadingConfig() {
  return activeConfig.dataLoading || DATA_LOADING;
}

export function getInteractionConfig() {
  return activeConfig.interaction || INTERACTION;
}

export function getMemoryConfig() {
  return activeConfig.memory || MEMORY;
}

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      frameRate: 0,
      renderTime: 0,
      memoryUsage: 0,
      nodeCount: 0,
      lastUpdate: Date.now()
    };
    this.enabled = getMemoryConfig().enableMemoryMonitoring;
  }
  
  update(frameTime, nodeCount = 0) {
    if (!this.enabled) return;
    
    this.metrics.frameRate = 1000 / frameTime;
    this.metrics.renderTime = frameTime;
    this.metrics.nodeCount = nodeCount;
    this.metrics.lastUpdate = Date.now();
    
    // Update memory usage if available
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024;
      
      const limit = getMemoryConfig().memoryLimitMB;
      if (this.metrics.memoryUsage > limit) {
        console.warn(`⚠️ Memory usage (${this.metrics.memoryUsage.toFixed(1)}MB) exceeds limit (${limit}MB)`);
      }
    }
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
  
  logStats() {
    const m = this.metrics;
    console.log(`📊 Performance: ${m.frameRate.toFixed(1)}fps, ${m.renderTime.toFixed(1)}ms render, ${m.memoryUsage.toFixed(1)}MB memory, ${m.nodeCount} nodes`);
  }
}

export const performanceMonitor = new PerformanceMonitor();

// =============================================================================
// EXPORTS
// =============================================================================

// Legacy exports for backward compatibility
export const settings = getRenderingConfig();

export default {
  RENDERING,
  DATA_LOADING,
  INTERACTION,
  MEMORY,
  PRESETS,
  getOptimalConfig,
  getConfig,
  setConfig,
  applyPreset,
  getRenderingConfig,
  getDataLoadingConfig,
  getInteractionConfig,
  getMemoryConfig,
  performanceMonitor,
};
