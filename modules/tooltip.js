import { ttip, tName, tMeta } from './dom.js';
import { state } from './state.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { W, H } from './canvas.js';

let lastThumbShownForId = 0;
let thumbDelayTimer = null;
let tooltipDebounceTimer = null;
let lastTooltipState = {
  nodeId: null,
  content: '',
  position: { x: 0, y: 0 },
  visible: false
};

export function updateTooltip(n, px, py) {
  if (!ttip) return;

  // Clear any pending debounce timer
  if (tooltipDebounceTimer) {
    clearTimeout(tooltipDebounceTimer);
    tooltipDebounceTimer = null;
  }

  // If no node, hide tooltip immediately
  if (!n) {
    if (lastTooltipState.visible) {
      hideTooltip();
    }
    return;
  }

  // Calculate new tooltip content and position
  const newContent = n.name + (n.level ? ` (${n.level})` : '');
  const metaContent = n.level || '';

  // Optimized position calculation with fewer operations
  const margin = 10;
  const clampedX = px < margin ? margin : (px > W - margin ? W - margin : px);
  const clampedY = py < margin ? margin : (py > H - margin ? H - margin : py);

  // Check if anything actually changed
  const contentChanged = newContent !== lastTooltipState.content ||
                        metaContent !== lastTooltipState.metaContent;
  const positionChanged = Math.abs(clampedX - lastTooltipState.position.x) > 0.5 ||
                         Math.abs(clampedY - lastTooltipState.position.y) > 0.5;
  const nodeChanged = n._id !== lastTooltipState.nodeId;

  // If nothing changed, don't update
  if (!contentChanged && !positionChanged && !nodeChanged && lastTooltipState.visible) {
    return;
  }

  // Debounce the tooltip update to avoid excessive DOM manipulation
  tooltipDebounceTimer = setTimeout(() => {
    // Batch all DOM updates together for better performance
    const updates = [];

    if (contentChanged || nodeChanged) {
      if (tName) updates.push(() => tName.textContent = newContent);
      if (tMeta) updates.push(() => tMeta.textContent = metaContent);
      lastTooltipState.content = newContent;
      lastTooltipState.metaContent = metaContent;
    }

    if (positionChanged || !lastTooltipState.visible) {
      // Use transform for better performance instead of changing left/top
      updates.push(() => {
        ttip.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
        ttip.style.opacity = '1';
      });
      lastTooltipState.position = { x: clampedX, y: clampedY };
    }

    // Apply all updates in a single batch
    updates.forEach(update => update());

    lastTooltipState.nodeId = n._id;
    lastTooltipState.visible = true;

    // Handle thumbnail preview
    if (nodeChanged) {
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
  }, 16); // ~60fps debounce
}

function hideTooltip() {
  if (ttip) {
    ttip.style.opacity = '0';
  }
  lastTooltipState.nodeId = null;
  lastTooltipState.visible = false;
  lastThumbShownForId = 0;
  if (thumbDelayTimer) {
    clearTimeout(thumbDelayTimer);
    thumbDelayTimer = null;
  }
  hideBigPreview();
}


