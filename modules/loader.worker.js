/**
 * Web Worker for data loading and layout computation
 * 
 * Handles fetching, parsing, normalizing, and calculating layout for the taxonomy tree
 * off the main thread to prevent UI freezing. Supports both single JSON and split-file manifests.
 */

import { pack as d3pack, hierarchy as d3hierarchy } from 'https://cdn.jsdelivr.net/npm/d3-hierarchy@3/+esm';

// Configuration
const CHUNK_MS = 20;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 30000;
const CONCURRENCY = 8;

// ============================================================================
// HELPERS
// ============================================================================

function mapToChildren(obj) {
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

function normalizeTree(rootLike) {
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

function detectFileFormat(url) {
    const lower = url.toLowerCase();
    if (lower.endsWith('.json')) return 'json';
    return 'unknown';
}

async function parseDataResponse(res, format) {
    return res.json();
}

function deepMerge(target, source) {
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
}

// Progressive indexing that yields to event loop
async function indexTree(root) {
    let globalId = 1;
    const stack = [{ node: root, parent: null, depth: 0 }];
    let processed = 0;
    const total = Math.max(1, countNodes(root));
    let lastYield = performance.now();

    const essentialKeys = new Set([
        'name', 'children', 'level', 'parent', '_id',
        '_vx', '_vy', '_vr', '_leaves'
    ]);

    while (stack.length) {
        const now = performance.now();
        if (now - lastYield >= CHUNK_MS) {
            postMessage({ type: 'progress', percent: processed / total, message: `Indexing... ${processed.toLocaleString()}/${total.toLocaleString()}` });
            await new Promise(r => setTimeout(r, 0));
            lastYield = performance.now();
        }

        const { node, parent, depth } = stack.pop();
        if (node == null || typeof node !== 'object') continue;

        node.name = String(node.name ?? 'Unnamed');
        if (node.name.length > 100) node.name = node.name.slice(0, 100);
        node.level = depth;
        node._id = globalId++;

        if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];

        const keysToDelete = [];
        for (const k in node) {
            if (!essentialKeys.has(k) && Object.prototype.hasOwnProperty.call(node, k)) {
                keysToDelete.push(k);
            }
        }
        for (let i = 0; i < keysToDelete.length; i++) {
            delete node[keysToDelete[i]];
        }

        if (node.children.length === 0) {
            node.children = [];
        }
        for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push({ node: node.children[i], parent: null, depth: depth + 1 });
        }
        processed++;
    }

    postMessage({ type: 'progress', percent: 0.95, message: 'Computing descendant counts...' });
    computeDescendantCountsIter(root);
    return globalId;
}

function computeLayout(root, width, height) {
    const pack = d3pack().size([width, height]).padding(0);
    const h = d3hierarchy(root)
        .sum(d => (d.children && d.children.length > 0) ? 0 : 1)
        .sort((a, b) => b.value - a.value);

    pack(h);

    const cx = width / 2;
    const cy = height / 2;
    let count = 0;

    h.each(d => {
        d.data._vx = d.x - cx;
        d.data._vy = d.y - cy;
        d.data._vr = d.r;
        d.data.depth = d.depth;
        count++;
    });

    return { root: h.data, count };
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

self.onmessage = async (e) => {
    const { type, url, baseUrl, manifest, canvasW, canvasH } = e.data;

    if (type === 'load') {
        try {
            postMessage({ type: 'progress', percent: 0, message: 'Fetching data...' });
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to fetch ${url}`);

            postMessage({ type: 'progress', percent: 0.1, message: 'Parsing JSON...' });
            const text = await res.text();
            const data = JSON.parse(text);

            await processData(data, canvasW, canvasH);
        } catch (err) {
            postMessage({ type: 'error', error: err.message });
        }
    }
    else if (type === 'loadSplit') {
        try {
            await loadSplitFiles(baseUrl, manifest, canvasW, canvasH);
        } catch (err) {
            postMessage({ type: 'error', error: err.message });
        }
    }
};

async function processData(data, w, h) {
    postMessage({ type: 'progress', percent: 0.3, message: 'Normalizing tree...' });
    const root = normalizeTree(data);

    postMessage({ type: 'progress', percent: 0.4, message: 'Indexing tree...' });
    await indexTree(root);

    postMessage({ type: 'progress', percent: 0.8, message: 'Computing global layout...' });
    const dim = Math.min(w || 1000, h || 1000);
    const { root: layoutRoot, count } = computeLayout(root, dim, dim);

    postMessage({
        type: 'complete',
        data: layoutRoot,
        stats: { nodes: count }
    });
}

async function loadSplitFiles(baseUrl, manifest, w, h) {
    const totalFiles = manifest.files.length;
    postMessage({ type: 'progress', percent: 0, message: `Loading ${totalFiles} split files...` });

    let completed = 0;
    let failed = 0;
    const results = new Array(totalFiles);

    const loadFileWithRetry = async (fileInfo, index, retryCount = 0) => {
        const fileUrl = baseUrl + fileInfo.filename;
        const format = detectFileFormat(fileInfo.filename);

        try {
            const res = await fetch(fileUrl, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
            });
            if (!res.ok) throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);

            const chunk = await parseDataResponse(res, format);
            results[index] = { index, chunk };
            completed++;

            // Post occasional progress
            if (completed % 5 === 0 || completed === totalFiles) {
                postMessage({ type: 'progress', percent: (completed / totalFiles) * 0.5, message: `Loaded ${completed}/${totalFiles} files...` });
            }
            return true;
        } catch (err) {
            if (retryCount < MAX_RETRIES) {
                const delay = Math.pow(2, retryCount) * RETRY_BASE_DELAY_MS;
                await new Promise(r => setTimeout(r, delay));
                return loadFileWithRetry(fileInfo, index, retryCount + 1);
            } else {
                failed++;
                return false;
            }
        }
    };

    // Parallel fetch loop
    let inFlight = 0;
    let nextIndex = 0;

    await new Promise(resolve => {
        const checkCompletion = () => {
            if (completed + failed === totalFiles) resolve();
        };
        const startNext = () => {
            while (inFlight < CONCURRENCY && nextIndex < totalFiles) {
                const i = nextIndex++;
                inFlight++;
                loadFileWithRetry(manifest.files[i], i).finally(() => {
                    inFlight--;
                    checkCompletion();
                    if (completed + failed < totalFiles) startNext();
                });
            }
        };
        startNext();
    });

    if (failed > 0 && results.filter(r => r).length === 0) {
        throw new Error(`Failed to load split files (${failed} failed)`);
    }

    postMessage({ type: 'progress', percent: 0.5, message: 'Merging split data...' });

    const validResults = results.filter(r => r !== undefined).sort((a, b) => a.index - b.index);

    const hasOwnProperty = Object.prototype.hasOwnProperty;
    const isStructuredNode = obj => obj && typeof obj === 'object' && (hasOwnProperty.call(obj, 'children') || hasOwnProperty.call(obj, 'name'));
    const anyStructured = validResults.some(r => isStructuredNode(r.chunk));

    let mergedTree;
    if (anyStructured) {
        mergedTree = { name: 'Life', level: 0, children: [] };
        for (const { chunk } of validResults) {
            if (chunk && Array.isArray(chunk.children)) {
                mergedTree.children.push(...chunk.children);
            } else if (isStructuredNode(chunk)) {
                mergedTree.children.push(chunk);
            }
        }
    } else {
        const mergedMap = {};
        for (const { chunk } of validResults) {
            deepMerge(mergedMap, chunk);
        }
        mergedTree = mergedMap; // Will be normalized next
    }

    await processData(mergedTree, w, h);
}
