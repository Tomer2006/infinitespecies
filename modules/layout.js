import { W, H } from './canvas.js';
import { pack as d3pack, hierarchy as d3hierarchy } from 'd3-hierarchy';

const pack = d3pack().padding(0);

export function layoutFor(subtree) {
  // Add null checks and validation
  if (!subtree || typeof subtree !== 'object') {
    console.warn('Invalid subtree provided to layoutFor:', subtree);
    return null;
  }

  try {
    const h = d3hierarchy(subtree)
      .sum(d => {
        const children = d.children;
        return (Array.isArray(children) && children.length > 0) ? 0 : 1;
      })
      .sort((a, b) => b.value - a.value);

    const diameter = Math.min(W, H);
    if (diameter <= 0) {
      console.warn('Invalid canvas dimensions for layout:', { W, H });
      return null;
    }

    pack.size([diameter, diameter])(h);
    const cx = diameter / 2,
      cy = diameter / 2;
    h.each(d => {
      d._vx = d.x - cx;
      d._vy = d.y - cy;
      d._vr = d.r;
    });
    return { root: h, diameter };
  } catch (error) {
    console.error('Error in layout calculation:', error);
    return null;
  }
}


