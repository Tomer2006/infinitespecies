// Removed LEVELS import - now using numeric levels directly
import { clearIndex, registerNode, state } from './state.js';
import { setProgress, showLoading, hideLoading } from './loading.js';
import { perf, computeFetchConcurrency } from './performance.js';
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
      return { name: 'Life', level: 0, children: mapToChildren(rootLike[rootName]) };
    }
    return { name: 'Life', level: 0, children: mapToChildren(rootLike) };
  }
  if (!Array.isArray(rootLike.children)) rootLike.children = rootLike.children ? [].concat(rootLike.children) : [];
  rootLike.name = 'Life';
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

function computeDescendantCountsIter(root) {
  // Post-order traversal without recursion
  const stack = [root];
  const post = [];
  while (stack.length) {
    const n = stack.pop();
    post.push(n);
    const ch = Array.isArray(n.children) ? n.children : [];
    for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
  }
  for (let i = post.length - 1; i >= 0; i--) {
    const n = post[i];
    const ch = Array.isArray(n.children) ? n.children : [];
    if (ch.length === 0) n._leaves = 1;
    else {
      let sum = 0;
      for (let j = 0; j < ch.length; j++) sum += ch[j]._leaves || 1;
      n._leaves = sum;
    }
  }
}

export async function indexTreeProgressive(root, options = {}) {
  const chunkMs = typeof options.chunkMs === 'number' ? options.chunkMs : perf.indexing.chunkMs;
  const progressEvery = typeof options.progressEvery === 'number' ? options.progressEvery : perf.indexing.progressEvery;
  clearIndex();
  let processed = 0;
  const total = Math.max(1, countNodes(root));
  const stack = [{ node: root, parent: null, depth: 0 }];
  let lastYield = performance.now();
  while (stack.length) {
    const now = performance.now();
    // Do not yield in background tabs (timers are heavily throttled there);
    // continue processing to avoid stalling loading when switching tabs.
    if (!document.hidden && now - lastYield >= chunkMs) {
      await new Promise(r => setTimeout(r, 0));
      lastYield = performance.now();
    }
    const { node, parent, depth } = stack.pop();
    if (node == null || typeof node !== 'object') continue;
    // Normalize and trim strings in-place to reduce memory
    node.name = String(node.name ?? 'Unnamed');
    if (node.name.length > 200) node.name = node.name.slice(0, 200);
    node.level = node.level || inferLevelByDepth(depth);
    node.parent = parent;
    node._id = state.globalId++;
    if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];
    // Drop empty metadata to free memory
    for (const k of Object.keys(node)) {
      if (k === 'name' || k === 'children' || k === 'level' || k === 'parent') continue;
      const v = node[k];
      if (v == null || (typeof v === 'object' && Object.keys(v).length === 0)) delete node[k];
    }
    registerNode(node);
    for (let i = node.children.length - 1; i >= 0; i--)
      stack.push({ node: node.children[i], parent: node, depth: depth + 1 });
    processed++;
    if (processed % progressEvery === 0) {
      setProgress(processed / total, `Indexing… ${processed.toLocaleString()}/${total.toLocaleString()}`);
    }
  }
  if (!document.hidden) setProgress(0.95, 'Computing descendant counts…');
  computeDescendantCountsIter(root);
  if (!document.hidden) setProgress(1, 'Done');
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
    const manifestRes = await fetch(manifestUrl, { cache: 'force-cache' });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      if (manifest.version && manifest.files) {
        state.datasetManifest = manifest;
        state.datasetBaseUrl = url.replace(/[^/]*$/, '');
        return await loadFromSplitFiles(state.datasetBaseUrl, manifest);
      }
    }
  } catch (e) {
    // No manifest found, try loading as single file
  }
  
  // Single file loading
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const text = await res.text();
  await loadFromJSONText(text);
}

async function loadFromSplitFiles(baseUrl, manifest) {
  // Lazy strategy:
  // 1) Load only root part(s)
  // 2) Attach stub children for paths present in manifest, to be loaded on demand
  setProgress(0, 'Loading root…');
  const rootEntry = manifest.files.find(f => f.is_root) || manifest.files[0];
  if (!rootEntry) throw new Error('Manifest has no files');
  const rootUrl = baseUrl + rootEntry.filename;
  const res = await fetch(rootUrl, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Failed to fetch ${rootUrl} (${res.status})`);
  const rootChunk = await res.json();

  // Normalize and index minimal root
  const normalizedRoot = normalizeTree(rootChunk);
  await indexTreeProgressive(normalizedRoot);

  // Build a map of pathPrefix -> filenames for quick lookup
  const pathToFiles = new Map();
  for (const f of manifest.files) {
    if (!f.path) continue;
    const path = String(f.path);
    if (!pathToFiles.has(path)) pathToFiles.set(path, []);
    pathToFiles.get(path).push(f.filename);
  }

  // Attach lazy stubs: for each top-level child under Life that has a matching manifest path,
  // mark it as lazy with a pointer to its path prefix
  function attachLazyStubs(node, pathPrefix) {
    if (!Array.isArray(node.children)) node.children = [];
    // If manifest lists deeper paths under this prefix, we consider it lazily loadable
    const prefix = pathPrefix ? pathPrefix : node.name;
    const hasParts = [...pathToFiles.keys()].some(p => p === prefix || p.startsWith(prefix + '/'));
    if (hasParts) {
      node._lazyPath = prefix;
      // Keep children as-is if present, otherwise a placeholder so UI renders expandables uniformly
      if (!node.children.length) node.children = [];
    }
    for (const ch of node.children) attachLazyStubs(ch, prefix + '/' + ch.name);
  }

  attachLazyStubs(normalizedRoot, 'Life');

  setDataRoot(normalizedRoot);
  state.datasetManifest = manifest;
  state.datasetBaseUrl = baseUrl;
  state.currentLoadedPath = 'Life';
  jumpToPreferredStart();
  setProgress(1, 'Ready');
}

export function setDataRoot(root) {
  state.DATA_ROOT = root;
  state.current = state.DATA_ROOT;
  state.layout = layoutFor(state.current);
  rebuildNodeMap();
  setBreadcrumbs(state.current);
  state.camera.k = Math.min(W / state.layout.diameter, H / state.layout.diameter);
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


