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
        return await loadFromSplitFiles(url.replace(/[^/]*$/, ''), manifest);
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
  setProgress(0, `Loading ${manifest.total_files} split files...`);
  // Concurrency-limited loader (browser typically limits to ~6 per host)
  const concurrency = computeFetchConcurrency();
  let completed = 0;
  const results = new Array(manifest.files.length);
  let inFlight = 0;
  let nextIndex = 0;
  await new Promise((resolve, reject) => {
    const startNext = () => {
      while (inFlight < concurrency && nextIndex < manifest.files.length) {
        const i = nextIndex++;
        inFlight++;
        const fileInfo = manifest.files[i];
        const fileUrl = baseUrl + fileInfo.filename;
        fetch(fileUrl, { cache: 'force-cache' })
          .then(res => {
            if (!res.ok) throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);
            return res.json();
          })
          .then(chunk => {
            results[i] = { index: i, chunk, fileInfo };
            completed++;
            if (completed % 2 === 0 || completed === manifest.total_files) {
              setProgress(completed / manifest.total_files, `Loaded ${completed}/${manifest.total_files} files...`);
            }
          })
          .then(() => {
            inFlight--;
            if (completed === manifest.files.length) resolve();
            else startNext();
          })
          .catch(err => reject(err));
      }
    };
    startNext();
  });
  
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


