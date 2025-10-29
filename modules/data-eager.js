// Eager loading functionality for taxonomy tree data
import { state } from './state.js';
import { computeFetchConcurrency, perf } from './performance.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { setProgress } from './loading.js';
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
    const essentialKeys = new Set(['name', 'children', 'level', 'parent', '_id', '_vx', '_vy', '_vr', '_leaves']);
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
// EAGER LOADING FUNCTIONS
// ============================================================================

// Eager loading: loads everything at once
export async function loadEager(url) {
  console.log('🚀 [DATA] loadEager called with URL:', url);
  const startTime = performance.now();

  if (!url) {
    console.error('❌ [DATA] ERROR: No URL provided to loadEager');
    throw new Error('No URL provided');
  }

  state.loadMode = 'eager';
  console.log('⚙️ [DATA] Set load mode to eager');

  logInfo(`Loading data eagerly from ${url}`);
  console.log('📡 [DATA] Starting eager loading process for:', url);

  // Check if this is a split dataset by looking for manifest.json
  const manifestUrl = url.replace(/[^/]*$/, 'manifest.json');
  const baseUrl = url.replace(/[^/]*$/, '');

  console.log('🔍 [DATA] Checking for manifest file:', manifestUrl);
  console.log('📂 [DATA] Base URL for files:', baseUrl);

  try {
    console.log('🌐 [DATA] Attempting to fetch manifest...');
    const manifestFetchStart = performance.now();
    logDebug(`Attempting to fetch manifest from ${manifestUrl}`);

    const manifestRes = await fetch(manifestUrl, { cache: 'default' });
    const manifestFetchDuration = performance.now() - manifestFetchStart;

    console.log(`📄 [DATA] Manifest fetch completed in ${manifestFetchDuration.toFixed(2)}ms`);

    if (manifestRes.ok) {
      console.log('✅ [DATA] Manifest response OK, parsing JSON...');
      const manifestParseStart = performance.now();
      const manifest = await manifestRes.json();
      const manifestParseDuration = performance.now() - manifestParseStart;

      console.log(`📋 [DATA] Manifest parsed in ${manifestParseDuration.toFixed(2)}ms:`, {
        version: manifest.version,
        totalFiles: manifest.total_files,
        totalNodes: manifest.total_nodes,
        hasFiles: !!manifest.files,
        hasChildren: !!manifest.children
      });

      if (manifest.version && manifest.files) {
        console.log('🎯 [DATA] Split-file manifest detected, proceeding with parallel loading');
        logInfo('Split-file manifest detected, loading eagerly');
        const result = await loadFromSplitFiles(baseUrl, manifest);
        const totalDuration = performance.now() - startTime;
        console.log(`🎉 [DATA] loadEager completed successfully in ${totalDuration.toFixed(2)}ms`);
        return result;
      } else {
        console.log('❓ [DATA] Manifest exists but doesn\'t match expected structure');
      }
    } else {
      console.log(`📭 [DATA] Manifest not found (HTTP ${manifestRes.status}), will try single file loading`);
      logDebug(`No manifest found at ${manifestUrl}`);
    }
  } catch (e) {
    console.error('💥 [DATA] Manifest fetch/parsing failed:', e);
    console.error('🔍 [DATA] Error details:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    logWarn(`Manifest fetch failed at ${manifestUrl}: ${e.message}`);
  }

  // Single file loading (fallback/default for eager mode)
  console.log('📄 [DATA] Falling back to single file loading');
  logInfo(`Loading single JSON file eagerly from ${url}`);

  try {
    console.log('🌐 [DATA] Fetching single file...');
    const fetchStart = performance.now();
    const res = await fetch(url, { cache: 'default' });
    const fetchDuration = performance.now() - fetchStart;

    console.log(`📦 [DATA] File fetch completed in ${fetchDuration.toFixed(2)}ms, status: ${res.status}`);

    if (!res.ok) {
      console.error(`❌ [DATA] File fetch failed with status ${res.status}`);
      throw new Error(`Failed to fetch ${url} (${res.status})`);
    }

    console.log('📖 [DATA] Reading response text...');
    const textStart = performance.now();
    const text = await res.text();
    const textDuration = performance.now() - textStart;

    console.log(`📝 [DATA] Text read in ${textDuration.toFixed(2)}ms, length: ${text.length} characters`);

    console.log('🔄 [DATA] Processing JSON text...');
    await loadFromJSONText(text);

    const totalDuration = performance.now() - startTime;
    console.log(`🎉 [DATA] loadEager completed successfully in ${totalDuration.toFixed(2)}ms`);

  } catch (e) {
    console.error('💥 [DATA] Single file loading failed:', e);
    console.error('🔍 [DATA] Error details:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    throw e;
  }
}

export async function loadFromUrl(url, options = {}) {
  if (!url) throw new Error('No URL provided');

  // Always use eager loading mode
  return await loadEager(url);
}

async function loadFromSplitFiles(baseUrl, manifest) {
  console.log('🚀 [SPLIT] loadFromSplitFiles called with:', { baseUrl, manifest });
  const splitStartTime = performance.now();

  const totalFiles = Array.isArray(manifest.files) ? manifest.files.length : (manifest.total_files || 0);
  console.log(`📊 [SPLIT] Dataset info: ${totalFiles} total files, ${manifest.total_nodes || 'unknown'} total nodes`);

  logInfo(`Loading split dataset from ${baseUrl} (${totalFiles} files)`);

  // Import setProgress here to avoid circular imports
  const { setProgress } = await import('./loading.js');
  console.log('⏳ [SPLIT] Initializing progress bar...');
  setProgress(0, `Loading ${totalFiles} split files...`);

  // Increased concurrency for better performance
  const concurrency = Math.max(computeFetchConcurrency(), 8); // Minimum 8 concurrent requests
  console.log(`⚡ [SPLIT] Using concurrency: ${concurrency} (computed: ${computeFetchConcurrency()}, min: 8)`);

  let completed = 0;
  let failed = 0;
  const maxRetries = 3;
  const results = new Array(manifest.files.length);
  const retryQueue = [];

  console.log('📋 [SPLIT] Initialization complete:', {
    totalFiles,
    concurrency,
    maxRetries,
    resultsArraySize: results.length
  });

  const loadFileWithRetry = async (fileInfo, index, retryCount = 0) => {
    const fileUrl = baseUrl + fileInfo.filename;
    console.log(`📄 [SPLIT] Starting file load: ${fileUrl} (index: ${index}, attempt: ${retryCount + 1})`);
    const fileStartTime = performance.now();

    try {
      console.log(`🌐 [SPLIT] Fetching file ${index + 1}/${totalFiles}: ${fileUrl}`);
      logDebug(`Fetching split file ${fileUrl} (attempt ${retryCount + 1})`);

      const fetchStartTime = performance.now();
      const res = await fetch(fileUrl, {
        cache: 'default',
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      const fetchDuration = performance.now() - fetchStartTime;

      console.log(`📦 [SPLIT] File ${index + 1} fetch completed in ${fetchDuration.toFixed(2)}ms, status: ${res.status}`);

      if (!res.ok) {
        console.error(`❌ [SPLIT] File ${index + 1} fetch failed with HTTP ${res.status}`);
        throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);
      }

      console.log(`📋 [SPLIT] Parsing JSON for file ${index + 1}...`);
      const parseStartTime = performance.now();
      const chunk = await res.json();
      const parseDuration = performance.now() - parseStartTime;

      console.log(`✅ [SPLIT] File ${index + 1} parsed in ${parseDuration.toFixed(2)}ms, size: ${JSON.stringify(chunk).length} chars`);

      results[index] = { index, chunk, fileInfo };
      completed++;

      const fileTotalDuration = performance.now() - fileStartTime;
      console.log(`🎯 [SPLIT] File ${index + 1} completed successfully in ${fileTotalDuration.toFixed(2)}ms`);

      // Update progress more frequently for better UX
      if (completed % Math.max(1, Math.floor(totalFiles / 20)) === 0 || completed === totalFiles) {
        const progressPercent = (completed / totalFiles * 100).toFixed(1);
        console.log(`📊 [SPLIT] Progress: ${completed}/${totalFiles} files (${progressPercent}%)`);
        setProgress(completed / totalFiles, `Loaded ${completed}/${totalFiles} files...`);
      }

      return true;
    } catch (err) {
      console.error(`💥 [SPLIT] File ${index + 1} load failed (attempt ${retryCount + 1}):`, err.message);

      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`🔄 [SPLIT] Retrying file ${index + 1} in ${delay}ms (attempt ${retryCount + 2}/${maxRetries + 1})`);
        logWarn(`Retrying ${fileUrl} after error: ${err.message}`);

        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, delay));
        return loadFileWithRetry(fileInfo, index, retryCount + 1);
      } else {
        failed++;
        const fileTotalDuration = performance.now() - fileStartTime;
        console.error(`🚫 [SPLIT] File ${index + 1} FAILED permanently after ${maxRetries + 1} attempts (${fileTotalDuration.toFixed(2)}ms)`);
        console.error('🔍 [SPLIT] Final error details:', {
          file: fileUrl,
          index,
          attempts: retryCount + 1,
          error: err.message,
          stack: err.stack
        });

        logError(`Failed to load ${fileUrl} after ${maxRetries} retries`, err);
        return false;
      }
    }
  };

  // Parallel loading with controlled concurrency
  console.log('🚀 [SPLIT] Starting parallel file loading...');

  await new Promise((resolve, reject) => {
    let inFlight = 0;
    let nextIndex = 0;

    console.log('⚙️ [SPLIT] Initializing parallel loading queue...');

    const startNext = () => {
      console.log(`🔄 [SPLIT] Queue check: inFlight=${inFlight}, nextIndex=${nextIndex}, totalFiles=${totalFiles}`);

      while (inFlight < concurrency && nextIndex < manifest.files.length) {
        const i = nextIndex++;
        inFlight++;
        const fileInfo = manifest.files[i];

        console.log(`▶️ [SPLIT] Starting file ${i + 1}/${totalFiles}: ${fileInfo.filename} (inFlight: ${inFlight}/${concurrency})`);

        loadFileWithRetry(fileInfo, i).finally(() => {
          inFlight--;
          console.log(`⏹️ [SPLIT] File ${i + 1} completed (inFlight now: ${inFlight})`);

          if (completed + failed === totalFiles) {
            console.log(`🎯 [SPLIT] All files processed: ${completed} successful, ${failed} failed`);

            if (failed > 0) {
              console.warn(`⚠️ [SPLIT] ${failed} files failed to load out of ${totalFiles}`);
              logWarn(`Completed loading with ${failed} failed files out of ${totalFiles}`);
            } else {
              console.log('✅ [SPLIT] All files loaded successfully!');
            }

            resolve();
          } else {
            startNext();
          }
        });
      }

      if (inFlight === 0 && nextIndex >= manifest.files.length) {
        console.log('⏸️ [SPLIT] All files queued, waiting for completion...');
      }
    };

    console.log('🎬 [SPLIT] Starting initial batch...');
    startNext();
  });

  // Filter out failed loads
  console.log('🔍 [SPLIT] Filtering failed loads...');
  const validCount = results.filter(Boolean).length;
  console.log(`📊 [SPLIT] Valid results: ${validCount}/${totalFiles} files`);

  logInfo(`Merging ${results.filter(Boolean).length} loaded split files`);
  const validResults = results.filter(r => r !== undefined);

  console.log('🔄 [SPLIT] Updating progress to merging phase...');
  setProgress(0.95, 'Merging tree data...');

  // Sort by index to maintain order
  console.log('🔢 [SPLIT] Sorting results by index...');
  validResults.sort((a, b) => a.index - b.index);

  // Determine schema type: structured nodes vs nested map
  console.log('🔍 [SPLIT] Analyzing data structure...');
  const isStructuredNode = obj => obj && typeof obj === 'object' && (Object.prototype.hasOwnProperty.call(obj, 'children') || Object.prototype.hasOwnProperty.call(obj, 'name'));

  const anyStructured = validResults.some(r => isStructuredNode(r.chunk));
  console.log(`📋 [SPLIT] Data structure: ${anyStructured ? 'structured nodes' : 'nested map'}`);

  let mergedTree;
  if (anyStructured) {
    // Structured nodes: collect children
    console.log('🧬 [SPLIT] Merging structured nodes...');
    logDebug('Split files contained structured nodes; merging children arrays');
    mergedTree = { name: 'Life', level: 0, children: [] };

    let totalChildren = 0;
    for (const { chunk } of validResults) {
      if (chunk && Array.isArray(chunk.children)) {
        console.log(`➕ [SPLIT] Adding ${chunk.children.length} children from chunk`);
        mergedTree.children.push(...chunk.children);
        totalChildren += chunk.children.length;
      } else if (isStructuredNode(chunk)) {
        console.log('➕ [SPLIT] Adding single structured node');
        mergedTree.children.push(chunk);
        totalChildren += 1;
      }
    }
    console.log(`📊 [SPLIT] Total children after merge: ${totalChildren}`);
  } else {
    // Nested key map: deep-merge all object chunks
    console.log('🗺️ [SPLIT] Performing deep merge of nested maps...');
    logDebug('Split files contained nested maps; performing deep merge');

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

    console.log('🔄 [SPLIT] Starting deep merge process...');
    const mergedMap = {};
    let mergeOperations = 0;
    for (const { chunk } of validResults) {
      deepMerge(mergedMap, chunk);
      mergeOperations++;
      console.log(`🔗 [SPLIT] Merged chunk ${mergeOperations}/${validResults.length}`);
    }

    console.log('🧬 [SPLIT] Converting merged map to structured tree...');
    // Normalize will convert nested map to structured nodes
    const normalizedTree = normalizeTree(mergedMap);
    console.log(`🌳 [SPLIT] Tree normalized, starting indexing...`);

    await indexTreeProgressive(normalizedTree);
    setDataRoot(normalizedTree);
    setProgress(1, `Loaded ${manifest.total_nodes?.toLocaleString() || 'many'} nodes from ${manifest.total_files} files`);

    const splitTotalDuration = performance.now() - splitStartTime;
    console.log(`🎉 [SPLIT] loadFromSplitFiles completed successfully in ${splitTotalDuration.toFixed(2)}ms`);
    return;
  }

  console.log('🔄 [SPLIT] Updating progress to final processing...');
  setProgress(0.98, 'Processing merged tree...');

  // Process the merged tree
  console.log('🧬 [SPLIT] Normalizing merged tree structure...');
  const normalizedTree = normalizeTree(mergedTree);

  console.log('🔍 [SPLIT] Starting tree indexing...');
  await indexTreeProgressive(normalizedTree);

  console.log('💾 [SPLIT] Setting data root...');
  setDataRoot(normalizedTree);

  console.log('📊 [SPLIT] Counting final node total...');
  const nodeCount = countNodes(normalizedTree);

  console.log(`📈 [SPLIT] Final statistics: ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
  setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
  logInfo(`Split dataset loaded with ${nodeCount} nodes`);

  const splitTotalDuration = performance.now() - splitStartTime;
  console.log(`🎊 [SPLIT] loadFromSplitFiles COMPLETED in ${splitTotalDuration.toFixed(2)}ms`);
  console.log('📋 [SPLIT] Summary:', {
    totalFiles,
    successfulFiles: completed,
    failedFiles: failed,
    finalNodeCount: nodeCount,
    totalDuration: splitTotalDuration.toFixed(2) + 'ms'
  });
}
