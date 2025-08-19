// Removed LEVELS import - now using numeric levels directly
import { clearIndex, registerNode, state } from './state.js';
import { setProgress, showLoading, hideLoading } from './loading.js';
import { perf, computeFetchConcurrency } from './performance.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap } from './state.js';
import { requestRender, W, H } from './canvas.js';
import { setBreadcrumbs } from './navigation.js';
import { findByQuery } from './search.js';
import { goToNode } from './navigation.js';

function inferLevelByDepth(depth) {
  return depth;
}

export function mapToChildren(obj) {
  const out = [];
  if (!obj || typeof obj !== 'object') return out;
  for (const [key, val] of Object.entries(obj)) {
    const node = { name: String(key) };
    
    // Handle stub nodes
    if (val && val._isStub) {
      Object.assign(node, val); // Copy stub properties
      node.children = []; // Stubs start with no children until loaded
    } else if (val && typeof val === 'object' && Object.keys(val).length) {
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
  clearIndex();
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
    if (node.name.length > 200) node.name = node.name.slice(0, 200);
    node.level = node.level || inferLevelByDepth(depth);
    node.parent = parent;
    node._id = state.globalId++;
    if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];
    // Drop empty metadata to free memory
    for (const k of Object.keys(node)) {
      if (k === 'name' || k === 'children' || k === 'level' || k === 'parent') continue;
      const v = node[k];
      if (v == null || (typeof v === 'object' && Object.keys(v).length === 0)) delete node[k];
    }
    registerNode(node);
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
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid JSON: ' + e.message);
  }
  const nroot = normalizeTree(parsed);
  await indexTreeProgressive(nroot);
  setDataRoot(nroot);
  // Try to move user to Homo sapiens for light initial view
  jumpToPreferredStart();
}

export async function loadFromUrl(url) {
  if (!url) throw new Error('No URL provided');
  
  // Check if this is a split dataset by looking for manifest.json
  const manifestUrl = url.replace(/[^/]*$/, 'manifest.json');
  
  try {
    const manifestRes = await fetch(manifestUrl, { cache: 'force-cache' });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      if (manifest.version && manifest.files) {
        return await loadFromSplitFiles(url.replace(/[^/]*$/, ''), manifest);
      }
    }
  } catch (e) {
    // No manifest found, try loading as single file
  }
  
  // Single file loading
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const text = await res.text();
  await loadFromJSONText(text);
}

// Store manifest and base URL for dynamic loading
let manifestCache = null;
let baseUrlCache = null;
const loadedChunks = new Set(); // Track which chunks we've loaded

async function loadFromSplitFiles(baseUrl, manifest) {
  manifestCache = manifest;
  baseUrlCache = baseUrl;
  
  setProgress(0, 'Loading root tree structure...');
  
  // Find and load only the root file initially
  const rootFile = manifest.files.find(f => f.is_root);
  if (!rootFile) throw new Error('No root file found in manifest');
  
  const rootUrl = baseUrl + rootFile.filename;
  const res = await fetch(rootUrl, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Failed to fetch ${rootUrl} (${res.status})`);
  const rootChunk = await res.json();
  loadedChunks.add(rootFile.filename);
  
  setProgress(0.5, 'Creating lazy-loaded tree structure...');
  
  // Create tree with stub nodes for unloaded chunks
  const tree = createTreeWithStubs(rootChunk, manifest);
  
  setProgress(0.8, 'Processing tree...');
  
  const normalizedTree = normalizeTree(tree);
  await indexTreeProgressive(normalizedTree);
  setDataRoot(normalizedTree);
  jumpToPreferredStart();
  setProgress(1, `Loaded root structure with ${manifest.total_files - 1} lazy chunks available`);
}

function createTreeWithStubs(rootChunk, manifest) {
  // For nested map format, convert to structured format with stubs
  const pathToFileMap = new Map();
  manifest.files.forEach(file => {
    if (!file.is_root && file.path) {
      pathToFileMap.set(file.path, file);
    }
  });
  
  function processNode(obj, currentPath = '') {
    if (!obj || typeof obj !== 'object') return obj;
    
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const nodePath = currentPath ? `${currentPath}/${key}` : key;
      
      // Check if this path has a corresponding file to load
      const matchingFiles = Array.from(pathToFileMap.entries()).filter(([path]) => 
        path.startsWith(nodePath + '_part_') || path === nodePath
      );
      
      if (matchingFiles.length > 0) {
        // Create a stub node that will be loaded on demand
        result[key] = {
          _isStub: true,
          _lazyFiles: matchingFiles.map(([, file]) => file),
          _stubPath: nodePath,
          _hasChildren: true
        };
      } else if (value && typeof value === 'object' && Object.keys(value).length > 0) {
        // Recursively process nested objects
        result[key] = processNode(value, nodePath);
      } else {
        // Leaf node
        result[key] = value;
      }
    }
    return result;
  }
  
  return processNode(rootChunk);
}

// Function to load a stub node on demand
export async function loadStubNode(stubNode) {
  if (!stubNode._isStub || !stubNode._lazyFiles) return stubNode;
  
  setProgress(0, `Loading ${stubNode._lazyFiles.length} chunks...`);
  
  const chunks = [];
  for (let i = 0; i < stubNode._lazyFiles.length; i++) {
    const file = stubNode._lazyFiles[i];
    if (loadedChunks.has(file.filename)) continue; // Skip already loaded
    
    const fileUrl = baseUrlCache + file.filename;
    const res = await fetch(fileUrl, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);
    const chunk = await res.json();
    chunks.push(chunk);
    loadedChunks.add(file.filename);
    
    setProgress((i + 1) / stubNode._lazyFiles.length, `Loading chunk ${i + 1}/${stubNode._lazyFiles.length}...`);
  }
  
  // Merge all chunks for this stub
  const mergedChunk = {};
  const deepMerge = (target, source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
    for (const [k, v] of Object.entries(source)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {};
        deepMerge(target[k], v);
      } else {
        target[k] = v;
      }
    }
    return target;
  };
  
  for (const chunk of chunks) {
    deepMerge(mergedChunk, chunk);
  }
  
  // Find the relevant subtree in the merged chunk
  const pathParts = stubNode._stubPath.split('/');
  let subtree = mergedChunk;
  for (const part of pathParts) {
    if (subtree && subtree[part]) {
      subtree = subtree[part];
    } else {
      subtree = {};
      break;
    }
  }
  
  hideLoading();
  return subtree || {};
}

export function setDataRoot(root) {
  state.DATA_ROOT = root;
  state.current = state.DATA_ROOT;
  state.layout = layoutFor(state.current);
  rebuildNodeMap();
  setBreadcrumbs(state.current);
  state.camera.k = Math.min(W / state.layout.diameter, H / state.layout.diameter);
  state.camera.x = 0;
  state.camera.y = 0;
  requestRender();
}

function jumpToPreferredStart() {
  // Respect deep links; only jump if no hash present
  if (location.hash && location.hash.length > 1) return;
  const preferred = findByQuery('Homo sapiens') || findByQuery('Homo');
  if (preferred) {
    // Jump without animation to avoid initial lag
    goToNode(preferred, false);
    state.highlightNode = preferred;
    requestRender();
  }
}


