import { LEVELS } from './constants.js';
import { clearIndex, registerNode, state } from './state.js';
import { setProgress, showLoading, hideLoading } from './loading.js';
import { progressLabel } from './dom.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap } from './state.js';
import { requestRender, W, H } from './canvas.js';
import { setBreadcrumbs } from './navigation.js';

function inferLevelByDepth(depth) {
  return LEVELS[depth] || `Level ${depth}`;
}

export function mapToChildren(obj) {
  const out = [];
  if (!obj || typeof obj !== 'object') return out;
  for (const [key, val] of Object.entries(obj)) {
    const node = { name: String(key) };
    if (val && typeof val === 'object' && Object.keys(val).length) {
      node.children = mapToChildren(val);
    } else {
      node.children = [];
    }
    out.push(node);
  }
  return out;
}

export function normalizeTree(rootLike) {
  if (Array.isArray(rootLike)) return { name: 'Life', level: 'Life', children: rootLike };
  if (typeof rootLike !== 'object' || rootLike === null)
    throw new Error('Top-level JSON must be an object or an array.');

  const hasStructuredProps =
    Object.prototype.hasOwnProperty.call(rootLike, 'name') ||
    Object.prototype.hasOwnProperty.call(rootLike, 'children');
  if (!hasStructuredProps) {
    const keys = Object.keys(rootLike);
    if (keys.length === 1) {
      const rootName = keys[0];
      return { name: String(rootName), children: mapToChildren(rootLike[rootName]) };
    }
    return { name: 'Life', level: 'Life', children: mapToChildren(rootLike) };
  }
  if (!Array.isArray(rootLike.children)) rootLike.children = rootLike.children ? [].concat(rootLike.children) : [];
  return rootLike;
}

function countNodes(root) {
  let c = 0,
    stack = [root];
  while (stack.length) {
    const n = stack.pop();
    c++;
    const ch = Array.isArray(n.children) ? n.children : [];
    for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
  }
  return c;
}

function computeDescendantCounts(node) {
  if (!node.children || node.children.length === 0) {
    node._leaves = 1;
    return 1;
  }
  let t = 0;
  for (const c of node.children) {
    t += computeDescendantCounts(c);
  }
  node._leaves = t;
  return t;
}

export async function indexTreeProgressive(root) {
  clearIndex();
  let processed = 0;
  const total = Math.max(1, countNodes(root));
  const stack = [{ node: root, parent: null, depth: 0 }];
  while (stack.length) {
    const { node, parent, depth } = stack.pop();
    if (node == null || typeof node !== 'object') continue;
    node.name = String(node.name ?? 'Unnamed');
    node.level = node.level || inferLevelByDepth(depth);
    node.parent = parent;
    node._id = state.globalId++;
    if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];
    registerNode(node);
    for (let i = node.children.length - 1; i >= 0; i--)
      stack.push({ node: node.children[i], parent: node, depth: depth + 1 });
    processed++;
    if (processed % 500 === 0) {
      setProgress(processed / total, `Indexing… ${processed.toLocaleString()}/${total.toLocaleString()}`);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  setProgress(0.98, 'Computing descendant counts…');
  computeDescendantCounts(root);
  setProgress(1, 'Done');
}

export async function loadFromJSONText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid JSON: ' + e.message);
  }
  const nroot = normalizeTree(parsed);
  await indexTreeProgressive(nroot);
  setDataRoot(nroot);
}

export async function loadFromUrl(url) {
  if (!url) throw new Error('No URL provided');
  
  // Check if this is a split dataset by looking for manifest.json
  const manifestUrl = url.replace(/[^/]*$/, 'manifest.json');
  
  try {
    const manifestRes = await fetch(manifestUrl, { cache: 'no-store' });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      if (manifest.version && manifest.files) {
        return await loadFromSplitFiles(url.replace(/[^/]*$/, ''), manifest);
      }
    }
  } catch (e) {
    // No manifest found, try loading as single file
  }
  
  // Single file loading
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const text = await res.text();
  await loadFromJSONText(text);
}

async function loadFromSplitFiles(baseUrl, manifest) {
  setProgress(0, `Loading ${manifest.total_files} split files...`);
  
  // Load all files in parallel with progress tracking
  let completed = 0;
  const chunks = [];
  
  const loadPromises = manifest.files.map(async (fileInfo, index) => {
    const fileUrl = baseUrl + fileInfo.filename;
    const res = await fetch(fileUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);
    const chunk = await res.json();
    
    completed++;
    setProgress(completed / manifest.total_files, 
      `Loaded ${completed}/${manifest.total_files} files...`);
    
    return { index, chunk, fileInfo };
  });
  
  const results = await Promise.all(loadPromises);
  
  setProgress(0.95, 'Merging tree data...');
  
  // Sort by index to maintain order
  results.sort((a, b) => a.index - b.index);

  // Determine schema type: structured nodes vs nested map
  const isStructuredNode = obj => obj && typeof obj === 'object' && (Object.prototype.hasOwnProperty.call(obj, 'children') || Object.prototype.hasOwnProperty.call(obj, 'name'));

  const anyStructured = results.some(r => isStructuredNode(r.chunk));

  let mergedTree;
  if (anyStructured) {
    // Structured nodes: collect children
    mergedTree = { name: 'Life', level: 'Life', children: [] };
    for (const { chunk } of results) {
      if (chunk && Array.isArray(chunk.children)) {
        mergedTree.children.push(...chunk.children);
      } else if (isStructuredNode(chunk)) {
        mergedTree.children.push(chunk);
      }
    }
  } else {
    // Nested key map: deep-merge all object chunks
    const deepMerge = (target, source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
      for (const [k, v] of Object.entries(source)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {};
          deepMerge(target[k], v);
        } else {
          target[k] = v;
        }
      }
      return target;
    };
    const mergedMap = {};
    for (const { chunk } of results) deepMerge(mergedMap, chunk);
    // Normalize will convert nested map to structured nodes
    const normalizedTree = normalizeTree(mergedMap);
    await indexTreeProgressive(normalizedTree);
    setDataRoot(normalizedTree);
    setProgress(1, `Loaded ${manifest.total_nodes?.toLocaleString() || 'many'} nodes from ${manifest.total_files} files`);
    return;
  }
  
  setProgress(0.98, 'Processing merged tree...');
  
  // Process the merged tree
  const normalizedTree = normalizeTree(mergedTree);
  await indexTreeProgressive(normalizedTree);
  setDataRoot(normalizedTree);
  
  setProgress(1, `Loaded ${manifest.total_nodes?.toLocaleString() || 'many'} nodes from ${manifest.total_files} files`);
}

export function setDataRoot(root) {
  state.DATA_ROOT = root;
  state.current = state.DATA_ROOT;
  state.layout = layoutFor(state.current);
  rebuildNodeMap();
  setBreadcrumbs(state.current);
  const pad = 20;
  state.camera.k = Math.min((W - pad) / state.layout.diameter, (H - pad) / state.layout.diameter);
  state.camera.x = 0;
  state.camera.y = 0;
  requestRender();
}

// Demo data
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RNG = mulberry32(42);
const NAME_BANK = {
  Domain: ['Bacteria', 'Archaea', 'Eukarya'],
  Kingdom: ['Animalia', 'Plantae', 'Fungi', 'Protista', 'Chromista'],
  Phylum: [
    'Chordata',
    'Arthropoda',
    'Mollusca',
    'Nematoda',
    'Echinodermata',
    'Annelida',
    'Bryophyta',
    'Tracheophyta',
    'Ascomycota',
    'Basidiomycota',
    'Ciliophora',
    'Amoebozoa'
  ],
  Class: [
    'Mammalia',
    'Aves',
    'Reptilia',
    'Amphibia',
    'Actinopterygii',
    'Insecta',
    'Arachnida',
    'Gastropoda',
    'Bivalvia',
    'Pinopsida',
    'Magnoliopsida',
    'Liliopsida',
    'Saccharomycetes',
    'Agaricomycetes'
  ],
  Order: [
    'Primates',
    'Carnivora',
    'Rodentia',
    'Passeriformes',
    'Coleoptera',
    'Lepidoptera',
    'Araneae',
    'Anura',
    'Squamata',
    'Poales',
    'Rosales',
    'Fabales',
    'Agaricales',
    'Helotiales'
  ],
  Family: [
    'Hominidae',
    'Felidae',
    'Canidae',
    'Muridae',
    'Corvidae',
    'Fringillidae',
    'Poaceae',
    'Rosaceae',
    'Fabaceae',
    'Agaricaceae',
    'Psathyrellaceae',
    'Salticidae',
    'Lycosidae'
  ],
  Genus: [
    'Homo',
    'Pan',
    'Felis',
    'Canis',
    'Mus',
    'Passer',
    'Quercus',
    'Rosa',
    'Pisum',
    'Agaricus',
    'Coprinopsis',
    'Salticus',
    'Lupus',
    'Helianthus',
    'Apis',
    'Drosophila',
    'Formica',
    'Carabus'
  ],
  Species: [
    'sapiens',
    'familiaris',
    'catus',
    'musculus',
    'domestica',
    'vulgaris',
    'officinalis',
    'alba',
    'niger',
    'rubra',
    'lutea',
    'grandis',
    'minor',
    'major',
    'elegans'
  ]
};
const PLAN_DEMO = [
  { level: 'Kingdom', min: 4, max: 6 },
  { level: 'Phylum', min: 4, max: 9 },
  { level: 'Class', min: 4, max: 8 },
  { level: 'Order', min: 3, max: 6 },
  { level: 'Family', min: 3, max: 5 },
  { level: 'Genus', min: 2, max: 4 },
  { level: 'Species', min: 1, max: 3 }
];
let globalIdDemo = 1;

export async function buildDemoData() {
  const root = { name: 'Life', level: 'Life', children: [], parent: null, _id: 0 };
  clearIndex();
  registerNode(root);
  let frontier = [root];
  showLoading('Preparing demo taxonomy…');
  for (let li = 0; li < PLAN_DEMO.length; li++) {
    const spec = PLAN_DEMO[li];
    const next = [];
    progressLabel.textContent = `Generating ${spec.level}…`;
    const total = frontier.length;
    let processed = 0;
    for (const p of frontier) {
      const count = spec.min + Math.floor(RNG() * (spec.max - spec.min + 1));
      const arr = [];
      for (let i = 0; i < count; i++) {
        const bag = NAME_BANK[spec.level] || [];
        const name = bag.length ? bag[i % bag.length] : `${spec.level}-${i + 1}`;
        const node = {
          name,
          level: spec.level,
          children: [],
          parent: p,
          _id: ++globalIdDemo
        };
        arr.push(node);
        registerNode(node);
      }
      p.children = arr;
      next.push(...arr);
      processed++;
      if (processed % Math.max(1, Math.floor(total / 20)) === 0) {
        setProgress((li + processed / total) / PLAN_DEMO.length);
        await new Promise(r => setTimeout(r, 0));
      }
    }
    frontier = next;
    setProgress((li + 1) / PLAN_DEMO.length);
    await new Promise(r => setTimeout(r, 0));
  }
  computeDescendantCounts(root);
  setProgress(1, 'Done');
  setDataRoot(root);
  hideLoading();
}


