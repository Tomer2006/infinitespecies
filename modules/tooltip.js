import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;



export function updateTooltip(n, px, py) {
  if (!ttip) return;
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
  if (tName) tName.textContent = n.name + (n.level ? ` (${n.level})` : '');
  if (tMeta) tMeta.textContent = n.level || '';
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
    }, 60);
  }
  // No canvas redraw here; tooltip DOM updates don't need a frame
}



