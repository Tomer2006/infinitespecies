/**
 * Eager data loading module
 *
 * Handles loading of pre-baked taxonomy datasets at application startup.
 * Uses pre-calculated layouts for optimal performance (no runtime D3 dependency).
 */

import { state, rebuildNodeMap, setTaxonomyData } from './state';
import { computeFetchConcurrency, perf } from './settings';
import { logInfo, logWarn, logError, logDebug } from './logger';
import { setProgress } from './loading';
import { updateNavigation } from './navigation';
import { decodePath, findNodeByPath } from './deeplink';
import { formatNumber, translate } from './i18n.ts';
import type { TaxonomyNode } from './types'

interface BakedFileInfo { filename: string }
interface BakedManifest {
  version: string | number
  files: BakedFileInfo[]
  layout_size: number
  total_nodes: number
  format?: string
}
type CompactBakedRow = [number | null, string, number | string, number, number, number]
interface ObjectBakedRow {
  id: number
  parent_id: number | null
  name: string
  level: number | string
  x: number
  y: number
  r: number
}
type BakedRow = CompactBakedRow | ObjectBakedRow
interface FileResult { index: number; chunk: BakedRow[]; fileInfo: BakedFileInfo }

const maxRetries = perf.loading.maxRetries;
const retryBaseDelayMs = perf.loading.retryBaseDelayMs;

// ============================================================================
// EAGER LOADING FUNCTIONS
// ============================================================================

// Eager loading: loads everything at once (using pre-baked layout data)
export async function loadEager(url: string): Promise<TaxonomyNode> {
  if (!url) throw new Error('No URL provided');

  state.loadMode = 'eager';
  logInfo(`Loading data eagerly from ${url}`);

  const baseUrl = url.replace(/[^/]*$/, '');

  // Load pre-baked layout data (required - no fallback to raw data)
  const bakedManifestUrl = url;
  logInfo(`Loading baked layout from ${bakedManifestUrl}`);

  const bakedManifestRes = await fetch(bakedManifestUrl, { cache: 'default', signal: AbortSignal.timeout(perf.loading.fetchTimeoutMs) });

  if (!bakedManifestRes.ok) {
    throw new Error(`Failed to fetch baked manifest at ${bakedManifestUrl} (${bakedManifestRes.status}). Run "node tools/bake-layout.js" to generate baked data.`);
  }

  const bakedManifest = await bakedManifestRes.json() as BakedManifest;

  if (!bakedManifest?.version || !Array.isArray(bakedManifest.files) || !bakedManifest.files.length ||
      bakedManifest.files.some(file => !file || typeof file.filename !== 'string' || !file.filename.trim()) ||
      !Number.isFinite(bakedManifest.layout_size) || bakedManifest.layout_size <= 0 ||
      !Number.isFinite(bakedManifest.total_nodes) || bakedManifest.total_nodes <= 0) {
    throw new Error('Invalid baked manifest: expected a version, nonempty file list, positive layout_size and total_nodes');
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
async function loadFromBakedFiles(baseUrl: string, manifest: BakedManifest): Promise<TaxonomyNode> {
  const startTime = performance.now();

  const totalFiles = manifest.files.length;
  const totalNodes = manifest.total_nodes;

  logInfo(`Loading pre-baked layout from ${baseUrl} (${totalFiles} files, ${totalNodes.toLocaleString()} nodes)`);

  // Stage 1: Loading Files
  setProgress(0, translate('data.loadingBakedFiles', { total: formatNumber(totalFiles) }), 1, 2);

  const concurrency = Math.max(computeFetchConcurrency(), 8);
  let completed = 0;
  let failed = 0;
  const results: Array<FileResult | undefined> = new Array(manifest.files.length);

  const loadFileWithRetry = async (fileInfo: BakedFileInfo, index: number, retryCount = 0): Promise<boolean> => {
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

      const chunk = await res.json() as BakedRow[];
      results[index] = { index, chunk, fileInfo };
      completed++;

      if (completed === totalFiles || completed % Math.max(1, Math.floor(totalFiles / 10)) === 0) {
        setProgress(
          completed / totalFiles,
          translate('data.loadedBakedFiles', { completed: formatNumber(completed), total: formatNumber(totalFiles) }),
          1,
          2,
        );
      }

      return true;
    } catch (err) {
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * retryBaseDelayMs;
        const message = err instanceof Error ? err.message : String(err)
        logWarn(`Retrying ${fileUrl} after error: ${message}`);
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
  await new Promise<void>((resolve) => {
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

  const validResults = results.filter((result): result is FileResult => result !== undefined);

  if (validResults.length === 0) {
    throw new Error(`Failed to load any baked files (${totalFiles} files attempted, ${failed} failed)`);
  }
  if (manifest.format === 'compact-rows-v1' && validResults.length !== totalFiles) {
    throw new Error(`Compact baked data requires every file (${validResults.length}/${totalFiles} loaded)`);
  }

  // Stage 2: Rehydrating tree
  setProgress(0, translate('data.rehydratingTree'), 2, 2);

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
  const flatNodes: BakedRow[] = new Array(totalSize);
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
  const root = rehydrateTree(flatNodes, manifest.format);

  // Set state
  state.useBakedLayout = true;

  // The renderer and picking operate directly on the data nodes (which already
  // carry _vx/_vy/_vr and children arrays), so no wrapper tree is needed.
  const layout = {
    root,
    diameter: manifest.layout_size || 4000
  };

  setTaxonomyData(root, layout, 'eager')

  // Build node map for navigation
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
        updateNavigation(root, false);
      }
    } else {
      updateNavigation(root, false);
    }
  } catch (err) {
    logError('Error during baked data deep link handling; falling back to root', err);
    if (state.DATA_ROOT) {
      updateNavigation(state.DATA_ROOT, false);
    }
  }

  setProgress(1, translate('data.loadedNodesWithLayout', { count: formatNumber(flatNodes.length) }), 2, 2);
  logInfo(`Baked layout loaded: ${flatNodes.length} nodes in ${(performance.now() - startTime).toFixed(0)}ms`);
  return root
}

/**
 * Rehydrate a tree structure from a flat array of baked nodes.
 * This is an O(N) operation using array-based parent lookup.
 *
 * @param {Array} flatNodes - Object rows or compact [parent_id, name, level, x, y, r] rows
 * @param {string} format - Manifest data format
 * @returns {Object} - Root node with children arrays and layout coordinates
 */
function readBakedRow(row: BakedRow, index: number, compact: boolean) {
  if (compact) {
    const compactRow = row as CompactBakedRow
    return {
      id: index + 1,
      parentId: compactRow[0],
      name: compactRow[1],
      level: compactRow[2],
      x: compactRow[3],
      y: compactRow[4],
      r: compactRow[5],
    }
  }
  const objectRow = row as ObjectBakedRow
  return {
    id: objectRow.id,
    parentId: objectRow.parent_id,
    name: objectRow.name,
    level: objectRow.level,
    x: objectRow.x,
    y: objectRow.y,
    r: objectRow.r,
  }
}

function rehydrateTree(flatNodes: BakedRow[], format?: string): TaxonomyNode {
  if (!flatNodes || flatNodes.length === 0) {
    throw new Error('Cannot rehydrate empty node array');
  }

  const nodeCount = flatNodes.length;
  const progressEvery = Math.max(1, Math.floor(nodeCount / 20));
  const compactRows = format === 'compact-rows-v1';

  // Pre-allocate node lookup by ID (array-based for speed, assuming IDs are sequential)
  const maxId = compactRows
    ? nodeCount
    : flatNodes.reduce((max, row, index) => Math.max(max, readBakedRow(row, index, false).id), 0);
  const nodeById: Array<TaxonomyNode | undefined> = new Array(maxId + 1);

  // First pass: create all nodes with their properties
  for (let i = 0; i < nodeCount; i++) {
    const data = readBakedRow(flatNodes[i], i, compactRows)
    const id = data.id;

    const node: TaxonomyNode = {
      name: data.name,
      level: data.level,
      children: [],
      parent: null,
      _id: id,
      _vx: data.x,
      _vy: data.y,
      _vr: data.r,
      _leaves: 0 // Will be computed in second pass
    };

    nodeById[id] = node;

    if (i > 0 && i % progressEvery === 0) {
      setProgress(
        0.3 * (i / nodeCount),
        translate('data.creatingNodes', { current: formatNumber(i), total: formatNumber(nodeCount) }),
        2,
        2,
      );
    }
  }

  // Find root (parent_id === null)
  let root: TaxonomyNode | null = null;

  // Second pass: link parents and children
  for (let i = 0; i < nodeCount; i++) {
    const data = readBakedRow(flatNodes[i], i, compactRows)
    const id = data.id;
    const parentId = data.parentId;
    const node = nodeById[id];
    if (!node) throw new Error(`Missing baked node ${id}`)

    if (parentId === null || parentId === undefined || parentId === 0) {
      root = node;
    } else {
      const parent = nodeById[parentId];
      if (parent) {
        node.parent = parent;
        parent.children.push(node);
      }
    }

    if (i > 0 && i % progressEvery === 0) {
      setProgress(
        0.3 + 0.4 * (i / nodeCount),
        translate('data.linkingNodes', { current: formatNumber(i), total: formatNumber(nodeCount) }),
        2,
        2,
      );
    }
  }

  if (!root) {
    throw new Error('No root node found in baked data (no node with parent_id === null)');
  }

  // Third pass: compute _leaves counts (bottom-up)
  computeLeavesCounts(root);

  setProgress(0.9, translate('data.finalizingTree'), 2, 2);

  // Update globalId to continue from max
  state.globalId = maxId + 1;

  logInfo(`Tree rehydrated: root="${root.name}", ${nodeCount} nodes`);

  return root;
}

/**
 * Compute _leaves counts for all nodes (iterative, bottom-up)
 */
function computeLeavesCounts(root: TaxonomyNode) {
  const stack: TaxonomyNode[] = [root];
  const post: TaxonomyNode[] = [];

  // Build post-order list
  while (stack.length) {
    const n = stack.pop()!;
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
