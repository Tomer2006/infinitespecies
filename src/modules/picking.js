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
    
    // Point-in-circle check
    const dx = wx - d._vx,
      dy = wy - d._vy;
    if (dx * dx + dy * dy <= d._vr * d._vr) return d.data;
  }
  return null;
}
