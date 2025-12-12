/**
 * Eager data loading module
 *
 * Handles loading of complete taxonomy datasets at application startup.
 * Supports both single JSON files and split-file manifests with parallel
 * downloading and retry logic for reliability.
 */

import { state } from './state.js';
import { computeFetchConcurrency, perf } from './settings.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';
import { setProgress } from './loading.js';
import { updateNavigation } from './navigation.js';
import { mapToChildren, normalizeTree, indexTreeProgressive, loadFromJSONText, setDataRoot, countNodes } from './data-common.js';


/**
 * Detects file format from URL or filename
 * @param {string} url - File URL or filename
 * @returns {'json'|'unknown'}
 */
function detectFileFormat(url) {
  const lower = url.toLowerCase();
  if (lower.endsWith('.json')) {
    return 'json';
  }
  return 'unknown';
}

/**
 * Parses JSON data from response
 * @param {Response} res - Fetch response
 * @returns {Promise<any>}
 */
async function parseDataResponse(res) {
  return res.json();
}

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

  // Single file loading with Web Worker
  logInfo(`Loading single JSON file eagerly using Web Worker from ${url}`);

  return new Promise((resolve, reject) => {
    const worker = new Worker('modules/loader.worker.js', { type: 'module' });

    // Cleanup function
    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (e) => {
      const { type, percent, message, data, error, stats } = e.data;

      if (type === 'progress') {
        setProgress(percent, message);
      } else if (type === 'complete') {
        logInfo(`Worker finished loading ${stats?.nodes} nodes`);
        // The worker returns the processed root with layout data (_vx, _vy, _vr)
        // We need to integrate this into the main thread state

        // We need to re-establish parent pointers because they don't survive postMessage (JSON/StructuredClone)
        // A quick traversal to fix parents
        const root = data;
        const stack = [root];
        while (stack.length) {
          const n = stack.pop();
          if (n.children) {
            for (const child of n.children) {
              child.parent = n;
              stack.push(child);
            }
          }
        }

        // Initialize state
        setDataRoot(root);
        cleanup();
        resolve();
      } else if (type === 'error') {
        logError(`Worker error: ${error}`);
        cleanup();
        reject(new Error(error));
      }
    };

    worker.onerror = (err) => {
      logError('Worker script error', err);
      cleanup();
      reject(err);
    };

    // Start the worker
    import('./canvas.js').then(({ W, H }) => {
      worker.postMessage({
        type: 'load',
        url,
        canvasW: W,
        canvasH: H
      });
    });
  });
}

async function loadFromSplitFiles(baseUrl, manifest) {
  logInfo(`Loading split dataset from ${baseUrl} using Web Worker`);

  return new Promise((resolve, reject) => {
    const worker = new Worker('modules/loader.worker.js', { type: 'module' });

    const cleanup = () => worker.terminate();

    worker.onmessage = (e) => {
      const { type, percent, message, data, error, stats } = e.data;

      if (type === 'progress') {
        setProgress(percent, message);
      } else if (type === 'complete') {
        logInfo(`Worker finished loading split dataset: ${stats?.nodes} nodes`);

        // Reconstruct parent pointers
        const root = data;
        const stack = [root];
        while (stack.length) {
          const n = stack.pop();
          if (n.children) {
            for (const child of n.children) {
              child.parent = n;
              stack.push(child);
            }
          }
        }

        setDataRoot(root);
        cleanup();
        resolve();
      } else if (type === 'error') {
        logError(`Worker error: ${error}`);
        cleanup();
        reject(new Error(error));
      }
    };

    worker.onerror = (err) => {
      logError('Worker script error', err);
      cleanup();
      reject(err);
    };

    import('./canvas.js').then(({ W, H }) => {
      worker.postMessage({
        type: 'loadSplit',
        baseUrl,
        manifest,
        canvasW: W,
        canvasH: H
      });
    });
  });
}