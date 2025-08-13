/**
 * BioZoom Optimization Configuration Examples
 * 
 * This file demonstrates how to use the centralized optimization system
 * to tune performance for different scenarios.
 */

import { 
  applyPreset, 
  setConfig, 
  getConfig,
  performanceMonitor 
} from './modules/optimization.js';

// =============================================================================
// EXAMPLE 1: Apply a preset for mobile devices
// =============================================================================

function optimizeForMobile() {
  // Apply mobile preset - reduces memory usage and improves performance
  applyPreset('MOBILE');
  console.log('🔧 Applied mobile optimization preset');
}

// =============================================================================
// EXAMPLE 2: Apply preset for large datasets
// =============================================================================

function optimizeForLargeDataset() {
  // Use large dataset preset - optimizes for millions of nodes
  applyPreset('LARGE_DATASET');
  console.log('🔧 Applied large dataset optimization preset');
}

// =============================================================================
// EXAMPLE 3: Custom optimization for specific use case
// =============================================================================

function customOptimization() {
  // Get current config as base
  const currentConfig = getConfig();
  
  // Override specific settings
  setConfig({
    ...currentConfig,
    rendering: {
      ...currentConfig.rendering,
      maxLabels: 150,           // Reduce label count for better performance
      minPxRadius: 8,           // Hide very small circles
      labelMinPxRadius: 30,     // Only show labels on larger circles
    },
    dataLoading: {
      ...currentConfig.dataLoading,
      maxConcurrentRequests: 4, // Reduce network pressure
      chunkTimeMs: 30,          // Longer processing chunks
    },
    memory: {
      ...currentConfig.memory,
      thumbnailCacheSize: 50,   // Smaller cache
      memoryLimitMB: 300,       // Lower memory limit
    }
  });
  
  console.log('🔧 Applied custom optimization configuration');
}

// =============================================================================
// EXAMPLE 4: Runtime performance monitoring
// =============================================================================

function enablePerformanceMonitoring() {
  // The performance monitor is automatically available
  
  // Log performance stats every 5 seconds
  setInterval(() => {
    const metrics = performanceMonitor.getMetrics();
    console.log(`📊 Performance: ${metrics.frameRate.toFixed(1)}fps, ${metrics.memoryUsage.toFixed(1)}MB`);
  }, 5000);
  
  // Log detailed stats on demand
  document.addEventListener('keydown', (e) => {
    if (e.key === 'P' && e.ctrlKey) {
      performanceMonitor.logStats();
    }
  });
}

// =============================================================================
// EXAMPLE 5: Automatic optimization based on dataset size
// =============================================================================

function autoOptimizeForDatasetSize(nodeCount) {
  if (nodeCount > 1000000) {
    // Very large dataset
    applyPreset('LARGE_DATASET');
    console.log('🔧 Auto-applied LARGE_DATASET preset for', nodeCount.toLocaleString(), 'nodes');
    
  } else if (nodeCount > 100000) {
    // Medium dataset - custom config
    setConfig({
      rendering: {
        maxLabels: 250,
        labelMinPxRadius: 24,
        renderDistance: 0.9,
      },
      dataLoading: {
        maxConcurrentRequests: 8,
        chunkTimeMs: 15,
      }
    });
    console.log('🔧 Auto-applied medium dataset optimization for', nodeCount.toLocaleString(), 'nodes');
    
  } else {
    // Small dataset - use standard settings
    applyPreset('DESKTOP_STANDARD');
    console.log('🔧 Auto-applied standard optimization for', nodeCount.toLocaleString(), 'nodes');
  }
}

// =============================================================================
// EXAMPLE 6: Network-aware optimization
// =============================================================================

function optimizeForNetworkCondition() {
  // Check if we can estimate network speed
  if ('connection' in navigator) {
    const connection = navigator.connection;
    
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      // Slow network - reduce concurrency and chunk sizes
      setConfig({
        dataLoading: {
          maxConcurrentRequests: 2,
          preferredChunkSizeMB: 1,
          maxChunkSizeMB: 2,
        }
      });
      console.log('🔧 Optimized for slow network connection');
      
    } else if (connection.effectiveType === '4g') {
      // Fast network - increase concurrency
      setConfig({
        dataLoading: {
          maxConcurrentRequests: 12,
          preferredChunkSizeMB: 10,
          maxChunkSizeMB: 20,
        }
      });
      console.log('🔧 Optimized for fast network connection');
    }
  }
}

// =============================================================================
// EXAMPLE 7: Memory pressure handling
// =============================================================================

function handleMemoryPressure() {
  // Listen for memory pressure events (if supported)
  if ('memory' in performance) {
    const checkMemory = () => {
      const used = performance.memory.usedJSHeapSize / 1024 / 1024;
      const limit = getConfig().memory.memoryLimitMB;
      
      if (used > limit * 0.8) {
        console.warn('⚠️ High memory usage detected, applying memory optimizations');
        
        // Apply aggressive memory optimization
        setConfig({
          rendering: {
            maxLabels: 100,
            textMeasureCacheSize: 500,
          },
          memory: {
            thumbnailCacheSize: 20,
            imageCacheSize: 10,
          }
        });
        
        // Clear caches
        if (window.gc) {
          window.gc();
        }
      }
    };
    
    // Check memory every 10 seconds
    setInterval(checkMemory, 10000);
  }
}

// =============================================================================
// EXAMPLE 8: User preference based optimization
// =============================================================================

function applyUserPreferences() {
  // Check for user preferences in localStorage
  const preferences = JSON.parse(localStorage.getItem('biozoom-preferences') || '{}');
  
  if (preferences.performance === 'high-quality') {
    applyPreset('DESKTOP_HIGH');
    
  } else if (preferences.performance === 'battery-saver') {
    applyPreset('LOW_END');
    
  } else if (preferences.performance === 'balanced') {
    applyPreset('DESKTOP_STANDARD');
    
  } else {
    // Auto-detect optimal settings
    const optimalConfig = getOptimalConfig();
    setConfig(optimalConfig);
  }
  
  console.log('🔧 Applied user performance preferences');
}

// =============================================================================
// INITIALIZATION EXAMPLE
// =============================================================================

function initializeOptimizations() {
  console.log('🚀 Initializing BioZoom optimizations...');
  
  // 1. Apply user preferences or auto-detect
  applyUserPreferences();
  
  // 2. Adjust for network conditions
  optimizeForNetworkCondition();
  
  // 3. Enable performance monitoring
  enablePerformanceMonitoring();
  
  // 4. Set up memory pressure handling
  handleMemoryPressure();
  
  console.log('✅ Optimization system initialized');
  console.log('Current config:', getConfig());
  
  // Show help message
  console.log('💡 Press Ctrl+P to log detailed performance stats');
  console.log('💡 Use applyPreset("MOBILE") to switch to mobile optimization');
  console.log('💡 Use setConfig({...}) to customize optimization settings');
}

// Export functions for use in console or other modules
export {
  optimizeForMobile,
  optimizeForLargeDataset,
  customOptimization,
  enablePerformanceMonitoring,
  autoOptimizeForDatasetSize,
  optimizeForNetworkCondition,
  handleMemoryPressure,
  applyUserPreferences,
  initializeOptimizations
};

// Auto-initialize if this script is loaded directly
if (typeof window !== 'undefined' && window.location) {
  // Check if we should auto-initialize
  const params = new URLSearchParams(window.location.search);
  if (params.get('auto-optimize') !== 'false') {
    // Initialize optimizations after a short delay to let other modules load
    setTimeout(initializeOptimizations, 100);
  }
}
