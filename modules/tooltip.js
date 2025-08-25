import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';

const PREVIEW_DELAY_MS = 180;

let lastThumbShownForId = 0;
let lastTooltipContentId = 0;
let thumbDelayTimer = null;

export function updateTooltip(n, px, py) {
  if (!ttip) return;
  if (!n) {
    ttip.style.opacity = 0;
    lastThumbShownForId = 0;
    lastTooltipContentId = 0;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
      thumbDelayTimer = null;
    }
    hideBigPreview();
    return;
  }
  if (n._id !== lastTooltipContentId) {
    if (tName) tName.textContent = n.name + (n.level ? ` (${n.level})` : '');
    if (tMeta) tMeta.textContent = n.level || '';
    lastTooltipContentId = n._id;
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
        if (typeof performance !== 'undefined' && performance.now() < (state.suppressHoverPreviewUntil || 0)) return;
        showBigFor(n);
      }
    }, PREVIEW_DELAY_MS);
  }
  // No canvas redraw here; tooltip DOM updates don't need a frame
}


