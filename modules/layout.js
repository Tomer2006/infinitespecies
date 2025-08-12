import { W, H } from './canvas.js';

const pack = d3.pack().padding(2);

export function layoutFor(subtree) {
  const h = d3
    .hierarchy(subtree)
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
  // Assign per-sibling indices for color cycling
  h.each(d => {
    if (d.children && d.children.length) {
      for (let i = 0; i < d.children.length; i++) {
        const child = d.children[i];
        if (child && child.data) child.data._sibIndex = i;
      }
    }
  });
  return { root: h, diameter };
}


