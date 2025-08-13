import { W, H } from './canvas.js';

const pack = d3.pack().padding(d => (d && typeof d.height === 'number' && d.height <= 1 ? 0.5 : 2));

export function layoutFor(subtree) {
  const h = d3.hierarchy(subtree);
  // Force equal-size siblings at every level and keep consistent parent values
  h.eachAfter(d => {
    if (d.children && d.children.length) {
      for (const c of d.children) c.value = 1;
      d.value = d.children.length;
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
  // Inflate lone child so it meaningfully fills its parent
  const SINGLE_CHILD_FILL_RATIO = 0.96;
  h.each(d => {
    if (d.children && d.children.length === 1) {
      const child = d.children[0];
      child._vx = d._vx;
      child._vy = d._vy;
      const maxR = d._vr * SINGLE_CHILD_FILL_RATIO;
      if (child._vr < maxR) child._vr = maxR;
    }
  });
  return { root: h, diameter };
}


