/**
 * Shared data loading and processing utilities
 *
 * Contains common functions used by data loading,
 * including tree normalization, progressive indexing, node counting,
 * and data structure manipulation utilities.
 */

import { state } from './state.js';
import { perf } from './settings.js';
import { logInfo, logError, logWarn } from './logger.js';
import { setProgress } from './loading.js';
import { updateNavigation } from './navigation.js';
import { decodePath, findNodeByPath } from './deeplink.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap } from './state.js';

// ============================================================================
// CORE DATA LOADING FUNCTIONS
// ============================================================================

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

export function countNodes(root) {
  let c = 0, stack = [root];
  while (stack.length) {
    const n = stack.pop();
    c++;
    const ch = Array.isArray(n.children) ? n.children : [];
    for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
  }
  return c;
}

function computeDescendantCountsIter(root) {
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
  const resetGlobalId = options.resetGlobalId !== false;
  const startParent = options.parent ?? null;
  const startDepth =
    typeof options.startDepth === 'number'
      ? options.startDepth
      : startParent && typeof startParent.level === 'number'
        ? startParent.level + 1
        : 0;
  const showProgress = options.showProgress ?? resetGlobalId;

  if (resetGlobalId) state.globalId = 1;
  else if (typeof state.globalId !== 'number' || !Number.isFinite(state.globalId) || state.globalId < 1) state.globalId = 1;

  const essentialKeys =
    options.essentialKeys instanceof Set
      ? options.essentialKeys
      : new Set([
        'name',
        'children',
        'level',
        'parent',
        '_id',
        '_vx',
        '_vy',
        '_vr',
        '_leaves',
        '_stub',
        '_chunkPath',
        '_chunkFile',
        '_loading'
      ]);

  let processed = 0;
  const total = Math.max(1, countNodes(root));
  const stack = [{ node: root, parent: startParent, depth: startDepth }];
  let lastYield = performance.now();
  const isHidden = () => document.hidden;

  while (stack.length) {
    const now = performance.now();
    if (!isHidden() && now - lastYield >= chunkMs) {
      await new Promise(r => setTimeout(r, 0));
      lastYield = performance.now();
    }
    const { node, parent, depth } = stack.pop();
    if (node == null || typeof node !== 'object') continue;

    node.name = String(node.name ?? 'Unnamed');
    if (node.name.length > 100) node.name = node.name.slice(0, 100);
    node.level = depth;
    node.parent = parent;

    node._id = state.globalId++;

    if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];

    // Optimized property cleanup: iterate once and collect keys to delete
    const keysToDelete = [];
    for (const k in node) {
      if (!essentialKeys.has(k) && Object.prototype.hasOwnProperty.call(node, k)) {
        keysToDelete.push(k);
      }
    }
    for (let i = 0; i < keysToDelete.length; i++) {
      delete node[keysToDelete[i]];
    }

    if (node.children.length === 0) {
      node.children = [];
    }
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push({ node: node.children[i], parent: node, depth: depth + 1 });
    }
    processed++;
    if (showProgress && processed % progressEvery === 0) {
      if (!isHidden()) {
        setProgress(processed / total, `Indexing... ${processed.toLocaleString()}/${total.toLocaleString()}`, 2, 3);
      }
    }
  }
  // State 3: Finalizing (0% → 100%)
  if (showProgress && !isHidden()) setProgress(0, 'Finalizing...', 3, 3);
  computeDescendantCountsIter(root);
  if (showProgress && !isHidden()) setProgress(1, 'Done', 3, 3);
  return processed; // Return node count for caller
}

export async function loadFromJSONText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    logError('Invalid JSON during loadFromJSONText', e);
    throw new Error('Invalid JSON: ' + e.message);
  }
  const nroot = normalizeTree(parsed);
  await indexTreeProgressive(nroot);
  setDataRoot(nroot);
  logInfo('JSON data loaded successfully, initialized root');
}

export function setDataRoot(root) {
  state.DATA_ROOT = root;

  // Validate root exists before proceeding
  if (!root) {
    logError('setDataRoot called with null/undefined root');
    return;
  }

  // Pre-calculate global layout for eager mode to enable O(1) navigation
  if (state.loadMode === 'eager') {
    logInfo('Pre-computing global layout for eager mode...');
    const globalLayout = layoutFor(root);
    if (globalLayout) {
      state.rootLayout = globalLayout;
      // Set as current layout temporarily to build the map
      state.layout = globalLayout;
      rebuildNodeMap();
      logInfo('Global layout computed and node map built.');
    }
  }

  try {
    const rawHash = location.hash ? location.hash.slice(1) : '';
    const decoded = decodePath(rawHash);

    if (decoded) {
      logInfo(`Deep link detected on data init: "${decoded}" – attempting to navigate to path`);
      findNodeByPath(decoded)
        .then(node => {
          // Double-check DATA_ROOT is still valid (could have been cleared)
          if (!state.DATA_ROOT) {
            logWarn('DATA_ROOT became null during deep link resolution, skipping navigation');
            return;
          }
          if (node) {
            updateNavigation(node, false);
          } else {
            logWarn(`Deep link path not found: "${decoded}", falling back to root`);
            if (state.DATA_ROOT) {
              updateNavigation(state.DATA_ROOT, false);
            }
          }
        })
        .catch(err => {
          logError('Error resolving deep link path; falling back to root', err);
          if (state.DATA_ROOT) {
            updateNavigation(state.DATA_ROOT, false);
          }
        });
    } else {
      updateNavigation(state.DATA_ROOT, false);
    }
  } catch (err) {
    logError('Error during setDataRoot deep link handling; falling back to root', err);
    if (state.DATA_ROOT) {
      updateNavigation(state.DATA_ROOT, false);
    }
  }
}

