import { state } from './state.js';
import { loadClosestPathSubtree } from './data.js';

export function getNodePath(node) {
  const names = [];
  let p = node;
  while (p) {
    names.unshift(String(p.name));
    p = p.parent;
  }
  return names;
}

export function encodePath(pathStr) {
  return encodeURIComponent(pathStr);
}

export function decodePath(hash) {
  try {
    return decodeURIComponent(hash || '');
  } catch (_e) {
    return hash || '';
  }
}

export function updateDeepLinkFromNode(node) {
  const path = getNodePath(node).join('/');
  const newHash = path ? `#${encodePath(path)}` : '';
  if (location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

export function findNodeByPath(pathStr) {
  const parts = pathStr.split('/').filter(Boolean);
  if (!parts.length || !state.DATA_ROOT) return state.DATA_ROOT;
  let node = state.DATA_ROOT;
  for (let i = 1; i < parts.length; i++) {
    const name = parts[i];
    const child = (node.children || []).find(c => String(c.name) === name);
    if (!child) {
      // Attempt to lazy-load deeper subtree if available in manifest
      if (state.datasetManifest && state.datasetBaseUrl) {
        // Load closest subtree for the partial path up to i
        const subPath = parts.slice(0, i + 1).join('/');
        // Fire-and-forget; caller can navigate after load
        loadClosestPathSubtree(subPath).catch(() => {});
      }
      break;
    }
    node = child;
  }
  return node;
}


