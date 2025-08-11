import { W, H } from './canvas.js';
import { settings } from './constants.js';

const pack = d3.pack().padding(2);

export function layoutFor(subtree) {
  // Limit breadth to keep layout cost bounded on huge trees
  const cullChildren = node => {
    if (!node.children || node.children.length === 0) return;
    if (node.children.length > settings.maxChildrenPerNode) {
      node.children = node.children.slice(0, settings.maxChildrenPerNode);
    }
    node.children.forEach(cullChildren);
  };
  const working = JSON.parse(JSON.stringify(subtree));
  cullChildren(working);

  const h = d3
    .hierarchy(working)
    .sum(d => (d.children && d.children.length ? 0 : 1))
    .sort((a, b) => b.value - a.value);
  const diameter = Math.min(W, H) - 40;
  pack.size([diameter, diameter])(h);
  const cx = diameter / 2,
    cy = diameter / 2;
  h.each(d => {
    d._vx = d.x - cx;
    d._vy = d.y - cy;
    d._vr = d.r;
  });
  return { root: h, diameter };
}


