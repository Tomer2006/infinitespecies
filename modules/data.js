// Regular/eager data loading functionality
// Lazy loading is separated into data-lazy.js
import { clearIndex, registerNode, state, clearLazyCache } from './state.js';
import { setProgress, showLoading, hideLoading } from './loading.js';
import { perf, computeFetchConcurrency } from './performance.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap } from './state.js';
import { requestRender, W, H } from './canvas.js';
import { setBreadcrumbs, updateNavigation } from './navigation.js';
import { findByQuery } from './search.js';
import { goToNode } from './navigation.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { loadFromLazyManifest } from './data-lazy.js';

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
  // Preserve lazy and id properties for lazy loading
  if (rootLike.children) {
    rootLike.children.forEach(child => {
      if (child && typeof child === 'object') {
        // Ensure lazy nodes have proper structure
        if (child.lazy === true && child.id) {
          child.children = []; // Lazy nodes start with empty children
        }
      }
    });
  }
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
    // Preserve lazy-loading metadata ('lazy', 'id') so navigation can fetch subtrees on demand
    const essentialKeys = new Set(['name', 'children', 'level', 'parent', '_id', '_vx', '_vy', '_vr', '_leaves', 'lazy', 'id']);
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
    logInfo('Parsing JSON text…');
    parsed = JSON.parse(text);
  } catch (e) {
    logError('Invalid JSON during loadFromJSONText', e);
    throw new Error('Invalid JSON: ' + e.message);
  }
  logDebug('Normalizing parsed JSON tree');
  const nroot = normalizeTree(parsed);
  await indexTreeProgressive(nroot);
  setDataRoot(nroot);
  logInfo('JSON data loaded successfully, initialized root');
  await jumpToPreferredStart();
}

// Eager loading: loads everything at once
export async function loadEager(url) {
  if (!url) throw new Error('No URL provided');

  state.loadMode = 'eager';
  logInfo(`Loading data eagerly from ${url}`);

  // Check if this is a split dataset by looking for manifest.json
  const manifestUrl = url.replace(/[^/]*$/, 'manifest.json');
  const baseUrl = url.replace(/[^/]*$/, '');

  try {
    logDebug(`Attempting to fetch manifest from ${manifestUrl}`);
    const manifestRes = await fetch(manifestUrl, { cache: 'default' });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();

      // If it's a lazy manifest, warn and fall back to single file
      if (manifest.children && Array.isArray(manifest.children) && manifest.children.some(c => c.lazy)) {
        logWarn('Lazy manifest found but eager mode requested; falling back to single file loading');
      } else if (manifest.version && manifest.files) {
        logInfo('Split-file manifest detected, loading eagerly');
        return await loadFromSplitFiles(baseUrl, manifest);
      }
    } else {
      logDebug(`No manifest found at ${manifestUrl}`);
    }
  } catch (e) {
    logWarn(`Manifest fetch failed at ${manifestUrl}: ${e.message}`);
  }

  // Single file loading (fallback/default for eager mode)
  logInfo(`Loading single JSON file eagerly from ${url}`);
  const res = await fetch(url, { cache: 'default' });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const text = await res.text();
  await loadFromJSONText(text);
}

// Lazy loading: loads manifest first, then subtrees on demand
export async function loadLazy(url) {
  if (!url) throw new Error('No URL provided');

  const mode = 'lazy'; // Always lazy for this function
  state.loadMode = mode;
  logInfo(`Loading data lazily from ${url}`);

  // Check if this is a lazy dataset by looking for manifest.json
  const manifestUrl = url.replace(/[^/]*$/, 'manifest.json');
  const baseUrl = url.replace(/[^/]*$/, '');

  try {
    logDebug(`Attempting to fetch manifest from ${manifestUrl}`);
    const manifestRes = await fetch(manifestUrl, { cache: 'default' });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();

      // Check if it's a lazy manifest (has children with lazy flags)
      if (manifest.children && Array.isArray(manifest.children) && manifest.children.some(c => c.lazy)) {
        logInfo('Lazy manifest detected, loading with lazy mode');
        return await loadFromLazyManifest(baseUrl, manifest, mode);
      } else if (manifest.version && manifest.files) {
        logWarn('Split files manifest found but lazy mode requested; split files don\'t support lazy loading, falling back to single file');
      }
    } else {
      logDebug(`No manifest found at ${manifestUrl}`);
    }
  } catch (e) {
    logWarn(`Manifest fetch failed at ${manifestUrl}: ${e.message}`);
  }

  // Fallback: if no lazy manifest found, throw error since lazy mode requires lazy-compatible data
  throw new Error('Lazy loading requires a lazy-compatible manifest.json file. Use eager mode for single files or split files.');
}

export async function loadFromUrl(url, options = {}) {
  if (!url) throw new Error('No URL provided');

  const mode = options.mode || 'auto';

  if (mode === 'eager') {
    return await loadEager(url);
  } else if (mode === 'lazy') {
    return await loadLazy(url);
  } else if (mode === 'auto') {
    // Auto mode: try lazy first, fall back to eager
    try {
      return await loadLazy(url);
    } catch (e) {
      logWarn(`Lazy loading failed, falling back to eager: ${e.message}`);
      return await loadEager(url);
    }
  } else {
    throw new Error(`Unknown loading mode: ${mode}. Use 'eager', 'lazy', or 'auto'.`);
  }
}

async function loadFromSplitFiles(baseUrl, manifest) {
  const totalFiles = Array.isArray(manifest.files) ? manifest.files.length : (manifest.total_files || 0);
  logInfo(`Loading split dataset from ${baseUrl} (${totalFiles} files)`);
  setProgress(0, `Loading ${totalFiles} split files...`);

  // Increased concurrency for better performance
  const concurrency = Math.max(computeFetchConcurrency(), 8); // Minimum 8 concurrent requests
  let completed = 0;
  let failed = 0;
  const maxRetries = 3;
  const results = new Array(manifest.files.length);
  const retryQueue = [];

  const loadFileWithRetry = async (fileInfo, index, retryCount = 0) => {
    const fileUrl = baseUrl + fileInfo.file;
    try {
      logDebug(`Fetching split file ${fileUrl} (attempt ${retryCount + 1})`);
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
        logWarn(`Retrying ${fileUrl} after error: ${err.message}`);
        // Exponential backoff for retries
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return loadFileWithRetry(fileInfo, index, retryCount + 1);
      } else {
        failed++;
        logError(`Failed to load ${fileUrl} after ${maxRetries} retries`, err);
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
              logWarn(`Completed loading with ${failed} failed files out of ${totalFiles}`);
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
  logInfo(`Merging ${results.filter(Boolean).length} loaded split files`);
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
    logDebug('Split files contained structured nodes; merging children arrays');
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
    logDebug('Split files contained nested maps; performing deep merge');
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
    await jumpToPreferredStart();
    setProgress(1, `Loaded ${manifest.total_nodes?.toLocaleString() || 'many'} nodes from ${manifest.total_files} files`);
    return;
  }
  
  setProgress(0.98, 'Processing merged tree...');
  
  // Process the merged tree
  const normalizedTree = normalizeTree(mergedTree);
  await indexTreeProgressive(normalizedTree);
  setDataRoot(normalizedTree);
  await jumpToPreferredStart();
  const nodeCount = countNodes(normalizedTree);
  setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
  logInfo(`Split dataset loaded with ${nodeCount} nodes`);
}

export function setDataRoot(root) {
  // Clear lazy loading cache when loading new data
  clearLazyCache();
  state.DATA_ROOT = root;
  // Use centralized navigation update for initial setup
  updateNavigation(state.DATA_ROOT, false);
}

export async function jumpToPreferredStart() {
  // Respect deep links; only jump if no hash present
  if (location.hash && location.hash.length > 1) return;

  const preferred = findByQuery('Homo sapiens') || findByQuery('Homo');
  if (preferred) {
    // If the preferred node is lazy, load it first
    if (preferred.lazy === true) {
      try {
        const { loadSubtree } = await import('./data-lazy.js');
        await loadSubtree(preferred);
      } catch (error) {
        logWarn(`Failed to load preferred start node ${preferred.name}:`, error);
        return;
      }
    }
    // Jump without animation to avoid initial lag
    updateNavigation(preferred, false);
  }
}


