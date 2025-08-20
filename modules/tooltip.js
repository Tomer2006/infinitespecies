import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;

function isMetadataNode(name) {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase();
  return lower.includes('sibling_higher') || 
         lower.includes('barren') || 
         lower.includes('was_container') || 
         lower.includes('not_otu') || 
         lower.includes('unplaced') || 
         lower.includes('hidden') || 
         lower.includes('inconsistent') || 
         lower.includes('merged') ||
         lower === 'infraspecific' ||
         /^[a-z_,]+$/.test(lower); // all lowercase with only underscores/commas
}

export function updateTooltip(n, px, py) {
  if (!ttip) return;
  if (!n || isMetadataNode(n.name)) {
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


