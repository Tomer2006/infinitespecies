import { W, H } from './canvas.js';
import { pack as d3pack, hierarchy as d3hierarchy } from 'd3-hierarchy';

const pack = d3pack().padding(0);

export function layoutFor(subtree) {
  const h = d3hierarchy(subtree)
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


