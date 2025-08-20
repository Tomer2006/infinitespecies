/* App initialization */
import { setDataRoot, setCurrent, setLayout, rebuildNodeMap } from './state.js';
import { layoutFor } from './layout.js';
import { setBreadcrumbs } from './navigation.js';
import { requestRender } from './render.js';

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
  try {
    const res = await fetch('tree.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) || (data && typeof data === 'object' && 'name' in data)) {
      return data;
    }
    if (data && typeof data === 'object') {
      return buildTreeFromNestedMap(data);
    }
  } catch (_) {
    // fall through
  }
  return null;
}

function applyData(root) {
  setDataRoot(root);
  // Note: setDataRoot already handles setting current, layout, rebuildNodeMap, breadcrumbs, and render
}

export async function initializeApp() {
  const root = await loadTreeJson();
  if (root) {
    applyData(root);
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


