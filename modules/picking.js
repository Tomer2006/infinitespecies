/* Node Picking and Hit Testing */
import { W, H } from './canvas.js';
import { camera } from './camera.js';
import { layout, nodeLayoutMap } from './state.js';
import { settings } from './constants.js';

function screenToWorld(px, py) { 
  return [camera.x + (px - W/2) / camera.k, camera.y + (py - H/2) / camera.k]; 
}

function nodeInView(d) {
  const viewR = Math.hypot(W, H) * 0.5 / camera.k * settings.renderDistance;
  const dx = d._vx - camera.x, dy = d._vy - camera.y;
  const r = viewR + d._vr;
  return (dx * dx + dy * dy) <= (r * r);
}

export function pickNodeAt(px, py) {
  if (!layout) return null;
  const nodes = layout.root.descendants().slice().sort((a, b) => b.depth - a.depth);
  const [wx, wy] = screenToWorld(px, py);
  for (const d of nodes) {
    if (!nodeInView(d)) continue;
    const dx = wx - d._vx, dy = wy - d._vy; 
    if ((dx * dx + dy * dy) <= (d._vr * d._vr)) return d.data;
  }
  return null;
}
