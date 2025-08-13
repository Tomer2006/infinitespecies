import { W, H } from './canvas.js';

// Depth-/structure-aware padding to avoid tiny circles near leaves
const pack = d3.pack().padding(d => {
  if (!d) return 2;
  // No padding if single child to prevent cumulative shrinking in chains
  if (d.children && d.children.length === 1) return 0;
  // Small padding for parents of leaves
  if (typeof d.height === 'number' && d.height === 1) return 0.5;
  return 2;
});

export function layoutFor(subtree) {
  const h = d3.hierarchy(subtree);
  // Force equal-size siblings at every level
  h.eachAfter(d => {
    if (d.children && d.children.length) {
      for (const c of d.children) c.value = 1;
    } else {
      d.value = 1;
    }
  });
  h.sort((a, b) => b.value - a.value);
  const diameter = Math.min(W, H) - 40;
  pack.size([diameter, diameter])(h);
  const cx = diameter / 2,
    cy = diameter / 2;
  h.each(d => {
    d._vx = d.x - cx;
    d._vy = d.y - cy;
    d._vr = d.r;
  });
  // Inflate lone child to meaningfully fill its parent without being tiny
  h.each(d => {
    if (d.children && d.children.length === 1) {
      const child = d.children[0];
      child._vx = d._vx;
      child._vy = d._vy;
      const maxR = d._vr * 0.96;
      if (child._vr < maxR) child._vr = maxR;
    }
  });
  return { root: h, diameter };
}


