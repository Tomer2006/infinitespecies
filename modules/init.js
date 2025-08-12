/* App initialization: load data and wire demo */
import { demoBtn } from './dom.js';
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

function makeDemoData() {
  return {
    name: 'Life',
    children: [
      { name: 'Bacteria', children: [ { name: 'Proteobacteria' }, { name: 'Firmicutes' } ] },
      { name: 'Archaea', children: [ { name: 'Euryarchaeota' }, { name: 'Crenarchaeota' } ] },
      { name: 'Eukaryota', children: [
        { name: 'Plants', children: [ { name: 'Bryophyta' }, { name: 'Tracheophyta' } ] },
        { name: 'Fungi', children: [ { name: 'Ascomycota' }, { name: 'Basidiomycota' } ] },
        { name: 'Animals', children: [ { name: 'Chordata' }, { name: 'Arthropoda' }, { name: 'Mollusca' } ] }
      ]}
    ]
  };
}

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
  return makeDemoData();
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
  const root = await loadTreeJson();
  applyData(root);
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      applyData(makeDemoData());
    });
  }
}


