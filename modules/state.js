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

  // hover
  hoverNode: null,

  // layout map
  nodeLayoutMap: new Map(),
  // cached orders for performance
  pickOrder: [],  // hierarchy nodes sorted by depth for picking (deepest first)

  // layout change tracking
  layoutChanged: false,

  // data loading state
  loadMode: 'eager', // Always eager loading
};

export function rebuildNodeMap() {
  state.nodeLayoutMap.clear();
  if (!state.layout?.root) return;
  const desc = state.layout.root.descendants();
  desc.forEach(d => state.nodeLayoutMap.set(d.data._id, d));
  // Precompute pick order: deepest nodes first for accurate picking
  state.pickOrder = desc.slice().sort((a, b) => b.depth - a.depth);
}


