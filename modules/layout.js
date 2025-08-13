import { W, H } from './canvas.js';
import { settings } from './constants.js';

const pack = d3.pack().padding(2);

export function layoutFor(subtree) {
  const exp = typeof settings.valueExponent === 'number' ? settings.valueExponent : 1;
  const h = d3
    .hierarchy(subtree)
    .sum(d => (d.children && d.children.length ? 0 : 1))
    .eachAfter(n => {
      // Apply damping exponent to soften extreme size differences
      if (n.value && exp !== 1) n.value = Math.pow(n.value, exp);
    })
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


