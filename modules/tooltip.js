import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;
let lastTooltipId = 0;



export function updateTooltip(n, px, py) {
  if (!ttip) return;
  if (!n) {
    ttip.style.opacity = 0;
    lastThumbShownForId = 0;
    lastTooltipId = 0;
    if (thumbDelayTimer) {
      clearTimeout(thumbDelayTimer);
      thumbDelayTimer = null;
    }
    hideBigPreview();
    return;
  }
  if (tName) tName.textContent = n.name;
  if (tMeta) tMeta.textContent = '';
  if (n._id !== lastTooltipId) {
    lastTooltipId = n._id;
  }
  const m = 10;
  const tx = Math.min(W - m, Math.max(m, px));
  const ty = Math.min(H - m, Math.max(m, py));
  ttip.style.transform = `translate(${tx}px, ${ty}px) translate(-50%, calc(-100% - 12px))`;
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
    }, 60);
  }
  // No canvas redraw here; tooltip DOM updates don't need a frame
}



