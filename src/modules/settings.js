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
    
    // Depth-based render distance settings
    depthRenderEnabled: false,     // Enable depth-based render distance culling
    depthRenderBase: 8,           // Base number of levels to render from current node
    depthRenderFalloff: 0.7,      // Multiplier for render distance at each depth level (0.7 = 70% of previous)
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
    progressEvery: 1000          // update the progress UI every N nodes processed
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
    maxThumbnails: 100,           // maximum number of thumbnails to cache (prevents memory runaway)
    thumbnailDelayMs: 20          // delay (ms) before showing thumbnail preview
  },

  // Navigation settings
  navigation: {
    fitTargetRadiusMultiplier: 0.4  // Multiplier for fitNodeInView target radius (0.5 = 50% of viewport)
  },

  // Search settings
  search: {
    // Search results and UI settings
    maxResults: 150,               // maximum number of search results to return
    noMatchDisplayMs: 900,        // duration (ms) to display "No match" message
    
    // Pulse animation settings
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
    pulseColor: 'rgb(113, 247, 198)',  // Pulse border color
    
    // Search provider settings
    currentProvider: 'google',     // Current search provider: 'google', 'wikipedia', 'gbif', 'ncbi', 'col', 'inat'
    providers: {
      google: { name: 'Google', url: 'https://www.google.com/search?q=' },
      wikipedia: { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search?search=' },
      gbif: { name: 'GBIF', url: 'https://www.gbif.org/species/search?q=' },
      ncbi: { name: 'NCBI Taxonomy', url: 'https://www.ncbi.nlm.nih.gov/taxonomy/?term=' },
      col: { name: 'Catalogue of Life', url: 'https://www.catalogueoflife.org/data/search?q=' },
      inat: { name: 'iNaturalist', url: 'https://www.inaturalist.org/search?q=' }
    }
  },

  // Color palette configuration
  colors: {
    // Change this to switch between presets: 'tableau10', 'blueGradient'
    currentPreset: 'blueGradient',
    
    // Color palette presets
    presets: {
      // Preset 1: Original Tableau 10 colors
      tableau10: [
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
        ],
      
      // Preset 2: 38 colors from light blue to dark blue
      blueGradient: [
        'rgb(184, 211, 238)', // 1 - Start color
        'rgb(178, 204, 232)', // 2
        'rgb(172, 197, 226)', // 3
        'rgb(166, 190, 220)', // 4
        'rgb(160, 183, 214)', // 5
        'rgb(154, 176, 208)', // 6
        'rgb(148, 169, 202)', // 7
        'rgb(142, 162, 196)', // 8
        'rgb(136, 155, 190)', // 9
        'rgb(130, 148, 184)', // 10
        'rgb(124, 141, 178)', // 11
        'rgb(118, 134, 172)', // 12
        'rgb(112, 127, 166)', // 13
        'rgb(106, 120, 160)', // 14
        'rgb(100, 113, 154)', // 15
        'rgb(94, 106, 148)',  // 16
        'rgb(88, 99, 142)',   // 17
        'rgb(82, 92, 136)',   // 18
        'rgb(76, 85, 130)',   // 19
        'rgb(70, 78, 124)',   // 20
        'rgb(64, 71, 118)',   // 21
        'rgb(58, 64, 112)',   // 22
        'rgb(52, 57, 106)',   // 23
        'rgb(46, 50, 100)',   // 24
        'rgb(40, 43, 94)',    // 25
        'rgb(34, 36, 88)',    // 26
        'rgb(28, 29, 82)',    // 27
        'rgb(22, 22, 76)',    // 28
        'rgb(16, 15, 70)',    // 29
        'rgb(10, 8, 64)',     // 30
        'rgb(4, 1, 58)',      // 31
        'rgb(0, 0, 55)',      // 32
        'rgb(0, 0, 52)',      // 33
        'rgb(0, 0, 50)',      // 34
        'rgb(0, 0, 48)',      // 35
        'rgb(0, 0, 47)',      // 36
        'rgb(0, 0, 46)',      // 37
        'rgb(0, 0, 45)'       // 38 - Darkest blue (near black)
      ],
      
      // Preset 3: 37 colors alternating dark-light, getting darker each flip
      blueZigzag: [
        'rgb(50, 80, 140)',   // 1 - Dark
        'rgb(150, 200, 255)', // 2 - Light
        'rgb(45, 72, 128)',   // 3 - Darker
        'rgb(143, 191, 247)', // 4 - Less light
        'rgb(40, 65, 117)',   // 5 - Darker
        'rgb(136, 182, 238)', // 6 - Less light
        'rgb(36, 58, 106)',   // 7 - Darker
        'rgb(129, 173, 230)', // 8 - Less light
        'rgb(32, 52, 96)',    // 9 - Darker
        'rgb(122, 164, 221)', // 10 - Less light
        'rgb(28, 46, 87)',    // 11 - Darker
        'rgb(115, 155, 213)', // 12 - Less light
        'rgb(25, 41, 78)',    // 13 - Darker
        'rgb(108, 146, 204)', // 14 - Less light
        'rgb(22, 36, 70)',    // 15 - Darker
        'rgb(101, 137, 196)', // 16 - Less light
        'rgb(19, 32, 63)',    // 17 - Darker
        'rgb(94, 128, 187)',  // 18 - Less light
        'rgb(17, 28, 56)',    // 19 - Darker
        'rgb(87, 119, 179)',  // 20 - Less light
        'rgb(15, 25, 50)',    // 21 - Darker
        'rgb(80, 110, 170)',  // 22 - Less light
        'rgb(13, 22, 45)',    // 23 - Darker
        'rgb(73, 101, 162)',  // 24 - Less light
        'rgb(11, 19, 40)',    // 25 - Darker
        'rgb(66, 92, 153)',   // 26 - Less light
        'rgb(9, 16, 36)',     // 27 - Darker
        'rgb(59, 83, 145)',   // 28 - Less light
        'rgb(8, 14, 32)',     // 29 - Darker
        'rgb(52, 74, 136)',   // 30 - Less light
        'rgb(6, 12, 28)',     // 31 - Darker
        'rgb(45, 65, 128)',   // 32 - Less light
        'rgb(5, 10, 25)',     // 33 - Darker
        'rgb(38, 56, 119)',   // 34 - Less light
        'rgb(4, 8, 22)',      // 35 - Darker
        'rgb(31, 47, 111)',   // 36 - Less light
        'rgb(2, 5, 18)'       // 37 - Darkest
      ]
    },
    
    // Helper to get the current palette (used by the app)
    get palette() {
      return this.presets[this.currentPreset];
    }
  },

  // Font configuration
  fonts: {
    // Change this to switch between presets: 'inter', 'roboto', 'sourceSans', 'poppins', 'nunito', 'workSans', 'dmSans', 'lato', 'helvetica'
    currentPreset: 'helvetica',
    
    // Font presets (Google Fonts + System Fonts)
    presets: {
      inter: {
        name: 'Inter',
        import: 'Inter:wght@300;400;500;600;700;800'
      },
      roboto: {
        name: 'Roboto',
        import: 'Roboto:wght@300;400;500;700'
      },
      sourceSans: {
        name: 'Source Sans 3',
        import: 'Source+Sans+3:wght@300;400;500;600;700'
      },
      poppins: {
        name: 'Poppins',
        import: 'Poppins:wght@300;400;500;600;700'
      },
      nunito: {
        name: 'Nunito Sans',
        import: 'Nunito+Sans:wght@300;400;500;600;700'
      },
      workSans: {
        name: 'Work Sans',
        import: 'Work+Sans:wght@300;400;500;600;700'
      },
      dmSans: {
        name: 'DM Sans',
        import: 'DM+Sans:wght@300;400;500;600;700'
      },
      lato: {
        name: 'Lato',
        import: 'Lato:wght@300;400;700'
      },
      helvetica: {
        name: 'Helvetica',
        import: null  // System font, no import needed
      }
    },
    
    // Helper to get the current font
    get current() {
      return this.presets[this.currentPreset];
    }
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
