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
  // Canvas and render bootstrap
  resizeCanvas();
  registerDrawCallback(draw);

  // Wire UI and input events
  initEvents();

  // Load data and deep links
  initData();
  initDeepLinks();
  // After data load completes, attempt a jump to a lightweight start node
  // Note: jump is triggered inside setDataRoot after layout/indexing
})();


