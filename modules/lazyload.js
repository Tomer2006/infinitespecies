import { state } from './state.js';
import { findByQuery } from './search.js';
import { mapToChildren } from './data.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap } from './state.js';
import { requestRender, W, H } from './canvas.js';
import { computeFetchConcurrency } from './performance.js';
import { findNodeByPath } from './deeplink.js';

function deepMerge(target, source) {
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
}

function getManifestPartsForPath(pathStr) {
  if (!state.datasetManifest) return [];
  const parts = [];
  for (const f of state.datasetManifest.files) {
    if (!f.path) continue;
    // Match exact logical path with _part_N suffix
    if (f.path.startsWith(pathStr + '_part_')) parts.push(f);
  }
  return parts;
}

async function fetchParts(parts) {
  const base = state.datasetBaseUrl || 'data/';
  const concurrency = computeFetchConcurrency();
  const out = [];
  let inFlight = 0;
  let idx = 0;
  await new Promise((resolve, reject) => {
    const next = () => {
      while (inFlight < concurrency && idx < parts.length) {
        const p = parts[idx++];
        inFlight++;
        fetch(base + p.filename, { cache: 'force-cache' })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${p.filename}`);
            return res.json();
          })
          .then(json => {
            out.push({ meta: p, json });
          })
          .then(() => {
            inFlight--;
            if (out.length === parts.length) resolve();
            else next();
          })
          .catch(err => reject(err));
      }
    };
    next();
  });
  return out;
}

function getNestedAtPath(rootMap, pathStr) {
  const segs = pathStr.split('/').filter(Boolean);
  let cur = rootMap;
  for (const seg of segs) {
    if (cur && typeof cur === 'object') cur = cur[seg];
    else return null;
  }
  return cur || null;
}

function indexSubtree(structuredNode, parent, startDepth) {
  // Assign parent, level, ids; then compute _leaves bottom-up
  const stack = [{ n: structuredNode, p: parent, d: startDepth }];
  const post = [];
  while (stack.length) {
    const { n, p, d } = stack.pop();
    if (!n || typeof n !== 'object') continue;
    n.parent = p || null;
    n.level = d;
    n._id = state.globalId++;
    if (!Array.isArray(n.children)) n.children = n.children ? [].concat(n.children) : [];
    for (let i = n.children.length - 1; i >= 0; i--) stack.push({ n: n.children[i], p: n, d: d + 1 });
    post.push(n);
  }
  for (let i = post.length - 1; i >= 0; i--) {
    const n = post[i];
    const ch = n.children || [];
    n._leaves = ch.length ? ch.reduce((s, c) => s + (c._leaves || 1), 0) : 1;
  }
}

function attachLazyStubs(node, pathPrefix, pathToFiles) {
  if (!Array.isArray(node.children)) node.children = [];
  const prefix = pathPrefix ? pathPrefix : node.name;
  const hasParts = [...pathToFiles.keys()].some(p => p === prefix || p.startsWith(prefix + '/'));
  if (hasParts) node._lazyPath = prefix;
  for (const ch of node.children) attachLazyStubs(ch, prefix + '/' + ch.name, pathToFiles);
}

export async function loadClosestPathSubtree(pathStr) {
  if (!state.datasetManifest || !state.datasetBaseUrl) return;
  // Find closest path that has manifest parts
  const segs = pathStr.split('/').filter(Boolean);
  let best = '';
  for (let i = segs.length; i >= 1; i--) {
    const cand = segs.slice(0, i).join('/');
    const parts = getManifestPartsForPath(cand);
    if (parts && parts.length) { best = cand; break; }
  }
  if (!best) return;
  const parts = getManifestPartsForPath(best);
  const fetched = await fetchParts(parts);
  // Merge maps
  const mergedMap = {};
  for (const { json } of fetched) deepMerge(mergedMap, json);
  // Extract subtree at best path
  const nested = getNestedAtPath(mergedMap, best);
  if (!nested || typeof nested !== 'object') return;
  const structured = { name: segs[segs.length - 1] || 'Life', children: mapToChildren(nested) };

  // Find target node in current tree
  const target = findNodeByPath(best);
  if (!target) return;
  // Replace children
  target.children = structured.children;
  // Index subtree under target
  for (const ch of target.children) indexSubtree(ch, target, (target.level || 0) + 1);

  // Re-attach lazy flags under the loaded subtree
  const pathToFiles = new Map(state.datasetManifest.files.map(f => [String(f.path || ''), f.filename]));
  for (const ch of target.children) attachLazyStubs(ch, best + '/' + ch.name, pathToFiles);

  // Rebuild layout from current node to keep visual consistent
  state.layout = layoutFor(state.current);
  rebuildNodeMap();
  state.currentLoadedPath = best;
  requestRender();
}


