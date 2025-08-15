import { W, H } from './canvas.js';

const pack = d3.pack().padding(0);

export function layoutFor(subtree) {
  const h = d3
    .hierarchy(subtree)
    .sum(d => (d.children && d.children.length ? 0 : 1))
    .sort((a, b) => b.value - a.value);
  const diameter = Math.min(W, H);
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


