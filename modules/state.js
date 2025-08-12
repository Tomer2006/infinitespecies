// Shared state and indexes

export const state = {
  DATA_ROOT: null,
  current: null,
  layout: null,
  allNodes: [],
  nameIndex: new Map(),
  globalId: 1,

  // camera
  camera: { x: 0, y: 0, k: 1 },
  targetCam: { x: 0, y: 0, k: 1 },
  animating: false,

  // hover/highlight
  hoverNode: null,
  highlightNode: null,

  // layout map
  nodeLayoutMap: new Map(),

  // preview pinning
  isPreviewPinned: false,
  pinnedNodeId: null
};

export function clearIndex() {
  state.allNodes.length = 0;
  state.nameIndex.clear();
  state.globalId = 1;
}

export function registerNode(node) {
  state.allNodes.push(node);
  const key = String(node.name ?? '').toLowerCase();
  if (!state.nameIndex.has(key)) state.nameIndex.set(key, []);
  state.nameIndex.get(key).push(node);
}

export function rebuildNodeMap() {
  state.nodeLayoutMap.clear();
  if (!state.layout?.root) return;
  state.layout.root.descendants().forEach(d => state.nodeLayoutMap.set(d.data._id, d));
}


