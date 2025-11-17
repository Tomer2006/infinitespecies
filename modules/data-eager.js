// Eager loading functionality for taxonomy tree data
import { state } from './state.js';
import { computeFetchConcurrency, perf } from './settings.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { setProgress } from './loading.js';
import { updateNavigation } from './navigation.js';
import { mapToChildren, normalizeTree, indexTreeProgressive, loadFromJSONText, setDataRoot, countNodes } from './data-common.js';

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
  
  // Validate manifest structure
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid manifest: must be an object');
  }
  
  if (!Array.isArray(manifest.files)) {
    if (manifest.total_files && manifest.total_files > 0) {
      throw new Error(`Invalid manifest: files array is missing but total_files is ${manifest.total_files}. Manifest must include a 'files' array.`);
    }
    throw new Error('Invalid manifest: missing required "files" array');
  }
  
  if (manifest.files.length === 0) {
    throw new Error('Invalid manifest: files array is empty');
  }
  
  const totalFiles = manifest.files.length;
  
  logInfo(`Loading split dataset from ${baseUrl} (${totalFiles} files)`);
  
  setProgress(0, `Loading ${totalFiles} split files...`);

  const concurrency = Math.max(computeFetchConcurrency(), 8);
  let completed = 0;
  let failed = 0;
  const results = new Array(manifest.files.length);
  const progressUpdateInterval = Math.max(1, Math.floor(totalFiles / 20));
  
  // Pre-format total for progress messages to avoid repeated toLocaleString calls
  const totalFormatted = totalFiles.toLocaleString();

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
        setProgress(completed / totalFiles, `Loaded ${completed}/${totalFormatted} files...`);
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
  // Use atomic counter to prevent race conditions
  let resolved = false;
  await new Promise((resolve) => {
    let inFlight = 0;
    let nextIndex = 0;

    const checkCompletion = () => {
      // Use atomic check to prevent race conditions
      if (resolved) return;
      if (completed + failed === totalFiles) {
        resolved = true;
        if (failed > 0) {
          logWarn(`Completed loading with ${failed} failed files out of ${totalFiles}`);
        }
        resolve();
      }
    };

    const startNext = () => {
      while (inFlight < concurrency && nextIndex < manifest.files.length) {
        const i = nextIndex++;
        inFlight++;
        const fileInfo = manifest.files[i];

        loadFileWithRetry(fileInfo, i).finally(() => {
          inFlight--;
          checkCompletion();
          if (!resolved) {
            startNext();
          }
        });
      }
    };

    startNext();
  });

  const validResults = results.filter(r => r !== undefined);
  
  // Check if we have any valid results before proceeding
  if (validResults.length === 0) {
    const errorMsg = `Failed to load any files from split dataset (${totalFiles} files attempted, ${failed} failed)`;
    logError(errorMsg);
    throw new Error(errorMsg);
  }
  
  logInfo(`Merging ${validResults.length} loaded split files`);
  setProgress(perf.indexing.progressMergePercent, 'Merging tree data...');

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
    
    // Optimized deep merge: minimize allocations, avoid Object.entries
    const deepMerge = (target, source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
      for (const k in source) {
        if (!Object.prototype.hasOwnProperty.call(source, k)) continue;
        const v = source[k];
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
    const nodeCount = await indexTreeProgressive(normalizedTree);
    setDataRoot(normalizedTree);
    
    setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
    logInfo(`Split dataset loaded with ${nodeCount} nodes`);
    
    const duration = performance.now() - startTime;
    logDebug(`Split loading completed in ${duration.toFixed(0)}ms`);
    return;
  }

  setProgress(perf.indexing.progressProcessPercent, 'Processing merged tree...');
  const normalizedTree = normalizeTree(mergedTree);
  const nodeCount = await indexTreeProgressive(normalizedTree);
  setDataRoot(normalizedTree);

  setProgress(1, `Loaded ${nodeCount.toLocaleString()} nodes from ${totalFiles} files`);
  logInfo(`Split dataset loaded with ${nodeCount} nodes`);
  
  const duration = performance.now() - startTime;
  logDebug(`Split loading completed in ${duration.toFixed(0)}ms`);
}