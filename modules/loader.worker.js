/**
 * Web Worker for data loading and layout computation
 * 
 * Handles fetching, parsing, normalizing, and calculating layout for the taxonomy tree
 * off the main thread to prevent UI freezing.
 */

import { pack as d3pack, hierarchy as d3hierarchy } from 'https://cdn.jsdelivr.net/npm/d3-hierarchy@3/+esm';

// Configuration (mirroring settings.js where relevant)
const CHUNK_MS = 20;

// ============================================================================
// LOGIC COPIED/ADAPTED FROM data-common.js and layout.js
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

// Progressive indexing that yields to event loop (internal to worker)
// Even inside a worker, we might want to yield to allow 'progress' messages to be posted
async function indexTree(root) {
    let globalId = 1;
    const stack = [{ node: root, parent: null, depth: 0 }];
    let processed = 0;
    const total = Math.max(1, countNodes(root));
    let lastYield = performance.now();

    // Essential keys to keep
    const essentialKeys = new Set([
        'name', 'children', 'level', 'parent', '_id',
        '_vx', '_vy', '_vr', '_leaves'
    ]);

    while (stack.length) {
        const now = performance.now();
        if (now - lastYield >= CHUNK_MS) {
            // Report progress
            postMessage({ type: 'progress', percent: processed / total, message: `Indexing... ${processed.toLocaleString()}/${total.toLocaleString()}` });
            await new Promise(r => setTimeout(r, 0));
            lastYield = performance.now();
        }

        const { node, parent, depth } = stack.pop();
        if (node == null || typeof node !== 'object') continue;

        node.name = String(node.name ?? 'Unnamed');
        if (node.name.length > 100) node.name = node.name.slice(0, 100);
        node.level = depth;
        // We don't need actual parent references for the layout calculation itself in D3 v4+, 
        // but we might want them for the main thread. 
        // However, passing circular structures (parent pointers) back from Worker via postMessage 
        // causes DataCloneError if we aren't careful.
        // D3 hierarchy will re-create parent pointers. 
        // Let's strip them here or handle them carefully. 
        // Actually, for D3 pack, we just need the hierarchy structure.
        // We will let D3 build the hierarchy.

        node._id = globalId++;

        if (!Array.isArray(node.children)) node.children = node.children ? [].concat(node.children) : [];

        // Cleanup keys
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

// Layout logic
function computeLayout(root, width, height) {
    const pack = d3pack().size([width, height]).padding(0);

    const h = d3hierarchy(root)
        .sum(d => (d.children && d.children.length > 0) ? 0 : 1)
        .sort((a, b) => b.value - a.value);

    pack(h);

    // Extract only the necessary layout data to send back
    // We want to return the modified root with _vx, _vy, _vr attached
    // But d3 hierarchy creates a wrapper. We need to sync it back to the data or return the wrapper data.
    // The 'data-common.js' logic used `h.each(d => { d._vx = ... })` but `d` there was the hierarchy node.
    // We need to mutate the underlying data objects or return a structure that the main thread can use.

    const cx = width / 2;
    const cy = height / 2;

    const layoutMap = {};

    let count = 0;
    h.each(d => {
        // Attach layout props to the raw data object
        d.data._vx = d.x - cx;
        d.data._vy = d.y - cy;
        d.data._vr = d.r;
        d.data.depth = d.depth; // Update depth from d3
        count++;
    });

    return { root: h.data, count };
}


// ============================================================================
// MESSAGE HANDLER
// ============================================================================

self.onmessage = async (e) => {
    const { type, url, canvasW, canvasH } = e.data;

    if (type === 'load') {
        try {
            postMessage({ type: 'progress', percent: 0, message: 'Fetching data...' });

            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to fetch ${url}`);

            // Determine size for progress (approximate)
            const contentLength = res.headers.get('content-length');
            const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

            postMessage({ type: 'progress', percent: 0.1, message: 'Parsing JSON...' });

            const text = await res.text();
            const data = JSON.parse(text);

            postMessage({ type: 'progress', percent: 0.3, message: 'Normalizing tree...' });
            const root = normalizeTree(data);

            postMessage({ type: 'progress', percent: 0.4, message: 'Indexing tree...' });
            await indexTree(root);

            postMessage({ type: 'progress', percent: 0.8, message: 'Computing global layout...' });
            // Use a fixed large dimension for layout; the generic logic uses min(W,H)
            // We'll use the passed canvas dimensions or a default
            const dim = Math.min(canvasW || 1000, canvasH || 1000);
            const { root: layoutRoot, count } = computeLayout(root, dim, dim);

            postMessage({
                type: 'complete',
                data: layoutRoot,
                stats: { nodes: count }
            });

        } catch (err) {
            postMessage({ type: 'error', error: err.message });
        }
    }
};
