/**
 * Global application state management module
 *
 * Centralizes all application state including current navigation position,
 * layout data, camera settings, hover states, and data loading status.
 * Provides node mapping and layout indexing utilities for efficient lookups.
 */

export const state = {
  DATA_ROOT: null,
  current: null,
  layout: null,
  rootLayout: null, // Cached global layout for Eager mode
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
  loadMode: 'eager', // 'eager' or 'lazy'

  // lazy loading state
  lazyManifest: null,
  loadedChunks: new Map(), // filename -> chunk data
  lazyBaseUrl: 'data lazy',
  lazyPathToChunk: new Map(),   // path string -> primary chunk filename (for backward compat)
  lazyPathToChunks: new Map(),  // path string -> array of chunk filenames (for full merges)
};

export function rebuildNodeMap() {
  state.nodeLayoutMap.clear();
  if (!state.layout?.root) return;
  const desc = state.layout.root.descendants();
  desc.forEach(d => state.nodeLayoutMap.set(d.data._id, d));
  // Precompute pick order: deepest nodes first for accurate picking
  state.pickOrder = desc.slice().sort((a, b) => b.depth - a.depth);
}


