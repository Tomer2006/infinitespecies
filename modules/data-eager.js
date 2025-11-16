// Eager loading functionality for taxonomy tree data
import { state } from './state.js';
import { computeFetchConcurrency, perf } from './settings.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { setProgress } from './loading.js';
import { updateNavigation } from './navigation.js';
import { mapToChildren, normalizeTree, indexTreeProgressive, loadFromJSONText, setDataRoot } from './data-common.js';

const maxRetries = perf.loading.maxRetries;
const retryBaseDelayMs = perf.loading.retryBaseDelayMs;

// ============================================================================
// EAGER LOADING FUNCTIONS
// ============================================================================

// Eager loading: loads everything at once
export async function loadEager(url) {
  if (!url) throw new Error('No URL provided');

  state.loadMode = 'eager';
  logInfo(`Loading data eagerly from ${url}`);

  // Check if this is a split dataset by looking for manifest.json
  const manifestUrl = url.replace(/[^/]*$/, 'manifest.json');
  const baseUrl = url.replace(/[^/]*$/, '');

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
  const totalFiles = Array.isArray(manifest.files) ? manifest.files.length : (manifest.total_files || 0);
  
  logInfo(`Loading split dataset from ${baseUrl} (${totalFiles} files)`);
  
  setProgress(0, `Loading ${totalFiles} split files...`);

  const concurrency = Math.max(computeFetchConcurrency(), 8);
  let completed = 0;
  let failed = 0;
  const results = new Array(manifest.files.length);
  const progressUpdateInterval = Math.max(1, Math.floor(totalFiles / 20));

  const loadFileWithRetry = async (fileInfo, index, retryCount = 0) => {
    const fileUrl = baseUrl + fileInfo.filename;

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

      const chunk = await res.json();
      results[index] = { index, chunk, fileInfo };
      completed++;

      if (completed % progressUpdateInterval === 0 || completed === totalFiles) {
        setProgress(completed / totalFiles, `Loaded ${completed}/${totalFiles} files...`);
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
  await new Promise((resolve) => {
    let inFlight = 0;
    let nextIndex = 0;

    const startNext = () => {
      while (inFlight < concurrency && nextIndex < manifest.files.length) {
        const i = nextIndex++;
        inFlight++;
        const fileInfo = manifest.files[i];

        loadFileWithRetry(fileInfo, i).finally(() => {
          inFlight--;
          if (completed + failed === totalFiles) {
            if (failed > 0) {
              logWarn(`Completed loading with ${failed} failed files out of ${totalFiles}`);
            }
            resolve();
          } else {
            startNext();
          }
        });
      }
    };

    startNext();
  });

  const validResults = results.filter(r => r !== undefined);
  logInfo(`Merging ${validResults.length} loaded split files`);
  setProgress(0.95, 'Merging tree data...');

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
    
    // Optimized deep merge: avoid recursion for better performance
    const deepMerge = (target, source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
      const entries = Object.entries(source);
      for (let i = 0; i < entries.length; i++) {
        const [k, v] = entries[i];
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
    await indexTreeProgressive(normalizedTree);
    setDataRoot(normalizedTree);
    
    const countNodes = (root) => {
      let c = 0;
      const stack = [root];
      while (stack.length) {
        const n = stack.pop();
        c++;
        const ch = Array.isArray(n.children) ? n.children : [];
        for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
      }
      return c;
    };
    
    const nodeCount = countNodes(normalizedTree);
    setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
    logInfo(`Split dataset loaded with ${nodeCount} nodes`);
    
    const duration = performance.now() - startTime;
    logDebug(`Split loading completed in ${duration.toFixed(0)}ms`);
    return;
  }

  setProgress(0.98, 'Processing merged tree...');
  const normalizedTree = normalizeTree(mergedTree);
  await indexTreeProgressive(normalizedTree);
  setDataRoot(normalizedTree);

  const countNodes = (root) => {
    let c = 0;
    const stack = [root];
    while (stack.length) {
      const n = stack.pop();
      c++;
      const ch = Array.isArray(n.children) ? n.children : [];
      for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
    }
    return c;
  };
  const nodeCount = countNodes(normalizedTree);
  setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
  logInfo(`Split dataset loaded with ${nodeCount} nodes`);
  
  const duration = performance.now() - startTime;
  logDebug(`Split loading completed in ${duration.toFixed(0)}ms`);
}