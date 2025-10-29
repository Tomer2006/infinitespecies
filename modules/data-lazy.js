// Lazy loading functionality for taxonomy tree data
import { state } from './state.js';
import { setProgress } from './loading.js';
import { logInfo, logError, logDebug, logWarn } from './logger.js';
import { perf } from './performance.js';
import { updateNavigation } from './navigation.js';

// ============================================================================
// COMMON DATA LOADING FUNCTIONS (formerly in data-common.js)
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
  state.globalId = 1; // Reset ID counter
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
    const essentialKeys = new Set(['name', 'children', 'level', 'parent', '_id', '_vx', '_vy', '_vr', '_leaves', '_stub']); // Keep _stub
    for (const k of Object.keys(node)) {
      if (!essentialKeys.has(k)) {
        delete node[k];
      }
    }

    // Further optimize: use shorter property names where possible
    if (node.children && node.children.length === 0) {
      node.children = []; // Ensure consistent empty array
    }
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
  console.log('🚀 [JSON] loadFromJSONText called with text length:', text.length);
  const jsonStartTime = performance.now();

  let parsed;
  try {
    console.log('📋 [JSON] Starting JSON parse...');
    const parseStartTime = performance.now();
    logInfo('Parsing JSON text…');
    parsed = JSON.parse(text);
    const parseDuration = performance.now() - parseStartTime;
    console.log(`✅ [JSON] JSON parsed successfully in ${parseDuration.toFixed(2)}ms, type:`, typeof parsed, Array.isArray(parsed) ? 'array' : 'object');
  } catch (e) {
    console.error('💥 [JSON] JSON parsing failed:', e);
    console.error('🔍 [JSON] Error details:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    logError('Invalid JSON during loadFromJSONText', e);
    throw new Error('Invalid JSON: ' + e.message);
  }

  console.log('🔄 [JSON] Normalizing parsed tree structure...');
  logDebug('Normalizing parsed JSON tree');
  const normalizeStartTime = performance.now();
  const nroot = normalizeTree(parsed);
  const normalizeDuration = performance.now() - normalizeStartTime;
  console.log(`🧬 [JSON] Tree normalized in ${normalizeDuration.toFixed(2)}ms`);

  console.log('🔍 [JSON] Starting tree indexing...');
  const indexStartTime = performance.now();
  await indexTreeProgressive(nroot);
  const indexDuration = performance.now() - indexStartTime;
  console.log(`📊 [JSON] Tree indexed in ${indexDuration.toFixed(2)}ms`);

  console.log('💾 [JSON] Setting data root...');
  setDataRoot(nroot);

  const totalDuration = performance.now() - jsonStartTime;
  console.log(`🎉 [JSON] loadFromJSONText completed successfully in ${totalDuration.toFixed(2)}ms`);
  logInfo('JSON data loaded successfully, initialized root');
}

export function setDataRoot(root) {
  state.DATA_ROOT = root;
  // Use centralized navigation update for initial setup
  updateNavigation(state.DATA_ROOT, false);
}

// ============================================================================
// LAZY LOADING FUNCTIONS
// ============================================================================

/**
 * Check if a node is a stub (not fully loaded)
 */
export function isStubNode(node) {
  return node && node._stub === true;
}

/**
 * Build complete tree structure from manifest chunk paths
 * Each node is a stub that will load its children on-demand
 */
function buildTreeFromManifest(manifest) {
  console.log('🏗️ [LAZY] Building tree structure from manifest paths...');
  const root = { name: 'Life', level: 0, children: [] };
  const nodeMap = new Map(); // Map of path string to node for quick lookup
  nodeMap.set('Life', root);
  
  // Process each chunk to extract all unique paths
  const allPaths = new Set();
  for (const fileInfo of manifest.files) {
    // Add the chunk's own path
    allPaths.add(fileInfo.path);
    
    // Also add parent paths to ensure complete tree
    const pathParts = fileInfo.path.split(' > ').filter(p => p.length > 0);
    for (let i = 2; i < pathParts.length; i++) {
      allPaths.add(pathParts.slice(0, i).join(' > '));
    }
  }
  
  console.log(`📊 [LAZY] Found ${allPaths.size} unique node paths`);
  
  // Sort paths by depth to ensure parents exist before children
  const sortedPaths = Array.from(allPaths).sort((a, b) => {
    const depthA = a.split(' > ').length;
    const depthB = b.split(' > ').length;
    return depthA - depthB;
  });
  
  // Build tree by navigating/creating nodes for each path
  let createdCount = 0;
  for (const pathStr of sortedPaths) {
    const pathParts = pathStr.split(' > ').filter(p => p.length > 0);
    let current = root;
    
    // Navigate/create path from root to target node
    for (let i = 1; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      // Initialize children if needed
      if (!current.children) current.children = [];
      
      // Find or create child node
      let found = null;
      for (const child of current.children) {
        if (child.name === part) {
          found = child;
          break;
        }
      }
      
      if (!found) {
        // Create new node - it will be a stub for lazy loading
        found = {
          name: part,
          level: i,
          children: [],
          _stub: true, // Mark as needing data
          _leaves: 1   // Give stub minimal leaves for layout
        };
        current.children.push(found);
        nodeMap.set(pathStr.split(' > ').slice(0, i + 1).join(' > '), found);
        createdCount++;
      }
      
      current = found;
    }
  }
  
  console.log(`✅ [LAZY] Created ${createdCount} nodes from manifest paths`);
  return root;
}

/**
 * Load tree skeleton for lazy loading - NOW builds from manifest paths
 */
export async function loadLazy(baseUrl = 'data lazy') {
  console.log('🚀 [LAZY] Starting lazy loading mode (true lazy with dynamic loading)');
  const startTime = performance.now();

  state.loadMode = 'lazy';
  state.lazyBaseUrl = baseUrl;

  try {
    // Load manifest only (no skeleton needed!)
    console.log('📋 [LAZY] Loading manifest...');
    setProgress(0.2, 'Loading manifest...');
    const manifestUrl = `${baseUrl}/manifest.json`;
    const manifestRes = await fetch(manifestUrl, { cache: 'default' });

    if (!manifestRes.ok) {
      throw new Error(`Failed to fetch manifest: ${manifestRes.status}`);
    }

    state.lazyManifest = await manifestRes.json();
    console.log(`✅ [LAZY] Manifest loaded: ${state.lazyManifest.total_files} chunks`);

    // Build complete tree skeleton from manifest paths
    console.log('🏗️ [LAZY] Building tree skeleton from manifest...');
    setProgress(0.4, 'Building tree skeleton...');
    const skeletonRoot = buildTreeFromManifest(state.lazyManifest);

    // Load the actual root chunk data to replace the skeleton
    console.log('📦 [LAZY] Loading root chunk data...');
    setProgress(0.6, 'Loading root chunk...');
    const rootChunkInfo = state.lazyManifest.files.find(f => f.path === state.lazyManifest.root_name);
    if (!rootChunkInfo) {
      throw new Error('Could not find root chunk in manifest');
    }
    const rootChunkData = await loadChunk(rootChunkInfo.filename);
    console.log(`✅ [LAZY] Root chunk loaded: ${rootChunkInfo.filename}`);

    // Use the actual root chunk data, but it should already have stub nodes from the splitting
    const nroot = rootChunkData;

    console.log('🔍 [LAZY] Indexing tree...');
    setProgress(0.8, 'Indexing tree...');
    // We pass `indexTreeProgressive` which will compute initial _leaves
    // based on the skeleton, which is fine.
    await indexTreeProgressive(nroot); 

    setProgress(0.95, 'Finalizing...');
    setDataRoot(nroot);

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 [LAZY] Lazy loading complete in ${totalTime}s`);
    console.log(`📊 [LAZY] Tree ready: ${state.lazyManifest.total_files} chunks available for on-demand loading`);
    setProgress(1, `Ready! (Lazy mode: ${state.lazyManifest.total_files} chunks)`);

    return nroot;
  } catch (err) {
    console.error('💥 [LAZY] Lazy loading failed:', err);
    logError('Lazy loading failed', err);
    throw err;
  }
}

/**
 * Load a specific chunk by filename
 */
export async function loadChunk(filename) {
  // Check cache first
  if (state.loadedChunks.has(filename)) {
    console.log(`📦 [LAZY] Chunk ${filename} already loaded (cached)`);
    return state.loadedChunks.get(filename);
  }

  console.log(`📥 [LAZY] Loading chunk: ${filename}`);
  const chunkUrl = `${state.lazyBaseUrl}/${filename}`;

  try {
    const res = await fetch(chunkUrl, { cache: 'default' });
    if (!res.ok) {
      throw new Error(`Failed to fetch chunk ${filename}: ${res.status}`);
    }

    const chunkData = await res.json();

    // Cache it
    state.loadedChunks.set(filename, chunkData);
    console.log(`✅ [LAZY] Chunk ${filename} loaded and cached`);

    return chunkData;
  } catch (err) {
    console.error(`💥 [LAZY] Failed to load chunk ${filename}:`, err);
    throw err;
  }
}

/**
 * Find which chunk contains a specific node path
 */
export function findChunkForPath(nodePath) {
  if (!state.lazyManifest) {
    console.warn('[LAZY] No manifest loaded');
    return null;
  }

  // Find the chunk that matches this path
  const chunkInfo = state.lazyManifest.files.find(f =>
    f.path === nodePath || nodePath.startsWith(f.path + ' > ')
  );

  return chunkInfo;
}

/**
 * Get the full path of a node as a string
 */
export function getNodePath(node) {
  const path = [];
  let current = node;

  while (current) {
    path.unshift(current.name);
    current = current.parent;
  }

  return path.join(' > ');
}


// *** NEW HELPER FUNCTIONS ***

/**
 * Helper to recursively index a new chunk attached to a parent.
 * This function processes *only* the new nodes, assigning IDs, levels,
 * and parent pointers without touching the rest of the tree.
 * It returns the total number of leaves in the newly indexed branch.
 */
async function indexNewChunk(parentNode, newChildren) {
  const chunkMs = perf.indexing.chunkMs;
  const progressEvery = perf.indexing.progressEvery;
  let processed = 0;
  const stack = [];
  
  // Initialize stack with new children
  for (let i = newChildren.length - 1; i >= 0; i--) {
    stack.push({ node: newChildren[i], parent: parentNode, depth: parentNode.level + 1 });
  }

  let lastYield = performance.now();

  const postOrderStack = []; // For processing leaves
  
  // Iterative DFS for indexing (similar to indexTreeProgressive)
  while (stack.length) {
    const now = performance.now();
    if (!document.hidden && now - lastYield >= chunkMs) {
      await new Promise(r => setTimeout(r, 0));
      lastYield = performance.now();
    }

    const { node, parent, depth } = stack.pop();
    if (node == null || typeof node !== 'object') continue;
    
    // Push to post-order stack *before* processing children
    postOrderStack.push(node);

    node.name = String(node.name ?? 'Unnamed');
    if (node.name.length > 100) node.name = node.name.slice(0, 100);
    node.level = node.level || inferLevelByDepth(depth);
    node.parent = parent;
    node._id = state.globalId++; // Use existing globalId, don't reset
    
    if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];

    // Essential keys check
    const essentialKeys = new Set(['name', 'children', 'level', 'parent', '_id', '_vx', '_vy', '_vr', '_leaves', '_stub']); // Keep _stub
    for (const k of Object.keys(node)) {
      if (!essentialKeys.has(k)) {
        delete node[k];
      }
    }
    
    if (node.children && node.children.length === 0) {
      node.children = [];
    }

    // Add children to stack for processing
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push({ node: node.children[i], parent: node, depth: depth + 1 });
    }
    
    processed++;
    // We can't show progress % here as we don't know total chunk size
    if (processed % progressEvery === 0) {
      // Don't use setProgress, just log
      logDebug(`Indexing chunk… ${processed.toLocaleString()} nodes`);
    }
  }
  
  // Now compute descendant counts for the new nodes (post-order traversal)
  while (postOrderStack.length) {
    const n = postOrderStack.pop();
    const ch = n.children || [];
    
    if (ch.length === 0) {
      // A leaf node in the new chunk
      // If it's *not* a stub, it's a true leaf.
      if (!isStubNode(n)) {
        n._leaves = 1;
      } else {
        // If it *is* a stub, we use its existing _leaves count
        // (which was set during buildTreeFromManifest) or default to 1.
        n._leaves = n._leaves || 1; 
      }
    } else {
      // An internal node in the new chunk
      let sum = 0;
      for (let j = 0; j < ch.length; j++) {
        sum += ch[j]._leaves || 1; // Child's leaves
      }
      n._leaves = sum;
    }
  }
  
  // The total leaves of the parent is the sum of its new children's leaves
  const totalNewLeaves = newChildren.reduce((acc, child) => acc + (child._leaves || 1), 0);
  return totalNewLeaves;
}

/**
 * Helper to walk up the tree and update leaf counts.
 */
function updateAncestorLeaves(startNode, leavesDiff) {
  if (leavesDiff === 0) return;
  
  let current = startNode;
  while (current) {
    current._leaves = (current._leaves || 0) + leavesDiff;
    current = current.parent;
  }
}


// *** END NEW HELPER FUNCTIONS ***


/**
 * Load data for a stub node
 * THIS IS THE MODIFIED, EFFICIENT VERSION
 */
export async function loadNodeData(node) {
  if (!isStubNode(node)) {
    console.log('[LAZY] Node is not a stub, no loading needed');
    return node;
  }

  const nodePath = getNodePath(node);
  console.log(`🔍 [LAZY] Loading data for stub node: ${nodePath}`);

  const chunkInfo = findChunkForPath(nodePath);
  if (!chunkInfo) {
    console.warn(`[LAZY] No chunk found for path: ${nodePath}`);
    // Remove stub flag so we don't try again
    delete node._stub;
    return node;
  }

  // Load the chunk
  const chunkData = await loadChunk(chunkInfo.filename);
        
  // Merge chunk data into the node
  if (chunkData && chunkData.children && chunkData.children.length > 0) {
    console.log(`🔗 [LAZY] Merging ${chunkData.children.length} children into node ${node.name}`);
    
    // *** START REPLACEMENT ***
    // Old way (very slow):
    // node.children = chunkData.children;
    // await indexTreeProgressive(state.DATA_ROOT);
    
    // New efficient way:
    const newChildren = chunkData.children;
    
    // 1. Index *only* the new chunk, attaching it to the current node
    // This will assign IDs, parents, levels, and compute _leaves for the new nodes
    // It returns the total number of leaves in this new branch.
    const newLeaves = await indexNewChunk(node, newChildren);
    
    // 2. Attach the fully indexed children
    node.children = newChildren;
    
    // 3. The stub node itself is no longer a stub
    delete node._stub;
    
    // 4. Update ancestor leaf counts
    // The old _leaves count for the stub was likely 1 (or whatever was set).
    // The new _leaves count is `newLeaves`.
    // The difference needs to be propagated up.
    const oldLeaves = node._leaves || 1; // Get the stub's old leaf count
    const leavesDiff = newLeaves - oldLeaves;
    
    // Set the node's new leaf count
    node._leaves = newLeaves;
    
    // Propagate the difference up the ancestor chain
    if (node.parent) {
      updateAncestorLeaves(node.parent, leavesDiff);
    }
    
    logInfo(`✅ [LAZY] Efficiently merged ${newChildren.length} children and ${newLeaves} leaves. Propagated diff of ${leavesDiff}.`);
    // *** END REPLACEMENT ***
    
  } else {
    // No children found, or empty chunk
    logDebug(`[LAZY] Chunk for ${node.name} was empty or had no children.`);
    delete node._stub;
    node.children = [];
    
    // Update leaf counts
    const oldLeaves = node._leaves || 1;
    const newLeaves = 1; // It's now a true leaf
    const leavesDiff = newLeaves - oldLeaves;
    node._leaves = newLeaves;
    if (node.parent && leavesDiff !== 0) {
      updateAncestorLeaves(node.parent, leavesDiff);
    }
  }

  return node;
}
