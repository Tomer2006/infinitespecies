/**
 * Eager data loading module
 *
 * Handles loading of pre-baked taxonomy datasets at application startup.
 * Uses pre-calculated layouts for optimal performance (no runtime D3 dependency).
 */

import { state, rebuildNodeMap } from './state.js';
import { computeFetchConcurrency, perf } from './settings.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { setProgress } from './loading.js';
import { updateNavigation } from './navigation.js';
import { decodePath, findNodeByPath } from './deeplink.js';

const maxRetries = perf.loading.maxRetries;
const retryBaseDelayMs = perf.loading.retryBaseDelayMs;

// ============================================================================
// EAGER LOADING FUNCTIONS
// ============================================================================

// Eager loading: loads everything at once (using pre-baked layout data)
export async function loadEager(url) {
  if (!url) throw new Error('No URL provided');

  state.loadMode = 'eager';
  logInfo(`Loading data eagerly from ${url}`);

  const baseUrl = url.replace(/[^/]*$/, '');

  // Load pre-baked layout data (required - no fallback to raw data)
  const bakedManifestUrl = baseUrl + 'tree_baked_manifest.json';
  logInfo(`Loading baked layout from ${bakedManifestUrl}`);

  const bakedManifestRes = await fetch(bakedManifestUrl, { cache: 'default' });

  if (!bakedManifestRes.ok) {
    throw new Error(`Failed to fetch baked manifest at ${bakedManifestUrl} (${bakedManifestRes.status}). Run "node tools/bake-layout.js" to generate baked data.`);
  }

  const bakedManifest = await bakedManifestRes.json();

  if (!bakedManifest.version || !bakedManifest.files || !bakedManifest.layout_size) {
    throw new Error('Invalid baked manifest: missing required fields (version, files, layout_size)');
  }

  logInfo('Pre-baked layout manifest loaded, using optimized data path');
  return await loadFromBakedFiles(baseUrl, bakedManifest);
}

// ============================================================================
// BAKED DATA LOADING (Pre-calculated layout)
// ============================================================================

/**
 * Load pre-baked layout data from split files
 * This is the optimized path that skips D3 layout calculation
 *
 * @param {string} baseUrl - Base URL for data files
 * @param {Object} manifest - Baked manifest with file list
 */
async function loadFromBakedFiles(baseUrl, manifest) {
  const startTime = performance.now();

  const totalFiles = manifest.files.length;
  const totalNodes = manifest.total_nodes;

  logInfo(`Loading pre-baked layout from ${baseUrl} (${totalFiles} files, ${totalNodes.toLocaleString()} nodes)`);

  // Stage 1: Loading Files
  setProgress(0, `Loading ${totalFiles} baked files...`, 1, 2);

  const concurrency = Math.max(computeFetchConcurrency(), 8);
  let completed = 0;
  let failed = 0;
  const results = new Array(manifest.files.length);

  const loadFileWithRetry = async (fileInfo, index, retryCount = 0) => {
    const fileUrl = baseUrl + fileInfo.filename;

    try {
      if (retryCount > 0) {
        logDebug(`Fetching baked file ${fileUrl} (attempt ${retryCount + 1})`);
      }

      const res = await fetch(fileUrl, {
        cache: 'default',
        signal: AbortSignal.timeout(perf.loading.fetchTimeoutMs)
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);
      }

      const chunk = await res.json();
      results[index] = { index, chunk, fileInfo };
      completed++;

      if (completed === totalFiles || completed % Math.max(1, Math.floor(totalFiles / 10)) === 0) {
        setProgress(completed / totalFiles, `Loaded ${completed}/${totalFiles} baked files...`, 1, 2);
      }

      return true;
    } catch (err) {
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * retryBaseDelayMs;
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

  // Parallel loading
  let resolved = false;
  await new Promise((resolve) => {
    let inFlight = 0;
    let nextIndex = 0;

    const checkCompletion = () => {
      if (resolved) return;
      if (completed + failed === totalFiles) {
        resolved = true;
        resolve();
      }
    };

    const startNext = () => {
      while (inFlight < concurrency && nextIndex < manifest.files.length) {
        const i = nextIndex++;
        inFlight++;
        loadFileWithRetry(manifest.files[i], i).finally(() => {
          inFlight--;
          checkCompletion();
          if (!resolved) startNext();
        });
      }
    };

    startNext();
  });

  const validResults = results.filter(r => r !== undefined);

  if (validResults.length === 0) {
    throw new Error(`Failed to load any baked files (${totalFiles} files attempted, ${failed} failed)`);
  }

  // Stage 2: Rehydrating tree
  setProgress(0, 'Rehydrating tree structure...', 2, 2);

  // Sort by index and merge all arrays
  validResults.sort((a, b) => a.index - b.index);

  // Pre-calculate total size for array pre-allocation
  let totalSize = 0;
  for (const { chunk } of validResults) {
    if (Array.isArray(chunk)) {
      totalSize += chunk.length;
    }
  }

  // Pre-allocate and copy (avoids stack overflow from spread operator with millions of elements)
  const flatNodes = new Array(totalSize);
  let offset = 0;
  for (const { chunk } of validResults) {
    if (Array.isArray(chunk)) {
      for (let i = 0; i < chunk.length; i++) {
        flatNodes[offset++] = chunk[i];
      }
    }
  }

  logInfo(`Rehydrating ${flatNodes.length.toLocaleString()} nodes from baked data`);

  // O(N) rehydration: build tree from flat array
  const root = await rehydrateTree(flatNodes);

  // Set state
  state.DATA_ROOT = root;
  state.useBakedLayout = true;

  // Create D3-compatible layout structure for the renderer
  // The renderer expects state.layout.root to have .descendants() method
  const hierarchyRoot = createHierarchyWrapper(root);
  const layout = {
    root: hierarchyRoot,
    diameter: manifest.layout_size || 4000
  };

  state.layout = layout;
  state.rootLayout = layout;

  // Build node map for navigation (uses the hierarchy wrapper)
  rebuildNodeMap();

  // Handle deep links and navigation
  try {
    const rawHash = location.hash ? location.hash.slice(1) : '';
    const decoded = decodePath(rawHash);

    if (decoded) {
      logInfo(`Deep link detected on baked data init: "${decoded}"`);
      const node = await findNodeByPath(decoded);
      if (node) {
        updateNavigation(node, false);
      } else {
        logWarn(`Deep link path not found: "${decoded}", falling back to root`);
        updateNavigation(state.DATA_ROOT, false);
      }
    } else {
      updateNavigation(state.DATA_ROOT, false);
    }
  } catch (err) {
    logError('Error during baked data deep link handling; falling back to root', err);
    if (state.DATA_ROOT) {
      updateNavigation(state.DATA_ROOT, false);
    }
  }

  setProgress(1, `Loaded ${flatNodes.length.toLocaleString()} nodes with pre-baked layout`, 2, 2);
  logInfo(`Baked layout loaded: ${flatNodes.length} nodes in ${(performance.now() - startTime).toFixed(0)}ms`);
}

/**
 * Create a D3-compatible hierarchy wrapper around our tree nodes.
 * This allows the existing renderer code to work unchanged.
 *
 * @param {Object} root - Root data node
 * @returns {Object} - Pseudo-D3 hierarchy node with descendants() method
 */
function createHierarchyWrapper(root) {
  // Cache for descendants
  let cachedDescendants = null;

  function wrapNode(dataNode, parent = null) {
    const wrapped = {
      data: dataNode,
      depth: dataNode.level,
      parent: parent,
      children: null,
      // Copy layout coordinates directly
      _vx: dataNode._vx,
      _vy: dataNode._vy,
      _vr: dataNode._vr,
      // D3 hierarchy compatibility
      value: dataNode._leaves || 1,
      height: 0 // Will be set later if needed
    };

    // Wrap children
    if (dataNode.children && dataNode.children.length > 0) {
      wrapped.children = dataNode.children.map(child => wrapNode(child, wrapped));
    }

    return wrapped;
  }

  const hierarchyRoot = wrapNode(root);

  // Add descendants() method
  hierarchyRoot.descendants = function () {
    if (cachedDescendants) return cachedDescendants;

    const result = [];
    const stack = [this];

    while (stack.length) {
      const node = stack.pop();
      result.push(node);
      if (node.children) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }

    cachedDescendants = result;
    return result;
  };

  // Add each() method for D3 compatibility
  hierarchyRoot.each = function (callback) {
    const desc = this.descendants();
    for (let i = 0; i < desc.length; i++) {
      callback(desc[i]);
    }
    return this;
  };

  // Propagate descendants() method to all nodes
  const allNodes = hierarchyRoot.descendants();
  for (const node of allNodes) {
    if (node !== hierarchyRoot) {
      node.descendants = function () {
        const result = [];
        const stack = [this];
        while (stack.length) {
          const n = stack.pop();
          result.push(n);
          if (n.children) {
            for (let i = n.children.length - 1; i >= 0; i--) {
              stack.push(n.children[i]);
            }
          }
        }
        return result;
      };
      node.each = function (callback) {
        const desc = this.descendants();
        for (let i = 0; i < desc.length; i++) {
          callback(desc[i]);
        }
        return this;
      };
    }
  }

  logDebug(`Created hierarchy wrapper with ${allNodes.length} nodes`);

  return hierarchyRoot;
}

/**
 * Rehydrate a tree structure from a flat array of baked nodes.
 * This is an O(N) operation using array-based parent lookup.
 *
 * @param {Array} flatNodes - Array of {id, parent_id, name, level, x, y, r}
 * @returns {Promise<Object>} - Root node with children arrays and layout coordinates
 */
async function rehydrateTree(flatNodes) {
  if (!flatNodes || flatNodes.length === 0) {
    throw new Error('Cannot rehydrate empty node array');
  }

  const nodeCount = flatNodes.length;
  const progressEvery = perf.indexing.progressEvery || 1000;
  const chunkMs = perf.indexing.chunkMs || 20;

  // Pre-allocate node lookup by ID (array-based for speed, assuming IDs are sequential)
  const maxId = flatNodes.reduce((max, n) => Math.max(max, n.id), 0);
  const nodeById = new Array(maxId + 1);

  let lastYield = performance.now();

  // First pass: create all nodes with their properties
  for (let i = 0; i < nodeCount; i++) {
    const fn = flatNodes[i];

    const node = {
      name: fn.name,
      level: fn.level,
      children: [],
      parent: null,
      _id: fn.id,
      _vx: fn.x,
      _vy: fn.y,
      _vr: fn.r,
      _leaves: 0 // Will be computed in second pass
    };

    nodeById[fn.id] = node;

    if (i % progressEvery === 0) {
      if (performance.now() - lastYield > chunkMs) {
        await new Promise(resolve => setTimeout(resolve, 0));
        lastYield = performance.now();
      }
      if (i > 0) {
        setProgress(0.3 * (i / nodeCount), `Creating nodes... ${i.toLocaleString()}/${nodeCount.toLocaleString()}`, 2, 2);
      }
    }
  }

  // Find root (parent_id === null)
  let root = null;

  // Second pass: link parents and children
  for (let i = 0; i < nodeCount; i++) {
    const fn = flatNodes[i];
    const node = nodeById[fn.id];

    if (fn.parent_id === null || fn.parent_id === undefined) {
      root = node;
    } else {
      const parent = nodeById[fn.parent_id];
      if (parent) {
        node.parent = parent;
        parent.children.push(node);
      }
    }

    if (i % progressEvery === 0) {
      if (performance.now() - lastYield > chunkMs) {
        await new Promise(resolve => setTimeout(resolve, 0));
        lastYield = performance.now();
      }
      if (i > 0) {
        setProgress(0.3 + 0.4 * (i / nodeCount), `Linking nodes... ${i.toLocaleString()}/${nodeCount.toLocaleString()}`, 2, 2);
      }
    }
  }

  if (!root) {
    throw new Error('No root node found in baked data (no node with parent_id === null)');
  }

  // Third pass: compute _leaves counts (bottom-up)
  await computeLeavesCounts(root);

  setProgress(0.9, 'Finalizing tree structure...', 2, 2);

  // Update globalId to continue from max
  state.globalId = maxId + 1;

  logInfo(`Tree rehydrated: root="${root.name}", ${nodeCount} nodes`);

  return root;
}

/**
 * Compute _leaves counts for all nodes (iterative, bottom-up)
 */
async function computeLeavesCounts(root) {
  const chunkMs = perf.indexing.chunkMs || 20;
  let lastYield = performance.now();
  let ops = 0;
  const checkInterval = 1000;

  const stack = [root];
  const post = [];

  // Build post-order list
  while (stack.length) {
    const n = stack.pop();
    post.push(n);
    const ch = n.children;
    for (let i = 0; i < ch.length; i++) {
      stack.push(ch[i]);
    }

    ops++;
    if (ops % checkInterval === 0 && performance.now() - lastYield > chunkMs) {
      await new Promise(resolve => setTimeout(resolve, 0));
      lastYield = performance.now();
    }
  }

  // Process in reverse (leaves first)
  for (let i = post.length - 1; i >= 0; i--) {
    const n = post[i];
    const ch = n.children;
    if (ch.length === 0) {
      n._leaves = 1;
    } else {
      let sum = 0;
      for (let j = 0; j < ch.length; j++) {
        sum += ch[j]._leaves || 1;
      }
      n._leaves = sum;
    }

    if (i % checkInterval === 0 && performance.now() - lastYield > chunkMs) {
      await new Promise(resolve => setTimeout(resolve, 0));
      lastYield = performance.now();
    }
  }
}