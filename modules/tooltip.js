import { ttip, tName, tMeta, nodeHighlight } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H, worldToScreen } from './canvas.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;

function updateNodeHighlight(n) {
  if (!nodeHighlight) return;
  if (!n) {
    nodeHighlight.style.display = 'none';
    return;
  }

  const d = state.nodeLayoutMap.get(n._id);
  if (!d) {
    nodeHighlight.style.display = 'none';
    return;
  }

  const [sx, sy] = worldToScreen(d._vx, d._vy);
  const sr = d._vr * state.camera.k;

  if (sr > 4) {
    nodeHighlight.style.left = sx + 'px';
    nodeHighlight.style.top = sy + 'px';
    nodeHighlight.style.width = (sr + 3) * 2 + 'px';
    nodeHighlight.style.height = (sr + 3) * 2 + 'px';
    nodeHighlight.style.display = 'block';
  } else {
    nodeHighlight.style.display = 'none';
  }
}

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
    updateNodeHighlight(null); // Clear highlight
    return;
  }
  if (tName) tName.textContent = n.name + (n.level ? ` (${n.level})` : '');
  if (tMeta) tMeta.textContent = n.level || '';
  const m = 10;
  ttip.style.left = Math.min(W - m, Math.max(m, px)) + 'px';
  ttip.style.top = Math.min(H - m, Math.max(m, py)) + 'px';
  ttip.style.opacity = 1;
  updateNodeHighlight(n); // Position highlight
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



