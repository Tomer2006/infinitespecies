/* Application State Management */
export let DATA_ROOT = null;
export let current = null;
export let layout = null;
export const allNodes = [];
export const nameIndex = new Map();
export let globalId = 1;

export let hoverNode = null;
export let highlightNode = null;
export const nodeLayoutMap = new Map();

export function setDataRoot(root) { DATA_ROOT = root; }
export function setCurrent(node) { current = node; }
export function setLayout(l) { layout = l; }
export function setHoverNode(node) { hoverNode = node; }
export function setHighlightNode(node) { highlightNode = node; }

export function clearIndex() { 
  allNodes.length = 0; 
  nameIndex.clear(); 
  globalId = 1; 
}

export function registerNode(n) {
  allNodes.push(n);
  const key = String(n.name ?? "").toLowerCase();
  if (!nameIndex.has(key)) nameIndex.set(key, []);
  nameIndex.get(key).push(n);
}

export function rebuildNodeMap() { 
  nodeLayoutMap.clear(); 
  if (layout) {
    layout.root.descendants().forEach(d => nodeLayoutMap.set(d.data._id, d)); 
  }
}
