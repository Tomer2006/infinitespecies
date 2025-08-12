// Removed LEVELS import - now using numeric levels directly
import { clearIndex, registerNode, state } from './state.js';
import { setProgress, showLoading, hideLoading } from './loading.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap } from './state.js';
import { requestRender, W, H } from './canvas.js';
import { setBreadcrumbs } from './navigation.js';
import { findByQuery } from './search.js';
import { goToNode } from './navigation.js';

function inferLevelByDepth(depth) {
  return depth;
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
  if (Array.isArray(rootLike)) return { name: 'Life', level: 0, children: rootLike };
  if (typeof rootLike !== 'object' || rootLike === null)
    throw new Error('Top-level JSON must be an object or an array.');

  const hasStructuredProps =
    Object.prototype.hasOwnProperty.call(rootLike, 'name') ||
    Object.prototype.hasOwnProperty.call(rootLike, 'children');
  if (!hasStructuredProps) {
    const keys = Object.keys(rootLike);
    if (keys.length === 1) {
      const rootName = keys[0];
      return { name: String(rootName), level: 0, children: mapToChildren(rootLike[rootName]) };
    }
    return { name: 'Life', level: 0, children: mapToChildren(rootLike) };
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
  // Try to move user to Homo sapiens for light initial view
  jumpToPreferredStart();
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
    mergedTree = { name: 'Life', level: 0, children: [] };
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
    jumpToPreferredStart();
    setProgress(1, `Loaded ${manifest.total_nodes?.toLocaleString() || 'many'} nodes from ${manifest.total_files} files`);
    return;
  }
  
  setProgress(0.98, 'Processing merged tree...');
  
  // Process the merged tree
  const normalizedTree = normalizeTree(mergedTree);
  await indexTreeProgressive(normalizedTree);
  setDataRoot(normalizedTree);
  jumpToPreferredStart();
  
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

function jumpToPreferredStart() {
  // Respect deep links; only jump if no hash present
  if (location.hash && location.hash.length > 1) return;
  const preferred = findByQuery('Homo sapiens') || findByQuery('Homo');
  if (preferred) {
    // Jump without animation to avoid initial lag
    goToNode(preferred, false);
    state.highlightNode = preferred;
    requestRender();
  }
}


