import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;

// Cache the last tooltip state to avoid unnecessary DOM updates
let lastTooltipNodeId = null;
let lastTooltipPosition = { x: -1, y: -1 };

export function updateTooltip(n, px, py) {
  if (!ttip) return;

  if (!n) {
    // Only hide if not already hidden
    if (ttip.style.opacity !== '0') {
      ttip.style.opacity = 0;
      lastTooltipNodeId = null;
      lastTooltipPosition = { x: -1, y: -1 };
    }
    lastThumbShownForId = 0;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
      thumbDelayTimer = null;
    }
    hideBigPreview();
    return;
  }

  const m = 10;
  const clampedX = Math.min(W - m, Math.max(m, px));
  const clampedY = Math.min(H - m, Math.max(m, py));

  // Only update position if it changed significantly (more than 2 pixels)
  const posChanged = Math.abs(clampedX - lastTooltipPosition.x) > 2 ||
                    Math.abs(clampedY - lastTooltipPosition.y) > 2;

  // Only update content if node changed
  const nodeChanged = n._id !== lastTooltipNodeId;

  if (nodeChanged) {
    if (tName) tName.textContent = n.name;
    if (tMeta) tMeta.textContent = '';
    lastTooltipNodeId = n._id;
  }

  if (posChanged || nodeChanged) {
    ttip.style.left = clampedX + 'px';
    ttip.style.top = clampedY + 'px';
    ttip.style.opacity = 1;
    lastTooltipPosition = { x: clampedX, y: clampedY };
  }

  if (n._id !== lastThumbShownForId) {
    lastThumbShownForId = n._id;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
    }
    // Increase delay to reduce frequency of expensive preview loading
    thumbDelayTimer = setTimeout(() => {
      if (state.hoverNode && state.hoverNode._id === n._id) {
        showBigFor(n);
      }
    }, 150); // Increased from 60ms to 150ms
  }
  // No canvas redraw here; tooltip DOM updates don't need a frame
}


