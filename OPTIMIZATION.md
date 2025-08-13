# 🎛️ BioZoom Performance Optimization System

A comprehensive, centralized performance configuration system that consolidates all optimization settings in one place.

## 📁 Files

- **`modules/optimization.js`** - Main optimization configuration system
- **`optimization-examples.js`** - Usage examples and initialization code
- **`OPTIMIZATION.md`** - This documentation

## 🚀 Quick Start

### Automatic Optimization (Recommended)
The system automatically detects your device capabilities and applies optimal settings:

```javascript
// This happens automatically on app startup
import { getOptimalConfig, setConfig } from './modules/optimization.js';
const config = getOptimalConfig();
setConfig(config);
```

### Manual Optimization Presets

```javascript
import { applyPreset } from './modules/optimization.js';

// For mobile devices
applyPreset('MOBILE');

// For large datasets (millions of nodes)
applyPreset('LARGE_DATASET');

// For high-end desktop
applyPreset('DESKTOP_HIGH');

// For low-end devices
applyPreset('LOW_END');
```

### Custom Configuration

```javascript
import { setConfig, getConfig } from './modules/optimization.js';

const customConfig = {
  rendering: {
    maxLabels: 200,           // Reduce label count
    minPxRadius: 6,           // Hide smaller circles
    labelMinPxRadius: 28,     // Only show labels on larger circles
  },
  dataLoading: {
    maxConcurrentRequests: 4, // Reduce network load
    chunkTimeMs: 30,          // Longer processing chunks
  },
  memory: {
    thumbnailCacheSize: 50,   // Smaller cache
    memoryLimitMB: 300,       // Lower memory limit
  }
};

setConfig(customConfig);
```

## 📊 Performance Monitoring

```javascript
import { performanceMonitor } from './modules/optimization.js';

// Get current performance metrics
const metrics = performanceMonitor.getMetrics();
console.log(`FPS: ${metrics.frameRate.toFixed(1)}, Memory: ${metrics.memoryUsage.toFixed(1)}MB`);

// Log detailed stats
performanceMonitor.logStats();

// Auto-monitoring (press Ctrl+P for stats in debug mode)
// Enabled automatically when running on localhost
```

## ⚙️ Configuration Categories

### 🎨 Rendering Performance
Controls visual rendering and frame rate optimization:

```javascript
const rendering = {
  renderDistance: 1.0,           // Viewport render distance multiplier
  minPxRadius: 4,                // Skip circles smaller than this (px)
  strokeMinPxRadius: 12,         // Skip strokes on tiny circles (px)
  labelMinPxRadius: 22,          // Skip labels on small circles (px)
  labelMinFontPx: 12,            // Minimum font size to render (px)
  maxLabels: 300,                // Maximum labels per frame
  labelGridCellPx: 24,           // Label collision detection grid size
  maxDevicePixelRatio: 2,        // Cap DPR to prevent memory issues
  textMeasureCacheSize: 2000,    // Text measurement cache size
  gridTileSize: 40,              // Background grid tile size
  gridOpacity: 0.05,             // Grid transparency
  minFontSize: 10,               // Min font size
  maxFontSize: 18,               // Max font size
  fontScaleFactor: 3,            // Circle radius ÷ this = font size
};
```

### 📊 Data Loading Performance
Optimizes network requests and data processing:

```javascript
const dataLoading = {
  chunkTimeMs: 20,               // Time slice for progressive operations
  yieldAfterNodes: 1000,         // Yield to browser after N nodes
  maxConcurrentRequests: 8,      // Max parallel downloads
  minConcurrentRequests: 2,      // Min parallel downloads
  autoDetectConcurrency: true,   // Use hardware concurrency detection
  disableCache: true,            // Disable HTTP cache
  preferredChunkSizeMB: 5,       // Preferred data chunk size
  maxChunkSizeMB: 15,            // Maximum chunk size
  progressUpdateIntervalMs: 100, // Progress UI update frequency
  clearCacheThreshold: 10000,    // Clear caches at this size
  requestTimeoutMs: 30000,       // Network timeout
  parseTimeoutMs: 5000,          // JSON parse timeout
};
```

### 🖱️ Interaction Performance
Controls user interaction responsiveness:

```javascript
const interaction = {
  animationDurationMs: 800,      // Default animation duration
  animationEasing: 'ease-out',   // CSS easing function
  tooltipDelayMs: 500,           // Tooltip show delay
  thumbnailDelayMs: 1000,        // Thumbnail load delay
  searchDebounceMs: 150,         // Search input debounce
  maxSearchResults: 100,         // Search result limit
  touchMoveThreshold: 10,        // Touch drag threshold (px)
  doubleTapMaxMs: 300,           // Double-tap detection window
  wheelSensitivity: 0.001,       // Mouse wheel zoom sensitivity
  minZoomLevel: 0.1,             // Minimum zoom
  maxZoomLevel: 50,              // Maximum zoom
  breadcrumbMaxVisible: 8,       // Max breadcrumb items
  historyMaxEntries: 50,         // Navigation history limit
};
```

### 💾 Memory Optimization
Manages memory usage and caching:

```javascript
const memory = {
  thumbnailCacheSize: 200,       // Max cached thumbnails
  imageCacheSize: 100,           // Max cached images
  layoutCacheSize: 1000,         // Max cached layout calculations
  gcAfterDataLoad: true,         // Suggest GC after data load
  gcAfterNavigation: false,      // Suggest GC after navigation
  useObjectPools: true,          // Use object pooling
  poolInitialSize: 100,          // Initial pool size
  poolMaxSize: 1000,             // Maximum pool size
  enableMemoryMonitoring: true,  // Monitor memory usage
  memoryWarningThresholdMB: 500, // Memory warning threshold
  memoryLimitMB: 1000,           // Hard memory limit
};
```

## 🎯 Presets Overview

| Preset | Use Case | Key Optimizations |
|--------|----------|-------------------|
| `DESKTOP_HIGH` | High-end desktop | 500 labels, 12 concurrent requests, 2GB memory |
| `DESKTOP_STANDARD` | Standard desktop | 300 labels, 8 concurrent requests, 1GB memory |
| `MOBILE` | Mobile devices | 150 labels, 4 concurrent requests, 200MB memory |
| `LOW_END` | Low-end devices | 100 labels, 2 concurrent requests, 100MB memory |
| `LARGE_DATASET` | Millions of nodes | Reduced render distance, more concurrency |

## 🔧 Advanced Usage

### Auto-Optimization Based on Dataset Size

```javascript
import { autoOptimizeForDatasetSize } from './optimization-examples.js';

// Automatically choose optimal settings based on node count
autoOptimizeForDatasetSize(nodeCount);
```

### Network-Aware Optimization

```javascript
import { optimizeForNetworkCondition } from './optimization-examples.js';

// Adjust settings based on detected network speed
optimizeForNetworkCondition();
```

### Memory Pressure Handling

```javascript
import { handleMemoryPressure } from './optimization-examples.js';

// Monitor and respond to high memory usage
handleMemoryPressure();
```

### User Preference Based Settings

```javascript
// Save user preferences
localStorage.setItem('biozoom-preferences', JSON.stringify({
  performance: 'high-quality' // or 'battery-saver', 'balanced'
}));

// Apply user preferences
import { applyUserPreferences } from './optimization-examples.js';
applyUserPreferences();
```

## 📱 Device Detection

The system automatically detects:
- **Mobile devices** - Applies mobile-optimized settings
- **Hardware concurrency** - Adjusts parallel processing
- **Device memory** - Modifies memory limits
- **Network conditions** - Adapts loading strategy

## 🐛 Debug Mode

Enable debug mode for detailed performance monitoring:

```bash
# Add debug parameter to URL
http://localhost:8080/?debug=true

# Or run on localhost (auto-enabled)
```

Debug features:
- **Ctrl+P** - Log detailed performance stats
- **Auto-logging** - Performance stats every 30 seconds
- **Memory monitoring** - Warns about high memory usage
- **Configuration logging** - Shows active optimization settings

## 💡 Tips for Optimal Performance

1. **Large Datasets**: Use `LARGE_DATASET` preset for millions of nodes
2. **Mobile**: Let auto-detection handle mobile optimization
3. **Slow Networks**: Reduce `maxConcurrentRequests` and `chunkSizeMB`
4. **Memory Constrained**: Lower `memoryLimitMB` and cache sizes
5. **High-End Desktop**: Use `DESKTOP_HIGH` for maximum quality
6. **Debug Performance**: Use `?debug=true` to monitor performance

## 🔄 Migration from Old Settings

The old `settings` object in `constants.js` is now automatically populated from the optimization config. Most existing code will continue to work without changes.

**Before:**
```javascript
import { settings } from './constants.js';
console.log(settings.maxLabels); // 300
```

**After (same result):**
```javascript
import { settings } from './constants.js';
console.log(settings.maxLabels); // Uses current optimization config
```

**New way (recommended):**
```javascript
import { getRenderingConfig } from './optimization.js';
console.log(getRenderingConfig().maxLabels); // Current setting
```

## 🎯 Real-World Examples

### Scientific Conference Demo
```javascript
applyPreset('DESKTOP_HIGH');  // Maximum quality for presentation
```

### Educational Classroom (Slow WiFi)
```javascript
setConfig({
  dataLoading: {
    maxConcurrentRequests: 2,
    preferredChunkSizeMB: 1,
  }
});
```

### Research Analysis (Large Dataset)
```javascript
applyPreset('LARGE_DATASET');
```

### Mobile Field Work
```javascript
applyPreset('MOBILE');  // Automatically applied on mobile devices
```

---

**Need help?** Check `optimization-examples.js` for complete usage examples!
