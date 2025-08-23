import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;
let lastTooltipNodeId = 0;
let tooltipVisible = false;
let tooltipPosInit = false;

export function updateTooltip(n, px, py) {
  if (!ttip) return;
  if (!n) {
    if (tooltipVisible) {
      ttip.style.opacity = 0;
      tooltipVisible = false;
    }
    lastThumbShownForId = 0;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
      thumbDelayTimer = null;
    }
    hideBigPreview();
    return;
  }
  if (!tooltipPosInit) {
    // Anchor once; subsequent frames use transforms only (GPU-friendly)
    ttip.style.left = '0px';
    ttip.style.top = '0px';
    ttip.style.willChange = 'transform, opacity';
    tooltipPosInit = true;
  }
  if (n._id !== lastTooltipNodeId) {
    if (tName) tName.textContent = n.name;
    if (tMeta) tMeta.textContent = '';
    lastTooltipNodeId = n._id;
  }
  const m = 10;
  const x = Math.min(W - m, Math.max(m, px));
  const y = Math.min(H - m, Math.max(m, py));
  // Compose pointer position first, then fixed anchor offset
  ttip.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, calc(-100% - 12px))`;
  if (!tooltipVisible) {
    ttip.style.opacity = 1;
    tooltipVisible = true;
  }
  if (n._id !== lastThumbShownForId) {
    lastThumbShownForId = n._id;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
    }
    thumbDelayTimer = setTimeout(() => {
      if (state.hoverNode && state.hoverNode._id === n._id) {
        showBigFor(n);
      }
    }, 60);
  }
  // No canvas redraw here; tooltip DOM updates don't need a frame
}


