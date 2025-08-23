import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;
let lastPosition = { x: -1, y: -1 };
let lastNodeId = -1;

export function updateTooltip(n, px, py) {
  if (!ttip) return;
  if (!n) {
    ttip.style.opacity = 0;
    lastThumbShownForId = 0;
    lastPosition = { x: -1, y: -1 };
    lastNodeId = -1;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
      thumbDelayTimer = null;
    }
    hideBigPreview();
    return;
  }

  const nodeId = n._id;
  const positionChanged = Math.abs(px - lastPosition.x) > 2 || Math.abs(py - lastPosition.y) > 2;
  const nodeChanged = nodeId !== lastNodeId;

  // Only update content when node changes
  if (nodeChanged) {
    if (tName) tName.textContent = n.name;
    if (tMeta) tMeta.textContent = '';
    lastNodeId = nodeId;
  }

  // Only update position when it significantly changes
  if (positionChanged || nodeChanged) {
    const m = 10;
    ttip.style.left = Math.min(W - m, Math.max(m, px)) + 'px';
    ttip.style.top = Math.min(H - m, Math.max(m, py)) + 'px';
    lastPosition = { x: px, y: py };
  }

  // Only show tooltip if it's not already visible
  if (ttip.style.opacity !== '1') {
    ttip.style.opacity = 1;
  }

  if (nodeId !== lastThumbShownForId) {
    lastThumbShownForId = nodeId;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
    }
    thumbDelayTimer = setTimeout(() => {
      if (state.hoverNode && state.hoverNode._id === nodeId) {
        showBigFor(n);
      }
    }, 60);
  }
  // No canvas redraw here; tooltip DOM updates don't need a frame
}


