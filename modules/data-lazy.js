// Lazy loading functionality for taxonomy tree data

import {
  state
} from './state.js';

import {
  perf
} from './settings.js';

import {
  logInfo,
  logWarn,
  logError,
  logDebug
} from './logger.js';

import {
  setProgress,
  showLoading
} from './loading.js';

import {
  updateNavigation
} from './navigation.js';

import {
  indexTreeProgressive,
  setDataRoot
} from './data-common.js';

import {
  nodeInView
} from './picking.js'; // Import visibility check

import {
  requestRender
} from './canvas.js';

let autoLoadEnabled = false;
let viewportCheckTimer = null;

// ============================================================================
// LAZY LOADING FUNCTIONS
// ============================================================================

/**
 * Loads the initial skeleton of the tree.
 * @param {string} baseUrl - The path to the lazy data directory (e.g., 'data lazy')
 */
export async function loadLazy(baseUrl) {
  state.loadMode = 'lazy';
  state.lazyBaseUrl = baseUrl;
  logInfo(`Loading data lazily from ${baseUrl}`);

  showLoading('Loading tree skeleton...');
  setProgress(0.1, 'Fetching root skeleton...');

  try {
    const skeletonUrl = `${baseUrl}/root.json`;
    const res = await fetch(skeletonUrl, {
      cache: 'default'
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch skeleton ${skeletonUrl} (${res.status})`);
    }

    const root = await res.json();
    logDebug('Root skeleton fetched, indexing...');

    setProgress(0.5, 'Indexing skeleton...');

    // Index the skeleton
    await indexTreeProgressive(root, {
      showProgress: true
    });

    // Set the skeleton as the main data root
    setDataRoot(root);

    logInfo('Lazy data skeleton loaded and initialized.');

  } catch (err) {
    logError('Failed to load lazy data skeleton', err);
    // Let the landing page logic handle the error display
    throw err;
  }
}

/**
 * Checks if a node is a "stub" that needs to be loaded.
 * @param {object} node - The node to check
 * @returns {boolean}
 */
export function isStubNode(node) {
  return node && node._stub === true;
}

/**
 * Enables the auto-loading system.
 */
export function startAutoLoading() {
  logDebug('Enabling viewport-based lazy loading.');
  autoLoadEnabled = true;
  // Kick off an initial check
  onViewportChange();
}

/**
 * Triggers a viewport check. This is debounced to avoid
 * running on every single frame of animation.
 */
export function onViewportChange() {
  if (!autoLoadEnabled) return;

  // Clear the existing timer
  if (viewportCheckTimer) {
    clearTimeout(viewportCheckTimer);
  }

  // Set a new timer
  viewportCheckTimer = setTimeout(() => {
    autoLoadVisibleChunks();
    viewportCheckTimer = null;
  }, 150); // 150ms debounce
}

/**
 * Scans the viewport for visible stub nodes and loads them.
 */
export async function autoLoadVisibleChunks() {
  if (!autoLoadEnabled || !state.layout || !state.layout.root) return;

  logDebug('Running viewport check for lazy load...');

  const visibleStubs = new Set();

  // We must iterate over the layout nodes (d) to check visibility
  const descendants = state.layout.root.descendants();

  for (const d of descendants) {
    const node = d.data;

    // Check if it's a stub, not already loading, and visible
    if (isStubNode(node) && !node._loading && nodeInView(d)) {
      visibleStubs.add(node);
    }
  }

  if (visibleStubs.size > 0) {
    logInfo(`Viewport check found ${visibleStubs.size} new stubs to load.`);

    // Load all visible stubs in parallel
    const promises = [];
    for (const node of visibleStubs) {
      promises.push(loadChunk(node));
    }

    await Promise.all(promises);

    // After loading, the tree structure has changed.
    // We must re-calculate the layout and re-render.
    logDebug('Chunks loaded, triggering layout update...');

    // A full updateNavigation is the most robust way to ensure
    // the layout map and all states are correct.
    await updateNavigation(state.current, false); // false = don't animate camera
    requestRender();

  } else {
    logDebug('Viewport check complete, no new stubs found.');
  }
}

/**
 * Loads the data for a single stub node and "stitches" it into the tree.
 * @param {object} node - The stub node to load
 */
export async function loadChunk(node) {
  if (!isStubNode(node) || node._loading) return;

  node._loading = true;
  const chunkFile = node._chunkFile;
  const url = `${state.lazyBaseUrl}/${chunkFile}`;

  logDebug(`Loading chunk for "${node.name}" from ${url}`);

  try {
    const res = await fetch(url, {
      cache: 'default'
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch chunk ${chunkFile} (${res.status})`);
    }

    const chunkChildren = await res.json(); // This is an array of children

    if (!Array.isArray(chunkChildren)) {
      throw new Error(`Chunk data is not an array: ${chunkFile}`);
    }

    // Create a temporary root to process all new nodes at once.
    // This is much faster than indexing them one by one.
    const tempRoot = {
      name: 'temp',
      children: chunkChildren
    };

    // Index the new nodes, correctly setting their parent and depth
    await indexTreeProgressive(tempRoot, {
      parent: node, // Set the parent
      startDepth: node.level + 1, // Start at the correct depth
      resetGlobalId: false, // Continue IDs from the skeleton
      showProgress: false, // Don't show loading bar for chunks
    });

    // "Stitch" the new, indexed children into the tree
    delete node._stub;
    delete node._chunkFile;
    delete node._loading; // No longer loading
    node.children = tempRoot.children; // Attach the processed children

    logDebug(`Successfully loaded and stitched ${chunkChildren.length} children for "${node.name}"`);

  } catch (err) {
    logError(`Failed to load chunk for node "${node.name}"`, err);
    node._loading = false; // Allow retrying
  }
}
