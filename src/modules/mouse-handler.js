/**
 * Mouse and touch event handler module (vanilla JS)
 * 
 * Handles all mouse and touch interactions for canvas navigation.
 * React components should only bind these handlers to DOM events.
 */

import { state } from './state.js';
import { requestRender, screenToWorld } from './canvas.js';
import { pickNodeAt, isNodeStillHoverable } from './picking.js';
import { handleCameraPan, handleWheelZoom } from './camera.js';
import { showBigFor, hideBigPreview } from './preview.js';
import { updateTooltip } from './tooltip.js';

/**
 * Handle mouse move event - panning logic
 * @param {number} x - Mouse X position relative to canvas
 * @param {number} y - Mouse Y position relative to canvas
 * @param {boolean} isPanning - Whether user is currently panning
 * @param {Object} lastPan - Last pan position {x, y} or null
 * @returns {Object|null} Updated pan state if panning, null otherwise
 */
export function handleMouseMovePan(x, y, isPanning, lastPan) {
  if (isPanning && lastPan) {
    const dx = x - lastPan.x;
    const dy = y - lastPan.y;
    handleCameraPan(dx, dy);
    return { x, y };
  }
  return null;
}

/**
 * Handle hover/picking - returns the node under cursor
 * @param {number} x - Mouse X position relative to canvas
 * @param {number} y - Mouse Y position relative to canvas
 * @returns {Object|null} The node under cursor or null
 */
export function handleMouseMovePick(x, y) {
  const node = pickNodeAt(x, y);
  state.hoverNode = node;
  return node;
}

/**
 * Handle mouse leave event
 */
export function handleMouseLeaveEvent() {
  state.hoverNode = null;
  hideBigPreview();
}

/**
 * Handle mouse down event
 * @param {number} button - Mouse button (0=left, 1=middle, 2=right)
 * @param {number} x - Mouse X position relative to canvas
 * @param {number} y - Mouse Y position relative to canvas
 * @returns {Object|null} Pan state if middle button, null otherwise
 */
export function handleMouseDown(button, x, y) {
  if (button === 1) {
    // Middle mouse button - start panning
    return { x, y };
  }
  return null;
}

/**
 * Handle wheel zoom event
 * @param {WheelEvent} e - The wheel event
 * @param {HTMLElement} canvas - The canvas element
 */
export function handleWheelEvent(e, canvas) {
  handleWheelZoom(e, canvas);
}

/**
 * Validate hover when camera changes (O(1) check)
 * @param {number} x - Mouse X position
 * @param {number} y - Mouse Y position
 * @param {Function} onTooltipUpdate - Callback to update tooltip
 */
export function validateHoverOnCameraChange(x, y, onTooltipUpdate) {
  if (x === 0 && y === 0) return; // No mouse position yet
  
  const currentHover = state.hoverNode;
  
  // If no current hover, try to pick one (user might have zoomed into a node)
  if (!currentHover) {
    const n = pickNodeAt(x, y);
    if (n) {
      state.hoverNode = n;
      if (onTooltipUpdate) {
        onTooltipUpdate(n, x, y);
      }
    }
    return;
  }
  
  // Check if current hover is still valid (O(1) check)
  if (!isNodeStillHoverable(currentHover, x, y)) {
    // Node is no longer hoverable - find the new node under cursor
    const n = pickNodeAt(x, y);
    state.hoverNode = n;
    if (n && onTooltipUpdate) {
      onTooltipUpdate(n, x, y);
    } else if (onTooltipUpdate) {
      onTooltipUpdate(null, x, y);
    }
  }
}
