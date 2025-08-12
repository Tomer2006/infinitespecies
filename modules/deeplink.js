/* Deep Link Management */
import { DATA_ROOT } from './state.js';

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
  } catch (_) { 
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
  if (!parts.length || !DATA_ROOT) return DATA_ROOT;
  let node = DATA_ROOT;
  for (let i = 1; i < parts.length; i++) { // skip root name
    const name = parts[i];
    const child = (node.children || []).find(c => String(c.name) === name);
    if (!child) break; 
    node = child;
  }
  return node;
}
