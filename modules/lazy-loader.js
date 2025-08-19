// Lazy loading manager for dynamic tree chunks
import { state } from './state.js';
import { setProgress } from './loading.js';

const chunkCache = new Map();
const loadingPromises = new Map();
let manifestData = null;
let baseUrl = '';

/**
 * Initialize lazy loader with manifest
 * @param {string} manifestUrl - URL to manifest.json
 */
export async function initLazyLoader(manifestUrl) {
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`Failed to load manifest: ${response.status}`);
    
    manifestData = await response.json();
    baseUrl = manifestUrl.replace(/[^/]*$/, ''); // Remove filename, keep directory
    
    console.log(`Lazy loader initialized: ${manifestData.totalChunks || 0} chunks available`);
    return true;
  } catch (error) {
    console.warn('Lazy loader init failed:', error);
    return false;
  }
}

/**
 * Check if a node is a lazy-loading stub
 * @param {Object} node - Node to check
 * @returns {boolean}
 */
export function isStub(node) {
  return node && node._isStub === true && node._chunkPath;
}

/**
 * Load chunk data for a stub node
 * @param {Object} stubNode - Stub node with _chunkPath
 * @returns {Promise<Object>} - Loaded node data
 */
export async function loadChunk(stubNode) {
  if (!isStub(stubNode)) {
    return stubNode; // Already loaded
  }

  const chunkPath = stubNode._chunkPath;
  
  // Return cached chunk if available
  if (chunkCache.has(chunkPath)) {
    return chunkCache.get(chunkPath);
  }

  // Return existing promise if chunk is currently loading
  if (loadingPromises.has(chunkPath)) {
    return loadingPromises.get(chunkPath);
  }

  // Start loading chunk
  const loadPromise = loadChunkFromServer(chunkPath);
  loadingPromises.set(chunkPath, loadPromise);

  try {
    const chunkData = await loadPromise;
    chunkCache.set(chunkPath, chunkData);
    loadingPromises.delete(chunkPath);
    return chunkData;
  } catch (error) {
    loadingPromises.delete(chunkPath);
    throw error;
  }
}

/**
 * Fetch chunk data from server
 * @param {string} chunkPath - Path to chunk file
 * @returns {Promise<Object>}
 */
async function loadChunkFromServer(chunkPath) {
  const url = baseUrl + chunkPath;
  setProgress(0.1, `Loading ${chunkPath}...`);
  
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load chunk ${chunkPath}: ${response.status}`);
    }
    
    const data = await response.json();
    setProgress(1, `Loaded ${chunkPath}`);
    
    return data;
  } catch (error) {
    setProgress(0, `Failed to load ${chunkPath}`);
    throw error;
  }
}

/**
 * Recursively load all stub children of a node
 * @param {Object} node - Node to expand
 * @param {number} maxDepth - Maximum depth to expand (prevents infinite loading)
 * @returns {Promise<Object>} - Node with loaded children
 */
export async function expandStubs(node, maxDepth = 2) {
  if (!node || maxDepth <= 0) return node;
  
  // Load this node if it's a stub
  if (isStub(node)) {
    node = await loadChunk(node);
  }

  // Recursively expand children
  if (node.children && Array.isArray(node.children)) {
    const expandedChildren = await Promise.all(
      node.children.map(child => expandStubs(child, maxDepth - 1))
    );
    node.children = expandedChildren;
  }

  return node;
}

/**
 * Pre-load chunks that are likely to be needed soon
 * @param {Object} currentNode - Current navigation context
 */
export async function preloadNearbyChunks(currentNode) {
  if (!currentNode || !currentNode.children) return;

  // Identify stub children that might be navigated to
  const stubChildren = currentNode.children.filter(isStub);
  
  // Load up to 3 nearby chunks in background
  const preloadPromises = stubChildren
    .slice(0, 3)
    .map(stub => loadChunk(stub).catch(() => {})); // Ignore errors for preloading

  await Promise.allSettled(preloadPromises);
}

/**
 * Get memory usage statistics
 * @returns {Object} - Memory usage info
 */
export function getMemoryStats() {
  const chunkCount = chunkCache.size;
  const loadingCount = loadingPromises.size;
  
  let totalNodes = 0;
  for (const chunk of chunkCache.values()) {
    totalNodes += countNodesInChunk(chunk);
  }

  return {
    chunksLoaded: chunkCount,
    chunksLoading: loadingCount,
    nodesInMemory: totalNodes,
    totalAvailableChunks: manifestData?.totalChunks || 0
  };
}

/**
 * Clear memory by removing cached chunks
 * @param {number} keepCount - Number of most recently used chunks to keep
 */
export function clearMemory(keepCount = 5) {
  if (chunkCache.size <= keepCount) return;

  // Convert to array and keep only recent chunks
  // Note: This is a simple LRU - in production you'd track access times
  const entries = Array.from(chunkCache.entries());
  const toRemove = entries.slice(0, entries.length - keepCount);
  
  for (const [path] of toRemove) {
    chunkCache.delete(path);
  }

  console.log(`Cleared ${toRemove.length} chunks from memory`);
}

/**
 * Count nodes in a chunk (for memory estimation)
 * @param {Object} chunk - Chunk data
 * @returns {number}
 */
function countNodesInChunk(chunk) {
  if (!chunk) return 0;
  let count = 1;
  if (chunk.children) {
    for (const child of chunk.children) {
      count += countNodesInChunk(child);
    }
  }
  return count;
}

/**
 * Reset lazy loader state
 */
export function resetLazyLoader() {
  chunkCache.clear();
  loadingPromises.clear();
  manifestData = null;
  baseUrl = '';
}
