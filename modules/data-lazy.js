// data-lazy-hybrid.js
// Hybrid lazy loading: same data as eager, loaded on-demand with intelligent preloading

import { state } from './state.js';
import { perf } from './performance.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { setProgress } from './loading.js';
import { updateNavigation } from './navigation.js';
import { computeFetchConcurrency } from './performance.js';
import { W, H } from './canvas.js';

// ============================================================================
// CORE DATA LOADING FUNCTIONS (shared with eager)
// ============================================================================

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

export function isStubNode(node) {
  return node && node._stub === true;
}

function composePath(parentPath, name) {
  const trimmedName = String(name ?? '').trim();
  if (!trimmedName) return parentPath || '';
  return parentPath ? `${parentPath} > ${trimmedName}` : trimmedName;
}

function buildLazyChunkLookup(manifest) {
  state.lazyPathToChunk.clear();
  if (!manifest || !Array.isArray(manifest.files)) return;
  for (const file of manifest.files) {
    if (!file || !file.path || !file.filename) continue;
    state.lazyPathToChunk.set(file.path.trim(), file.filename);
  }
}

function updateChunkMetadataForChildren(parentNode, parentPath) {
  if (!parentNode || !Array.isArray(parentNode.children) || parentNode.children.length === 0) return 0;
  const stack = [];
  for (let i = parentNode.children.length - 1; i >= 0; i--) {
    const child = parentNode.children[i];
    if (!child || typeof child !== 'object') continue;
    stack.push({ node: child, path: composePath(parentPath, child.name) });
  }
  let updated = 0;
  while (stack.length) {
    const { node, path } = stack.pop();
    node._chunkPath = path;
    const chunkFile = state.lazyPathToChunk.get(path);
    if (chunkFile) node._chunkFile = chunkFile;
    updated++;
    if (Array.isArray(node.children) && node.children.length) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (!child || typeof child !== 'object') continue;
        stack.push({ node: child, path: composePath(path, child.name) });
      }
    }
  }
  return updated;
}

function getNodeMetrics(node) {
  if (!node) return { x: 0, y: 0, r: 10 };
  const layoutNode = state.nodeLayoutMap?.get(node._id);
  if (layoutNode) {
    return {
      x: layoutNode._vx ?? layoutNode.x ?? 0,
      y: layoutNode._vy ?? layoutNode.y ?? 0,
      r: layoutNode._vr ?? layoutNode.r ?? 10
    };
  }
  return {
    x: node._vx ?? 0,
    y: node._vy ?? 0,
    r: node._vr ?? 10
  };
}

function countNodes(root) {
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

  while (stack.length) {
    const now = performance.now();
    if (!document.hidden && now - lastYield >= chunkMs) {
      await new Promise(r => setTimeout(r, 0));
      lastYield = performance.now();
    }
    const { node, parent, depth } = stack.pop();
    if (node == null || typeof node !== 'object') continue;

    node.name = String(node.name ?? 'Unnamed');
    if (node.name.length > 100) node.name = node.name.slice(0, 100);
    node.level = inferLevelByDepth(depth);
    node.parent = parent;

    node._id = state.globalId++;

    if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];

    for (const k of Object.keys(node)) {
      if (!essentialKeys.has(k)) {
        delete node[k];
      }
    }

    if (node.children.length === 0) {
      node.children = [];
    }
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push({ node: node.children[i], parent: node, depth: depth + 1 });
    }
    processed++;
    if (showProgress && !document.hidden && processed % progressEvery === 0) {
      setProgress(processed / total, `Indexing... ${processed.toLocaleString()}/${total.toLocaleString()}`);
    }
  }
  if (showProgress && !document.hidden) setProgress(0.95, 'Computing descendant counts...');
  computeDescendantCountsIter(root);
  if (showProgress && !document.hidden) setProgress(1, 'Done');
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
  updateNavigation(state.DATA_ROOT, false);
}

// ============================================================================
// HYBRID LAZY LOADING SYSTEM
// ============================================================================

// Build skeleton from manifest (same as eager data source)
function buildSkeletonFromManifest(manifest) {
  if (!manifest || !manifest.files) {
    throw new Error('Invalid manifest: missing files array');
  }

  const rootName = manifest.root_name || 'Life';
  const root = { name: rootName, children: [] };
  root._chunkPath = rootName;
  const rootChunk = state.lazyPathToChunk.get(root._chunkPath);
  if (rootChunk) {
    root._chunkFile = rootChunk;
    root._stub = true;
  }

  const pathMap = new Map();
  pathMap.set(root._chunkPath, root);

  for (const file of manifest.files) {
    if (!file || !file.path) continue;

    const parts = file.path.split(' > ').map(p => p.trim()).filter(Boolean);
    if (!parts.length) continue;

    let parentNode = root;
    let currentPath = root._chunkPath;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === 0 && part === root.name) {
        currentPath = root._chunkPath;
        parentNode = root;
        continue;
      }

      currentPath = composePath(currentPath, part);
      let node = pathMap.get(currentPath);

      if (!node) {
        node = {
          name: part,
          _stub: true,
          _chunkPath: currentPath,
          _chunkFile: file.filename,
          children: []
        };

        if (!Array.isArray(parentNode.children)) parentNode.children = [];
        parentNode.children.push(node);
        pathMap.set(currentPath, node);
      } else {
        node._stub = true;
        node._chunkPath = currentPath;
        node._chunkFile = file.filename;
      }

      parentNode = node;
    }
  }

  return root;
}

// Fetch chunk with progress and retry logic
async function fetchChunk(filename, baseUrl, retryCount = 0) {
  const url = `${baseUrl}/${filename}`;
  const maxRetries = 3;
  const delay = Math.pow(2, retryCount) * 1000;

  try {
    if (retryCount > 0) {
      logDebug(`Fetching chunk ${filename} (attempt ${retryCount + 1})`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      cache: 'default',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    return JSON.parse(text);
  } catch (err) {
    if (retryCount < maxRetries) {
      logWarn(`Retrying ${filename} after error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchChunk(filename, baseUrl, retryCount + 1);
    }
    throw err;
  }
}

// Load and process a chunk
export async function loadChunk(filename) {
  // Check cache first
  if (state.loadedChunks.has(filename)) {
    logDebug(`Chunk ${filename} already loaded (cached)`);
    return state.loadedChunks.get(filename);
  }

  if (!state.lazyBaseUrl) {
    throw new Error('Base URL not set for lazy loading');
  }

  logInfo(`Loading chunk: ${filename}`);
  
  try {
    setProgress(0.1, `Loading ${filename}...`);
    const data = await fetchChunk(filename, state.lazyBaseUrl);
    state.loadedChunks.set(filename, data);
    logInfo(`✅ Chunk loaded: ${filename}`);
    return data;
  } catch (e) {
    logError(`Failed to load chunk ${filename}`, e);
    throw e;
  }
}

// Initialize hybrid lazy loading
export async function loadLazy(baseUrl = 'data') {
  state.loadMode = 'lazy';
  state.lazyBaseUrl = baseUrl;
  logInfo(`Starting hybrid lazy load from ${baseUrl}`);

  // Clear cache from previous loads
  state.loadedChunks.clear();

  // Load manifest (same as eager)
  setProgress(0, 'Loading manifest...');
  try {
    const manifestUrl = `${baseUrl}/manifest.json`;
    logDebug(`Fetching manifest from ${manifestUrl}`);
    state.lazyManifest = await (await fetch(manifestUrl)).json();
    buildLazyChunkLookup(state.lazyManifest);
    logInfo('Manifest loaded', { files: state.lazyManifest.files?.length });
  } catch (e) {
    logError('Failed to load manifest', e);
    throw new Error(`Could not load manifest.json from ${baseUrl}: ${e.message}`);
  }

  // Build skeleton from manifest
  setProgress(0.3, 'Building skeleton...');
  try {
    const root = buildSkeletonFromManifest(state.lazyManifest);
    const assigned = updateChunkMetadataForChildren(root, root._chunkPath);
    await indexTreeProgressive(root);
    setDataRoot(root);
    logInfo(`Skeleton created with ${countNodes(root)} stub nodes`);
    logDebug(`Applied chunk metadata to ${assigned} node(s) from manifest lookup`);
    setProgress(1, 'Ready');
  } catch (e) {
    logError('Failed to build skeleton', e);
    throw e;
  }
}

// Get viewport bounds using camera state (faster than DOM queries)
function getViewportBounds() {
  const { camera } = state;
  const halfW = W / (2 * camera.k);
  const halfH = H / (2 * camera.k);
  
  return {
    left: camera.x - halfW,
    right: camera.x + halfW,
    top: camera.y - halfH,
    bottom: camera.y + halfH,
    width: W / camera.k,
    height: H / camera.k
  };
}

// Check if node is visible with margin for preloading
function isNodeInViewport(node, bounds, margin = 1.5) {
  if (!node || !bounds) return false;
  
  // Use visual position if available
  const { x, y, r } = getNodeMetrics(node);

  // Expand bounds by margin factor
  const expandedMargin = (margin - 1) / 2;
  const expandedLeft = bounds.left - bounds.width * expandedMargin;
  const expandedRight = bounds.right + bounds.width * expandedMargin;
  const expandedTop = bounds.top - bounds.height * expandedMargin;
  const expandedBottom = bounds.bottom + bounds.height * expandedMargin;

  return (
    x + r >= expandedLeft &&
    x - r <= expandedRight &&
    y + r >= expandedTop &&
    y - r <= expandedBottom
  );
}

// Find all visible stubs that need loading, sorted by priority
function findVisibleStubs(bounds) {
  if (!state.DATA_ROOT || !bounds) return [];
  
  const stubs = [];
  const stack = [state.DATA_ROOT];
  
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;

    // If node is a stub and visible, add it
    if (isStubNode(node) && isNodeInViewport(node, bounds, 1.5)) {
      stubs.push(node);
      continue; // Don't traverse into stubs
    }

    // Traverse children if they might be visible (pre-load margin)
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (isNodeInViewport(child, bounds, 2.5)) {
          stack.push(child);
        }
      }
    }
  }
  
  // Sort by distance from viewport center (load center-first)
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  stubs.sort((a, b) => {
    const aMetrics = getNodeMetrics(a);
    const bMetrics = getNodeMetrics(b);
    const distA = Math.hypot(aMetrics.x - centerX, aMetrics.y - centerY);
    const distB = Math.hypot(bMetrics.x - centerX, bMetrics.y - centerY);
    return distA - distB;
  });
  
  return stubs;
}

// Replace stub with loaded data and maintain tree structure
async function replaceStubWithData(stub) {
  if (!stub._chunkFile) {
    logWarn(`Stub "${stub.name}" has no chunk file reference`);
    return false;
  }

  // Skip if already being loaded
  if (stub._loading) {
    logDebug(`Stub "${stub.name}" already being loaded`);
    return false;
  }

  stub._loading = true;

  try {
    logDebug(`Replacing stub "${stub.name}" with chunk ${stub._chunkFile}`);
    const chunkData = await loadChunk(stub._chunkFile);
    
    // Find stub in parent's children
    const parent = stub.parent;
    if (parent) {
      const index = parent.children.findIndex(c => c === stub);
      if (index === -1) {
        logWarn(`Stub "${stub.name}" not found in parent's children`);
        return false;
      }
    }

    const stubPath = stub._chunkPath || getNodePath(stub).join(' > ');
    const startDepth = parent && typeof parent.level === 'number' ? parent.level + 1 : 0;

    Object.assign(stub, chunkData);
    delete stub._stub;
    delete stub._chunkFile;

    stub._chunkPath = stubPath;
    stub.parent = parent ?? null;

    const metadataAssigned = updateChunkMetadataForChildren(stub, stubPath);
    if (metadataAssigned > 0) {
      logDebug(`Updated lazy metadata for ${metadataAssigned} descendant(s) of "${stub.name}"`);
    }

    await indexTreeProgressive(stub, {
      chunkMs: 50,
      parent,
      startDepth,
      resetGlobalId: false,
      showProgress: false
    });
    
    // Update descendant counts upward
    let current = parent;
    while (current) {
      computeDescendantCountsIter(current);
      current = current.parent;
    }

    logInfo(`✅ Replaced stub "${stub.name}" with loaded data`);
    return true;
  } catch (e) {
    logError(`Failed to replace stub "${stub.name}"`, e);
    return false;
  } finally {
    delete stub._loading;
  }
}

// ============================================================================
// AUTOMATIC VIEWPORT LOADING WITH SMART PRELOADING
// ============================================================================

let loadInProgress = false;
let viewportCheckTimer = null;
let lastViewport = null;

// Main function: automatically load chunks based on viewport
export async function autoLoadVisibleChunks() {
  if (loadInProgress || state.loadMode !== 'lazy') return;
  if (!state.DATA_ROOT) return;

  const bounds = getViewportBounds();
  if (!bounds) return;

  // Check if viewport changed significantly
  if (lastViewport) {
    const dx = Math.abs(bounds.left - lastViewport.left);
    const dy = Math.abs(bounds.top - lastViewport.top);
    const dw = Math.abs(bounds.width - lastViewport.width);
    const changeThreshold = Math.max(bounds.width, bounds.height) * 0.15;
    
    if (dx < changeThreshold && dy < changeThreshold && dw < changeThreshold) {
      logDebug('Viewport change too small, skipping load');
      return;
    }
  }

  lastViewport = bounds;
  loadInProgress = true;

  try {
    const stubs = findVisibleStubs(bounds);
    
    if (stubs.length === 0) {
      logDebug('No visible stubs to load');
      return;
    }

    logInfo(`Found ${stubs.length} visible stub(s) to load`);

    // Load with controlled concurrency (respect system limits)
    const concurrency = Math.max(computeFetchConcurrency(), 3);
    const queue = [...stubs];
    let activePromises = [];
    let loadedCount = 0;

    const trackPromise = promise => {
      activePromises.push(promise);
      promise.finally(() => {
        activePromises = activePromises.filter(p => p !== promise);
      });
    };

    while (queue.length > 0 || activePromises.length > 0) {
      while (activePromises.length < concurrency && queue.length > 0) {
        const stub = queue.shift();
        if (!stub || stub._loading || !stub._chunkFile) continue;

        const promise = (async () => {
          try {
            const success = await replaceStubWithData(stub);
            if (success) {
              loadedCount++;
              state.layoutChanged = true;
            }
          } catch (err) {
            logWarn('Lazy chunk load failed', err);
          }
        })();

        trackPromise(promise);
      }

      if (activePromises.length > 0) {
        try {
          await Promise.race(activePromises);
        } catch (err) {
          logWarn('One lazy load promise rejected', err);
        }
      }
    }

    if (loadedCount > 0 && state.current) {
      try {
        await updateNavigation(state.current, false);
      } catch (navErr) {
        logWarn('Viewport refresh failed after lazy chunk batch', navErr);
      }
    }
    
  } catch (err) {
    logError('Auto-load failed', err);
  } finally {
    loadInProgress = false;
    scheduleViewportCheck();
  }
}

// Schedule viewport check with debouncing
function scheduleViewportCheck() {
  if (viewportCheckTimer) {
    clearTimeout(viewportCheckTimer);
  }
  
  viewportCheckTimer = setTimeout(() => {
    autoLoadVisibleChunks();
  }, perf.indexing.chunkMs * 2); // Check after indexing yield time
}

// Hook into camera updates
export function onViewportChange() {
  if (state.loadMode !== 'lazy') return;
  scheduleViewportCheck();
}

// Start automatic loading system
export function startAutoLoading() {
  if (state.loadMode !== 'lazy') return;
  
  logInfo('🚀 Starting hybrid lazy loading system');
  
  // Initial load
  autoLoadVisibleChunks();
  
  // Set up periodic checks (fallback)
  setInterval(() => {
    if (!loadInProgress) {
      autoLoadVisibleChunks();
    }
  }, 3000);
}

// Get node path for deep linking (backward compatibility)
export function getNodePath(node) {
  const path = [];
  let current = node;
  while (current) {
    path.unshift(current.name);
    current = current.parent;
  }
  return path;
}