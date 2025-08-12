import { screenToWorld, viewportRadius } from './canvas.js';
import { state } from './state.js';
import { settings } from './constants.js';

export function nodeInView(d) {
  const viewR = viewportRadius(settings.renderDistance);
  const dx = d._vx - state.camera.x;
  const dy = d._vy - state.camera.y;
  const r = viewR + d._vr;
  return dx * dx + dy * dy <= r * r;
}

export function pickNodeAt(px, py) {
  const nodes = state.pickOrder && state.pickOrder.length ? state.pickOrder : state.layout.root.descendants().slice().sort((a, b) => b.depth - a.depth);
  const [wx, wy] = screenToWorld(px, py);
  for (const d of nodes) {
    if (!nodeInView(d)) continue;
    const dx = wx - d._vx,
      dy = wy - d._vy;
    if (dx * dx + dy * dy <= d._vr * d._vr) return d.data;
  }
  return null;
}


