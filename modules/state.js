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
  // cached orders for performance
  drawOrder: [], // hierarchy nodes sorted by radius for drawing
  pickOrder: [],  // hierarchy nodes sorted by depth for picking (deepest first)

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
  const desc = state.layout.root.descendants();
  desc.forEach(d => state.nodeLayoutMap.set(d.data._id, d));
  // Precompute orders
  // Draw largest circles first, then smaller on top for clarity
  state.drawOrder = desc.slice().sort((a, b) => b._vr - a._vr);
  state.pickOrder = desc.slice().sort((a, b) => b.depth - a.depth);
}


