/**
 * Node picking and viewport culling module
 *
 * Handles mouse-to-node collision detection for interactive selection.
 * Uses lightweight checks for fast performance.
 */

import { viewportRadius, getFrameCounter, W, H } from './canvas.js';
import { state } from './state.js';
import { perf } from './settings.js';

let _cachedViewR = 0;
let _cachedFrame = -1;

// Fast viewport check - only uses distance from camera center
function nodeInView(d) {
  const frame = getFrameCounter();
  if (frame !== _cachedFrame) {
    _cachedViewR = viewportRadius(perf.rendering.renderDistance);
    _cachedFrame = frame;
  }
  const dx = d._vx - state.camera.x;
  const dy = d._vy - state.camera.y;
  const r = _cachedViewR + d._vr;
  return dx * dx + dy * dy <= r * r;
}

// Check if a node is within the current subtree (is state.current or a descendant of it)
export function isNodeInCurrentSubtree(nodeData) {
  if (!state.current) return true; // If no current node, allow all nodes
  
  // If the node is state.current itself, it's in the subtree
  if (nodeData._id === state.current._id) return true;
  
  // Walk up the parent chain to see if state.current is an ancestor
  let current = nodeData;
  while (current && current.parent) {
    if (current.parent._id === state.current._id) return true;
    current = current.parent;
  }
  
  return false;
}

export function pickNodeAt(px, py) {
  const nodes = state.pickOrder && state.pickOrder.length ? state.pickOrder : (state.layout && state.layout.root ? state.layout.root.descendants().slice().sort((a, b) => b.depth - a.depth) : []);
  const wx = state.camera.x + (px - W / 2) / state.camera.k;
  const wy = state.camera.y + (py - H / 2) / state.camera.k;
  
  const { pickMinPxRadius, minPxRadius } = perf.rendering;
  
  for (const d of nodes) {
    // Fast viewport check
    if (!nodeInView(d)) continue;
    
    // Skip nodes too small on screen
    const screenR = d._vr * state.camera.k;
    if (screenR < (pickMinPxRadius || 0)) continue;
    if (screenR < minPxRadius) continue;
    
    // Only pick nodes within the current subtree
    if (!isNodeInCurrentSubtree(d.data)) continue;
    
    // Point-in-circle check
    const dx = wx - d._vx,
      dy = wy - d._vy;
    if (dx * dx + dy * dy <= d._vr * d._vr) return d.data;
  }
  return null;
}

/**
 * Check if a specific node is still valid for hover (O(1) operation)
 * Used when camera changes to validate current hover without re-searching
 */
export function isNodeStillHoverable(node, px, py) {
  if (!node || !node._vx) return false;
  
  // Check if node is within the current subtree
  if (!isNodeInCurrentSubtree(node)) return false;
  
  const { pickMinPxRadius, minPxRadius } = perf.rendering;
  
  // Check screen size
  const screenR = node._vr * state.camera.k;
  if (screenR < (pickMinPxRadius || 0)) return false;
  if (screenR < minPxRadius) return false;
  
  // Check if still in viewport
  const frame = getFrameCounter();
  if (frame !== _cachedFrame) {
    _cachedViewR = viewportRadius(perf.rendering.renderDistance);
    _cachedFrame = frame;
  }
  const dx1 = node._vx - state.camera.x;
  const dy1 = node._vy - state.camera.y;
  const r = _cachedViewR + node._vr;
  if (dx1 * dx1 + dy1 * dy1 > r * r) return false;
  
  // Check if cursor is still over the node
  const wx = state.camera.x + (px - W / 2) / state.camera.k;
  const wy = state.camera.y + (py - H / 2) / state.camera.k;
  const dx2 = wx - node._vx;
  const dy2 = wy - node._vy;
  if (dx2 * dx2 + dy2 * dy2 > node._vr * node._vr) return false;
  
  return true;
}
