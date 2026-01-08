/**
 * Node picking and viewport culling module
 *
 * Handles mouse-to-node collision detection for interactive selection.
 * Uses the same visibility checks as the render module to ensure
 * only visible nodes can be picked.
 */

import { W, H } from './canvas.js';
import { state } from './state.js';
import { perf } from './settings.js';
import { isNodeVisible } from './render.js';

export function pickNodeAt(px, py) {
  const nodes = state.pickOrder && state.pickOrder.length ? state.pickOrder : (state.layout && state.layout.root ? state.layout.root.descendants().slice().sort((a, b) => b.depth - a.depth) : []);
  const wx = state.camera.x + (px - W / 2) / state.camera.k;
  const wy = state.camera.y + (py - H / 2) / state.camera.k;
  
  const { pickMinPxRadius } = perf.rendering;
  
  for (const d of nodes) {
    // Use shared visibility check from render module
    if (!isNodeVisible(d)) continue;
    
    // Additional check: reject nodes that are too small to interact with
    const screenR = d._vr * state.camera.k;
    if (screenR < (pickMinPxRadius || 0)) continue;
    
    const dx = wx - d._vx,
      dy = wy - d._vy;
    if (dx * dx + dy * dy <= d._vr * d._vr) return d.data;
  }
  return null;
}
