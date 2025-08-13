// Entry point for the modular Taxonomy Explorer
// Loads modules, initializes canvas sizing, data, events, deeplinks, and render loop

import { resizeCanvas, registerDrawCallback, requestRender, tick } from './modules/canvas.js';
import { draw } from './modules/render.js';
import { initEvents } from './modules/events.js';
import { showLoading, hideLoading } from './modules/loading.js';
import { loadFromUrl } from './modules/data.js';
import { decodePath, findNodeByPath } from './modules/deeplink.js';
import { goToNode } from './modules/navigation.js';
import { state } from './modules/state.js';
import { getOptimalConfig, setConfig, performanceMonitor } from './modules/optimization.js';

function initDeepLinks() {
  // Navigate when hash changes
  window.addEventListener('hashchange', () => {
    const hash = decodePath(location.hash.slice(1));
    if (!hash || !state.DATA_ROOT) return;
    const node = findNodeByPath(hash);
    if (node) goToNode(node, true);
  });

  // On first load, apply hash if present (no-op until data exists)
  setTimeout(() => {
    const hash = decodePath(location.hash.slice(1));
    if (hash && state.DATA_ROOT) {
      const node = findNodeByPath(hash);
      if (node) goToNode(node, true);
    }
  }, 0);
}

async function initData() {
  const params = new URLSearchParams(location.search);
  const qUrl = params.get('data');
  
  // Priority order: URL param, split data/, then single files
  const candidates = [
    qUrl,
    'data/manifest.json',  // Check for split files first
    'tree.json', 
    'taxonomy.json', 
    'data.json'
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      showLoading(`Loading ${url}…`);
      await loadFromUrl(url);
      hideLoading();
      tick();
      return;
    } catch (_err) {
      // try next
    }
  }
  
  // If all else fails, prompt user to load their own JSON
  hideLoading();
  const modal = document.getElementById('jsonModal');
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  const label = document.getElementById('progressLabel');
  if (label) label.textContent = 'No data found. Use Load JSON to import your taxonomy.';
}

(function init() {
  // Initialize optimization system first
  console.log('🎛️ Initializing BioZoom with optimal performance configuration...');
  const optimalConfig = getOptimalConfig();
  setConfig(optimalConfig);
  console.log('✅ Performance optimization applied:', {
    device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
    cores: navigator.hardwareConcurrency || 'Unknown',
    memory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown',
    maxLabels: optimalConfig.rendering?.maxLabels || 'N/A',
    concurrency: optimalConfig.dataLoading?.maxConcurrentRequests || 'N/A'
  });

  // Canvas and render bootstrap
  resizeCanvas();
  registerDrawCallback(draw);

  // Wire UI and input events
  initEvents();

  // Enable performance monitoring in development
  if (location.hostname === 'localhost' || location.search.includes('debug=true')) {
    console.log('🔬 Performance monitoring enabled (press Ctrl+P for stats)');
    document.addEventListener('keydown', (e) => {
      if (e.key === 'P' && e.ctrlKey) {
        e.preventDefault();
        performanceMonitor.logStats();
      }
    });
    
    // Auto-log stats every 30 seconds in debug mode
    setInterval(() => {
      if (state.DATA_ROOT) {
        performanceMonitor.logStats();
      }
    }, 30000);
  }

  // Load data and deep links
  initData();
  initDeepLinks();
  // After data load completes, attempt a jump to a lightweight start node
  // Note: jump is triggered inside setDataRoot after layout/indexing
})();


