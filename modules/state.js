// Shared state and indexes

export const state = {
  DATA_ROOT: null,
  current: null,
  layout: null,
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

  // dataset/manifest info for on-demand loading
  datasetBaseUrl: '',
  datasetManifest: null,
  currentLoadedPath: 'Life'
};

export function clearIndex() {
  state.globalId = 1;
}

export function registerNode(node) {
  // Minimal registration retained for id assignment only
}

export function rebuildNodeMap() {
  state.nodeLayoutMap.clear();
  if (!state.layout?.root) return;
  const desc = state.layout.root.descendants();
  desc.forEach(d => state.nodeLayoutMap.set(d.data._id, d));
  // Precompute orders
  // Draw largest circles first, then smaller on top for clarity
  // Draw larger circles first for background fill, then smaller on top.
  // For root-level performance, pre-filter out very tiny nodes that would not be drawn.
  state.drawOrder = desc
    .slice()
    .sort((a, b) => b._vr - a._vr);
  state.pickOrder = desc.slice().sort((a, b) => b.depth - a.depth);
}


