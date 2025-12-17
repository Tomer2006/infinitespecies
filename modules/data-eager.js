/**
 * Eager data loading module
 *
 * Handles loading of complete taxonomy datasets at application startup.
 * Supports both single JSON files and split-file manifests with parallel
 * downloading and retry logic for reliability.
 */

import { state, rebuildNodeMap } from './state.js';
import { computeFetchConcurrency, perf } from './settings.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { setProgress } from './loading.js';
import { updateNavigation } from './navigation.js';
import { decodePath, findNodeByPath } from './deeplink.js';
import { mapToChildren, normalizeTree, indexTreeProgressive, loadFromJSONText, setDataRoot, countNodes } from './data-common.js';


/**
 * Detects file format from URL or filename
 * @param {string} url - File URL or filename
 * @returns {'json'|'unknown'}
 */
function detectFileFormat(url) {
  const lower = url.toLowerCase();
  if (lower.endsWith('.json')) {
    return 'json';
  }
  return 'unknown';
}

/**
 * Parses JSON data from response
 * @param {Response} res - Fetch response
 * @returns {Promise<any>}
 */
async function parseDataResponse(res) {
  return res.json();
}

const maxRetries = perf.loading.maxRetries;
const retryBaseDelayMs = perf.loading.retryBaseDelayMs;

// ============================================================================
// EAGER LOADING FUNCTIONS
// ============================================================================

// Eager loading: loads everything at once
export async function loadEager(url) {
  if (!url) throw new Error('No URL provided');

  state.loadMode = 'eager';
  logInfo(`Loading data eagerly from ${url}`);;

  const baseUrl = url.replace(/[^/]*$/, '');

  // First, try to load pre-baked layout data
  const bakedManifestUrl = baseUrl + 'tree_baked_manifest.json';
  try {
    logDebug(`Checking for baked layout at ${bakedManifestUrl}`);
    const bakedManifestRes = await fetch(bakedManifestUrl, { cache: 'default' });

    if (bakedManifestRes.ok) {
      const bakedManifest = await bakedManifestRes.json();
      if (bakedManifest.version && bakedManifest.files && bakedManifest.layout_size) {
        logInfo('Pre-baked layout manifest detected, loading optimized data');
        return await loadFromBakedFiles(baseUrl, bakedManifest);
      }
    } else {
      logDebug(`No baked manifest found at ${bakedManifestUrl}`);
    }
  } catch (e) {
    logWarn(`Baked manifest fetch failed at ${bakedManifestUrl}: ${e.message}`);
  }

  // Check if this is a split dataset by looking for manifest.json
  const manifestUrl = baseUrl + 'manifest.json';

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

  // Validate manifest structure
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid manifest: must be an object');
  }

  if (!Array.isArray(manifest.files)) {
    if (manifest.total_files && manifest.total_files > 0) {
      throw new Error(`Invalid manifest: files array is missing but total_files is ${manifest.total_files}. Manifest must include a 'files' array.`);
    }
    throw new Error('Invalid manifest: missing required "files" array');
  }

  if (manifest.files.length === 0) {
    throw new Error('Invalid manifest: files array is empty');
  }

  const totalFiles = manifest.files.length;

  logInfo(`Loading split dataset from ${baseUrl} (${totalFiles} files)`);

  // State 1: Loading Files (0% → 100%)
  setProgress(0, `Loading ${totalFiles} split files...`, 1, 2);

  const concurrency = Math.max(computeFetchConcurrency(), 8);
  let completed = 0;
  let failed = 0;
  const results = new Array(manifest.files.length);
  const progressUpdateInterval = Math.max(1, Math.floor(totalFiles / 20));

  // Pre-format total for progress messages to avoid repeated toLocaleString calls
  const totalFormatted = totalFiles.toLocaleString();

  const loadFileWithRetry = async (fileInfo, index, retryCount = 0) => {
    const fileUrl = baseUrl + fileInfo.filename;
    const format = detectFileFormat(fileInfo.filename);

    try {
      if (retryCount > 0) {
        logDebug(`Fetching split file ${fileUrl} (attempt ${retryCount + 1})`);
      }

      const res = await fetch(fileUrl, {
        cache: 'default',
        signal: AbortSignal.timeout(perf.loading.fetchTimeoutMs)
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);
      }

      const chunk = await parseDataResponse(res, format);
      results[index] = { index, chunk, fileInfo };
      completed++;

      if (completed % progressUpdateInterval === 0 || completed === totalFiles) {
        setProgress(completed / totalFiles, `Loaded ${completed}/${totalFormatted} files...`, 1, 2);
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

  // Parallel loading with controlled concurrency
  // Use atomic counter to prevent race conditions
  let resolved = false;
  await new Promise((resolve) => {
    let inFlight = 0;
    let nextIndex = 0;

    const checkCompletion = () => {
      // Use atomic check to prevent race conditions
      if (resolved) return;
      if (completed + failed === totalFiles) {
        resolved = true;
        if (failed > 0) {
          logWarn(`Completed loading with ${failed} failed files out of ${totalFiles}`);
        }
        resolve();
      }
    };

    const startNext = () => {
      while (inFlight < concurrency && nextIndex < manifest.files.length) {
        const i = nextIndex++;
        inFlight++;
        const fileInfo = manifest.files[i];

        loadFileWithRetry(fileInfo, i).finally(() => {
          inFlight--;
          checkCompletion();
          if (!resolved) {
            startNext();
          }
        });
      }
    };

    startNext();
  });

  const validResults = results.filter(r => r !== undefined);

  // Check if we have any valid results before proceeding
  if (validResults.length === 0) {
    const errorMsg = `Failed to load any files from split dataset (${totalFiles} files attempted, ${failed} failed)`;
    logError(errorMsg);
    throw new Error(errorMsg);
  }

  logInfo(`Merging ${validResults.length} loaded split files`);

  // State 2: Processing & Indexing (0% → 100%)
  // Progress starts with indexing phase

  // Sort by index to maintain order
  validResults.sort((a, b) => a.index - b.index);

  // Determine schema type: structured nodes vs nested map
  const hasOwnProperty = Object.prototype.hasOwnProperty;
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

    // Optimized deep merge: minimize allocations, avoid Object.entries
    const deepMerge = (target, source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
      for (const k in source) {
        if (!Object.prototype.hasOwnProperty.call(source, k)) continue;
        const v = source[k];
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
    const nodeCount = await indexTreeProgressive(normalizedTree);
    setDataRoot(normalizedTree);

    setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`, 2, 2);
    logInfo(`Split dataset loaded with ${nodeCount} nodes`);

    const duration = performance.now() - startTime;
    logDebug(`Split loading completed in ${duration.toFixed(0)}ms`);
    return;
  }

  // Processing merged tree happens during indexing phase
  const normalizedTree = normalizeTree(mergedTree);
  const nodeCount = await indexTreeProgressive(normalizedTree);
  setDataRoot(normalizedTree);

  setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`, 2, 2);
  logInfo(`Split dataset loaded with ${nodeCount} nodes`);

  const duration = performance.now() - startTime;
  logDebug(`Split loading completed in ${duration.toFixed(0)}ms`);
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

  const flatNodes = [];
  for (const { chunk } of validResults) {
    if (Array.isArray(chunk)) {
      flatNodes.push(...chunk);
    }
  }

  logInfo(`Rehydrating ${flatNodes.length.toLocaleString()} nodes from baked data`);

  // O(N) rehydration: build tree from flat array
  const root = rehydrateTree(flatNodes);

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
 * @returns {Object} - Root node with children arrays and layout coordinates
 */
function rehydrateTree(flatNodes) {
  if (!flatNodes || flatNodes.length === 0) {
    throw new Error('Cannot rehydrate empty node array');
  }

  const nodeCount = flatNodes.length;
  const progressEvery = Math.max(1, Math.floor(nodeCount / 20));

  // Pre-allocate node lookup by ID (array-based for speed, assuming IDs are sequential)
  const maxId = flatNodes.reduce((max, n) => Math.max(max, n.id), 0);
  const nodeById = new Array(maxId + 1);

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

    if (i > 0 && i % progressEvery === 0) {
      setProgress(0.3 * (i / nodeCount), `Creating nodes... ${i.toLocaleString()}/${nodeCount.toLocaleString()}`, 2, 2);
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

    if (i > 0 && i % progressEvery === 0) {
      setProgress(0.3 + 0.4 * (i / nodeCount), `Linking nodes... ${i.toLocaleString()}/${nodeCount.toLocaleString()}`, 2, 2);
    }
  }

  if (!root) {
    throw new Error('No root node found in baked data (no node with parent_id === null)');
  }

  // Third pass: compute _leaves counts (bottom-up)
  computeLeavesCounts(root);

  setProgress(0.9, 'Finalizing tree structure...', 2, 2);

  // Update globalId to continue from max
  state.globalId = maxId + 1;

  logInfo(`Tree rehydrated: root="${root.name}", ${nodeCount} nodes`);

  return root;
}

/**
 * Compute _leaves counts for all nodes (iterative, bottom-up)
 */
function computeLeavesCounts(root) {
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
  }
}