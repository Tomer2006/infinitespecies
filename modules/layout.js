import { W, H } from './canvas.js';
import { pack as d3pack, hierarchy as d3hierarchy } from 'd3-hierarchy';
import { logInfo, logWarn, logError, logDebug, logTrace } from './logger.js';

const pack = d3pack().padding(0);

export function layoutFor(subtree) {
  // Add null checks and validation
  if (!subtree || typeof subtree !== 'object') {
    logWarn('Invalid subtree provided to layoutFor', subtree);
    return null;
  }

  logDebug(`Computing layout for subtree: "${subtree.name || 'unnamed'}"`);

  try {
    const startTime = performance.now();

    const h = d3hierarchy(subtree)
      .sum(d => {
        const children = d.children;
        return (Array.isArray(children) && children.length > 0) ? 0 : 1;
      })
      .sort((a, b) => b.value - a.value);

    const diameter = Math.min(W, H);
    if (diameter <= 0) {
      logWarn('Invalid canvas dimensions for layout', { W, H });
      return null;
    }

    logTrace(`Layout: diameter=${diameter}, canvas=${W}x${H}`);

    pack.size([diameter, diameter])(h);
    const cx = diameter / 2,
      cy = diameter / 2;

    let nodeCount = 0;
    h.each(d => {
      d._vx = d.x - cx;
      d._vy = d.y - cy;
      d._vr = d.r;
      nodeCount++;
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    logInfo(`Layout computed: ${nodeCount} nodes, ${duration.toFixed(2)}ms, diameter=${diameter}px`);

    return { root: h, diameter };
  } catch (error) {
    logError('Error in layout calculation', error);
    return null;
  }
}



