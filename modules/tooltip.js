import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;
let lastTooltipUpdate = 0;
const TOOLTIP_THROTTLE_MS = 16; // ~60fps

export function updateTooltip(n, px, py) {
  if (!ttip) return;
  
  const now = performance.now();
  
  if (!n) {
    ttip.style.opacity = 0;
    lastThumbShownForId = 0;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
      thumbDelayTimer = null;
    }
    hideBigPreview();
    return;
  }
  
  // Update content immediately for new nodes
  if (n._id !== lastThumbShownForId) {
    if (tName) tName.textContent = n.name;
    if (tMeta) tMeta.textContent = '';
    lastThumbShownForId = n._id;
    
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
    }
    thumbDelayTimer = setTimeout(() => {
      if (state.hoverNode && state.hoverNode._id === n._id) {
        showBigFor(n);
      }
    }, 200);
  }
  
  // Throttle position updates to reduce DOM thrashing
  if (now - lastTooltipUpdate >= TOOLTIP_THROTTLE_MS) {
    const m = 10;
    ttip.style.left = Math.min(W - m, Math.max(m, px)) + 'px';
    ttip.style.top = Math.min(H - m, Math.max(m, py)) + 'px';
    lastTooltipUpdate = now;
  }
  
  ttip.style.opacity = 1;
  // No canvas redraw here; tooltip DOM updates don't need a frame
}


