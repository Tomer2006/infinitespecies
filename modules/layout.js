import { W, H } from './canvas.js';

const pack = d3.pack().padding(2);

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
  return { root: h, diameter };
}


