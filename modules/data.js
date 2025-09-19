// Removed LEVELS import - now using numeric levels directly
import { clearIndex, registerNode, state } from './state.js';
import { setProgress, showLoading, hideLoading } from './loading.js';
import { perf, computeFetchConcurrency } from './performance.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap } from './state.js';
import { requestRender, W, H } from './canvas.js';
import { setBreadcrumbs, updateNavigation } from './navigation.js';
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
    if (node.name.length > 100) node.name = node.name.slice(0, 100);
    node.level = node.level || inferLevelByDepth(depth);
    node.parent = parent;
    node._id = state.globalId++;
    if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];

    // Aggressive memory optimization: drop all non-essential properties
    const essentialKeys = new Set(['name', 'children', 'level', 'parent', '_id', '_vx', '_vy', '_vr', '_leaves']);
    for (const k of Object.keys(node)) {
      if (!essentialKeys.has(k)) {
        delete node[k];
      }
    }

    // Further optimize: use shorter property names where possible
    if (node.children && node.children.length === 0) {
      node.children = []; // Ensure consistent empty array
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
    const manifestRes = await fetch(manifestUrl, { cache: 'default' });
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
  const res = await fetch(url, { cache: 'default' });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const text = await res.text();
  await loadFromJSONText(text);
}

async function loadFromSplitFiles(baseUrl, manifest) {
  const totalFiles = Array.isArray(manifest.files) ? manifest.files.length : (manifest.total_files || 0);
  setProgress(0, `Loading ${totalFiles} split files...`);

  // Increased concurrency for better performance
  const concurrency = Math.max(computeFetchConcurrency(), 8); // Minimum 8 concurrent requests
  let completed = 0;
  let failed = 0;
  const maxRetries = 3;
  const results = new Array(manifest.files.length);
  const retryQueue = [];

  const loadFileWithRetry = async (fileInfo, index, retryCount = 0) => {
    const fileUrl = baseUrl + fileInfo.filename;
    try {
      const res = await fetch(fileUrl, {
        cache: 'default',
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!res.ok) throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);
      const chunk = await res.json();
      results[index] = { index, chunk, fileInfo };
      completed++;

      // Update progress more frequently for better UX
      if (completed % Math.max(1, Math.floor(totalFiles / 20)) === 0 || completed === totalFiles) {
        setProgress(completed / totalFiles, `Loaded ${completed}/${totalFiles} files...`);
      }

      return true;
    } catch (err) {
      if (retryCount < maxRetries) {
        // Exponential backoff for retries
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return loadFileWithRetry(fileInfo, index, retryCount + 1);
      } else {
        failed++;
        console.error(`Failed to load ${fileUrl} after ${maxRetries} retries:`, err);
        return false;
      }
    }
  };

  // Parallel loading with controlled concurrency
  await new Promise((resolve, reject) => {
    let inFlight = 0;
    let nextIndex = 0;

    const startNext = () => {
      while (inFlight < concurrency && nextIndex < manifest.files.length) {
        const i = nextIndex++;
        inFlight++;
        const fileInfo = manifest.files[i];

        loadFileWithRetry(fileInfo, i).finally(() => {
          inFlight--;
          if (completed + failed === totalFiles) {
            if (failed > 0) {
              console.warn(`Completed loading with ${failed} failed files out of ${totalFiles}`);
            }
            resolve();
          } else {
            startNext();
          }
        });
      }
    };

    startNext();
  });

  // Filter out failed loads
  const validResults = results.filter(r => r !== undefined);

  setProgress(0.95, 'Merging tree data...');

  // Sort by index to maintain order
  validResults.sort((a, b) => a.index - b.index);

  // Determine schema type: structured nodes vs nested map
  const isStructuredNode = obj => obj && typeof obj === 'object' && (Object.prototype.hasOwnProperty.call(obj, 'children') || Object.prototype.hasOwnProperty.call(obj, 'name'));

  const anyStructured = validResults.some(r => isStructuredNode(r.chunk));

  let mergedTree;
  if (anyStructured) {
    // Structured nodes: collect children
    mergedTree = { name: 'Life', level: 0, children: [] };
    for (const { chunk } of validResults) {
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
    for (const { chunk } of validResults) deepMerge(mergedMap, chunk);
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
  const nodeCount = countNodes(normalizedTree);
  setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
}

export function setDataRoot(root) {
  state.DATA_ROOT = root;
  // Use centralized navigation update for initial setup
  updateNavigation(state.DATA_ROOT, false);
}

function jumpToPreferredStart() {
  // Respect deep links; only jump if no hash present
  if (location.hash && location.hash.length > 1) return;
  const preferred = findByQuery('Homo sapiens') || findByQuery('Homo');
  if (preferred) {
    // Jump without animation to avoid initial lag
    updateNavigation(preferred, false);
  }
}


