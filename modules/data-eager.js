// Eager loading functionality for taxonomy tree data
import { state } from './state.js';
import { computeFetchConcurrency, perf } from './performance.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { setProgress } from './loading.js';
import { updateNavigation } from './navigation.js';

// ============================================================================
// COMMON DATA LOADING FUNCTIONS (formerly in data-common.js)
// ============================================================================

function inferLevelByDepth(depth) {
  return depth;
}

// Cache for Object.keys to avoid repeated calls
const hasOwnProperty = Object.prototype.hasOwnProperty;

export function mapToChildren(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const out = [];
  const entries = Object.entries(obj);
  for (let i = 0; i < entries.length; i++) {
    const [key, val] = entries[i];
    const node = { name: String(key) };
    if (val && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length > 0) {
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

  const hasName = hasOwnProperty.call(rootLike, 'name');
  const hasChildren = hasOwnProperty.call(rootLike, 'children');
  
  if (!hasName && !hasChildren) {
    const keys = Object.keys(rootLike);
    if (keys.length === 1) {
      return { name: 'Life', level: 0, children: mapToChildren(rootLike[keys[0]]) };
    }
    return { name: 'Life', level: 0, children: mapToChildren(rootLike) };
  }
  
  if (!Array.isArray(rootLike.children)) {
    rootLike.children = rootLike.children ? [rootLike.children].flat() : [];
  }
  rootLike.name = 'Life';
  return rootLike;
}

function countNodes(root) {
  let c = 0;
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    c++;
    const ch = n.children;
    if (Array.isArray(ch) && ch.length > 0) {
      for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
    }
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
    const ch = n.children;
    if (Array.isArray(ch) && ch.length > 0) {
      for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
    }
  }
  for (let i = post.length - 1; i >= 0; i--) {
    const n = post[i];
    const ch = n.children;
    if (Array.isArray(ch) && ch.length > 0) {
      let sum = 0;
      for (let j = 0; j < ch.length; j++) sum += ch[j]._leaves || 1;
      n._leaves = sum;
    } else {
      n._leaves = 1;
    }
  }
}

export async function indexTreeProgressive(root, options = {}) {
  const chunkMs = typeof options.chunkMs === 'number' ? options.chunkMs : perf.indexing.chunkMs;
  const progressEvery = typeof options.progressEvery === 'number' ? options.progressEvery : perf.indexing.progressEvery;
  state.globalId = 1;
  let processed = 0;
  const total = Math.max(1, countNodes(root));
  const stack = [{ node: root, parent: null, depth: 0 }];
  let lastYield = performance.now();
  const essentialKeys = new Set(['name', 'children', 'level', 'parent', '_id', '_vx', '_vy', '_vr', '_leaves']);
  
  while (stack.length) {
    const now = performance.now();
    if (!document.hidden && now - lastYield >= chunkMs) {
      await new Promise(r => setTimeout(r, 0));
      lastYield = performance.now();
    }
    
    const { node, parent, depth } = stack.pop();
    if (node == null || typeof node !== 'object') continue;
    
    // Normalize and trim strings in-place
    const name = String(node.name ?? 'Unnamed');
    node.name = name.length > 100 ? name.slice(0, 100) : name;
    node.level = node.level || depth;
    node.parent = parent;
    node._id = state.globalId++;
    
    if (!Array.isArray(node.children)) {
      node.children = node.children ? [node.children].flat() : [];
    }

    // Drop non-essential properties
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      if (!essentialKeys.has(keys[i])) {
        delete node[keys[i]];
      }
    }

    const children = node.children;
    if (children.length > 0) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ node: children[i], parent: node, depth: depth + 1 });
      }
    }
    
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
  logDebug(`Parsing JSON text (${text.length} chars)`);
  const startTime = performance.now();

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

  const duration = performance.now() - startTime;
  logInfo(`JSON data loaded successfully in ${duration.toFixed(0)}ms`);
}

export function setDataRoot(root) {
  state.DATA_ROOT = root;
  // Use centralized navigation update for initial setup
  updateNavigation(state.DATA_ROOT, false);
}

// ============================================================================
// EAGER LOADING FUNCTIONS
// ============================================================================

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
      if (manifest.version && manifest.files) {
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
  
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }

  const text = await res.text();
  await loadFromJSONText(text);
}

async function loadFromSplitFiles(baseUrl, manifest) {
  const startTime = performance.now();
  const totalFiles = Array.isArray(manifest.files) ? manifest.files.length : (manifest.total_files || 0);
  
  logInfo(`Loading split dataset from ${baseUrl} (${totalFiles} files)`);
  
  const { setProgress } = await import('./loading.js');
  setProgress(0, `Loading ${totalFiles} split files...`);

  const concurrency = Math.max(computeFetchConcurrency(), 8);
  let completed = 0;
  let failed = 0;
  const maxRetries = 3;
  const results = new Array(manifest.files.length);
  const progressUpdateInterval = Math.max(1, Math.floor(totalFiles / 20));

  const loadFileWithRetry = async (fileInfo, index, retryCount = 0) => {
    const fileUrl = baseUrl + fileInfo.filename;

    try {
      if (retryCount > 0) {
        logDebug(`Fetching split file ${fileUrl} (attempt ${retryCount + 1})`);
      }

      const res = await fetch(fileUrl, {
        cache: 'default',
        signal: AbortSignal.timeout(30000)
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);
      }

      const chunk = await res.json();
      results[index] = { index, chunk, fileInfo };
      completed++;

      if (completed % progressUpdateInterval === 0 || completed === totalFiles) {
        setProgress(completed / totalFiles, `Loaded ${completed}/${totalFiles} files...`);
      }

      return true;
    } catch (err) {
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        logWarn(`Retrying ${fileUrl} after error: ${err.message}`);
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
  await new Promise((resolve) => {
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

  const validResults = results.filter(r => r !== undefined);
  logInfo(`Merging ${validResults.length} loaded split files`);
  setProgress(0.95, 'Merging tree data...');

  // Sort by index to maintain order
  validResults.sort((a, b) => a.index - b.index);

  // Determine schema type: structured nodes vs nested map
  const isStructuredNode = obj => obj && typeof obj === 'object' && (hasOwnProperty.call(obj, 'children') || hasOwnProperty.call(obj, 'name'));
  const anyStructured = validResults.some(r => isStructuredNode(r.chunk));

  let mergedTree;
  if (anyStructured) {
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
    logDebug('Split files contained nested maps; performing deep merge');
    
    // Optimized deep merge: avoid recursion for better performance
    const deepMerge = (target, source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
      const entries = Object.entries(source);
      for (let i = 0; i < entries.length; i++) {
        const [k, v] = entries[i];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) {
            target[k] = {};
          }
          deepMerge(target[k], v);
        } else {
          target[k] = v;
        }
      }
      return target;
    };

    const mergedMap = {};
    for (const { chunk } of validResults) {
      deepMerge(mergedMap, chunk);
    }

    const normalizedTree = normalizeTree(mergedMap);
    await indexTreeProgressive(normalizedTree);
    setDataRoot(normalizedTree);
    
    const nodeCount = countNodes(normalizedTree);
    setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
    logInfo(`Split dataset loaded with ${nodeCount} nodes`);
    
    const duration = performance.now() - startTime;
    logDebug(`Split loading completed in ${duration.toFixed(0)}ms`);
    return;
  }

  setProgress(0.98, 'Processing merged tree...');
  const normalizedTree = normalizeTree(mergedTree);
  await indexTreeProgressive(normalizedTree);
  setDataRoot(normalizedTree);

  const nodeCount = countNodes(normalizedTree);
  setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
  logInfo(`Split dataset loaded with ${nodeCount} nodes`);
  
  const duration = performance.now() - startTime;
  logDebug(`Split loading completed in ${duration.toFixed(0)}ms`);
}
