/**
 * Tooltip and hover interaction management module
 *
 * Handles the display and positioning of tooltips when hovering over nodes.
 * Manages tooltip content, positioning logic, and coordinates with the
 * preview system for delayed thumbnail loading on hover.
 */

import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';
import { perf } from './settings.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;
let lastTooltipNodeId = 0;



export function updateTooltip(n, px, py) {
  if (!ttip) return;
  if (!n) {
    ttip.style.opacity = 0;
    lastThumbShownForId = 0;
    lastTooltipNodeId = 0;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
      thumbDelayTimer = null;
    }
    hideBigPreview();
    return;
  }

  // Update tooltip content only when the hovered node changes
  if (n._id !== lastTooltipNodeId) {
    if (tName) tName.textContent = n.name;

    // Build metadata with explicit labels for clarity
    const metaParts = [];
    const levelText = typeof n.level === 'number' || typeof n.level === 'string' ? String(n.level) : '';
    const leavesNum = typeof n._leaves === 'number' ? n._leaves : 0;
    const childrenNum = Array.isArray(n.children) ? n.children.length : 0;
    const idNum = typeof n._id === 'number' ? n._id : 0;

    metaParts.push(`Level: ${levelText}`);
    metaParts.push(`Descendants: ${leavesNum.toLocaleString()}`);

    if (tMeta) tMeta.textContent = metaParts.join(' • ');
    lastTooltipNodeId = n._id;
  }
  const m = 10;
  ttip.style.left = Math.min(W - m, Math.max(m, px)) + 'px';
  ttip.style.top = Math.min(H - m, Math.max(m, py)) + 'px';
  ttip.style.opacity = 1;
  if (n._id !== lastThumbShownForId) {
    lastThumbShownForId = n._id;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
    }
    thumbDelayTimer = setTimeout(() => {
      if (state.hoverNode && state.hoverNode._id === n._id) {
        showBigFor(n);
      }
    }, perf.input.tooltipThumbDelayMs);
  }
  // No canvas redraw here; tooltip DOM updates don't need a frame
}
