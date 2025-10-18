/* App initialization */
import { setDataRoot, loadFromJSONText } from './data.js';
import { setCurrent, setLayout, rebuildNodeMap } from './state.js';
import { layoutFor } from './layout.js';
import { setBreadcrumbs } from './navigation.js';
import { requestRender } from './render.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';

function buildTreeFromNestedMap(map) {
  const [rootName, rootVal] = Object.entries(map)[0] || ['Life', {}];
  function toNode(name, val) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const children = Object.entries(val).map(([k, v]) => toNode(k, v));
      return { name, children };
    }
    return { name };
  }
  return toNode(rootName, rootVal);
}

// Demo data removed

async function loadTreeJson() {
  // Try the tree of life root file first for proper hierarchy, then manifest.json, then tree.json
  const candidates = ['data/life_e7f04593.json', 'data/manifest.json', 'data/tree.json'];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) continue; // Try next candidate
      const text = await res.text();
      // Use the proper data loading system that handles lazy loading
      await loadFromJSONText(text);
      return true; // Successfully loaded
    } catch (error) {
      logError(`Failed to load ${url}`, error);
      // Continue to next candidate
    }
  }
  return null;
}

function applyData(root) {
  setDataRoot(root);
  setCurrent(root);
  setLayout(layoutFor(root));
  rebuildNodeMap();
  setBreadcrumbs(root);
  requestRender();
}

export async function initializeApp() {
  const success = await loadTreeJson();
  if (success) {
    // Data is already loaded and applied by loadFromJSONText
    // Just need to trigger initial render
    requestRender();
  } else {
    const modal = document.getElementById('jsonModal');
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
    const label = document.getElementById('progressLabel');
    if (label) label.textContent = 'No data found. Use Load JSON to import your taxonomy.';
  }
}


