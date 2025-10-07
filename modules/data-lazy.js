// Lazy loading functionality separated from regular data loading
import { state } from './state.js';
import { mapToChildren, normalizeTree, indexTreeProgressive, setDataRoot, jumpToPreferredStart } from './data.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';

// Lazy loading functions
export function isLazyNode(node) {
  return node && typeof node === 'object' && node.lazy === true && typeof node.id === 'string';
}

// Check if a node should auto-load based on screen size
export function shouldAutoLoad(node) {
  if (!isLazyNode(node) || state.loadMode === 'eager') return false;

  const d = state.nodeLayoutMap.get(node._id);
  if (!d) return false;

  // Calculate screen radius
  const screenRadius = d._vr * state.camera.k;
  return screenRadius >= state.autoLoadThreshold;
}

export async function loadSubtree(node) {
  if (!isLazyNode(node)) {
    logWarn(`loadSubtree called on non-lazy node ${node?.name || 'unknown'}`);
    return;
  }

  const cacheKey = node.id;
  if (state.subtreeCache.has(cacheKey)) {
    // Use cached subtree
    logInfo(`Using cached subtree for ${node.name}`);
    const cachedChildren = state.subtreeCache.get(cacheKey);
    node.children = cachedChildren;
    node.lazy = false; // Mark as geladen
    return;
  }

  try {
    const fetchUrl = state.dataBaseUrl ? `${state.dataBaseUrl}${cacheKey}` : `data/${cacheKey}`;
    logInfo(`Fetching lazy subtree for ${node.name} from ${fetchUrl}`);
    const res = await fetch(fetchUrl, { cache: 'default' });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${cacheKey} (${res.status})`);
    }

    const subtreeData = await res.json();
    let children = [];

    // Handle different subtree formats
    if (Array.isArray(subtreeData)) {
      children = subtreeData;
    } else if (subtreeData && typeof subtreeData === 'object') {
      if (subtreeData.children && Array.isArray(subtreeData.children)) {
        children = subtreeData.children;
      } else {
        // Handle nested object format
        children = mapToChildren(subtreeData);
      }
    }

    // Normalize children (add levels, ensure proper structure)
    children.forEach((child, index) => {
      if (!child || typeof child !== 'object') {
        logWarn(`Invalid child at index ${index} in ${cacheKey}`);
        return;
      }
      child.level = (node.level || 0) + 1;
      child.parent = node;
      if (!Array.isArray(child.children)) {
        child.children = child.children ? [].concat(child.children) : [];
      }
    });

    // Cache the loaded children
    state.subtreeCache.set(cacheKey, children);
    node.children = children;
    node.lazy = false; // Mark as loaded

    logInfo(`Loaded ${children.length} children for ${node.name}`);

    // Re-index the tree since we added new nodes
    await indexTreeProgressive(state.DATA_ROOT);
    logDebug('Reindexed tree after lazy load');

  } catch (error) {
    logError(`Failed to load subtree ${cacheKey}`, error);
    // Mark node as having failed loading
    node.lazy = 'error';
    // Keep empty children array to prevent further attempts
    node.children = [];
    throw error;
  }
}

export async function loadFromLazyManifest(baseUrl, manifest, mode) {
  logInfo(`Initializing dataset from lazy manifest at ${baseUrl}`);

  // Store dataset metadata
  state.dataBaseUrl = baseUrl;
  state.loadMode = mode;

  // Normalize the manifest root
  const nroot = normalizeTree(manifest);

  // Index the root structure (without loading lazy children)
  await indexTreeProgressive(nroot);

  setDataRoot(nroot);

  // Jump to preferred start if applicable
  await jumpToPreferredStart();

  logInfo('Lazy manifest loaded, ready for on-demand subtree loading');
}

const autoLoadInProgress = new Set();

export function requestAutoLoad() {
  if (!state.layout?.root || state.loadMode === 'eager') {
    logDebug('Auto-load skipped: either no layout or eager mode.');
    return [];
  }

  const actions = [];
  const maxConcurrent = 2;
  let initiated = 0;

  for (const d of state.layout.root.descendants()) {
    const node = d.data;
    if (!isLazyNode(node)) continue;

    if (autoLoadInProgress.has(node._id)) {
      actions.push({ node, status: 'pending' });
      continue;
    }

    if (shouldAutoLoad(node) && initiated < maxConcurrent) {
      logInfo(`Auto-load triggered by zoom for ${node.name}`);
      autoLoadInProgress.add(node._id);
      initiated++;
      actions.push({ node, status: 'loading' });
      loadSubtree(node)
        .catch(err => {
          logWarn(`Auto-load failed for ${node.name}: ${err.message}`);
        })
        .finally(() => {
          autoLoadInProgress.delete(node._id);
        });
    }
  }

  if (!actions.length) {
    logDebug('Auto-load check completed with no qualifying nodes.');
  }

  return actions;
}

