/**
 * Node picking and viewport culling module
 *
 * Handles mouse-to-node collision detection for interactive selection.
 * Implements efficient viewport culling to determine which nodes are
 * visible and should be considered for picking operations.
 */

import { screenToWorld, viewportRadius, getFrameCounter } from './canvas.js';
import { state } from './state.js';
import { perf } from './settings.js';

let _cachedViewR = 0;
let _cachedFrame = -1;

export function nodeInView(d) {
  // Cache view radius once per frame
  const frame = getFrameCounter();
  if (frame !== _cachedFrame) {
    _cachedViewR = viewportRadius(perf.rendering.renderDistance);
    _cachedFrame = frame;
  }
  const viewR = _cachedViewR;
  const dx = d._vx - state.camera.x;
  const dy = d._vy - state.camera.y;
  const r = viewR + d._vr;
  return dx * dx + dy * dy <= r * r;
}

export function pickNodeAt(px, py) {
  const nodes = state.pickOrder && state.pickOrder.length ? state.pickOrder : (state.layout && state.layout.root ? state.layout.root.descendants().slice().sort((a, b) => b.depth - a.depth) : []);
  const [wx, wy] = screenToWorld(px, py);
  for (const d of nodes) {
    if (!nodeInView(d)) continue;
    // Early reject nodes that are too small on screen to be interactable
    const screenR = d._vr * state.camera.k;
    if (screenR < (perf.rendering.pickMinPxRadius || 0)) continue;
    const dx = wx - d._vx,
      dy = wy - d._vy;
    if (dx * dx + dy * dy <= d._vr * d._vr) return d.data;
  }
  return null;
}
