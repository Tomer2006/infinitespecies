/**
 * Navigation and layout management module (React-compatible)
 *
 * Handles node navigation, breadcrumb updates, and camera positioning.
 * Manages the relationship between taxonomy nodes, their visual layout,
 * and user navigation state. Requires pre-baked layout data.
 * 
 * In React mode, breadcrumb DOM manipulation is skipped - React handles it.
 */

import { setCurrentNode, setHoverNode, state } from './state';
import { animateToCam, clampCameraZoom, stopCameraAnimation } from './camera';
import { requestRender, W, H } from './canvas';
import { logInfo, logDebug, logWarn, logError } from './logger';
import { perf } from './settings';
import { isNodeInCurrentSubtree } from './picking';
import type { TaxonomyNode } from './types'

export function fitNodeInView(node: TaxonomyNode) {
  const d = state.nodeLayoutMap.get(node._id);
  if (!d || typeof d._vr !== 'number' || d._vr <= 0) {
    logWarn(`Cannot fit node "${node.name}" in view: node not found in layout map or invalid radius`);
    return;
  }
  const targetRadiusPx = Math.min(W, H) * perf.navigation.fitTargetRadiusMultiplier;
  const k = clampCameraZoom(targetRadiusPx / d._vr);
  console.log(`[fitNodeInView] node="${node.name}" _id=${node._id} _vr=${d._vr} W=${W} H=${H} mult=${perf.navigation.fitTargetRadiusMultiplier} targetR=${targetRadiusPx} k=${k} currentK=${state.camera.k}`);
  // Set camera position instantly instead of animating
  state.camera.x = d._vx;
  state.camera.y = d._vy;
  state.camera.k = k;
  requestRender();
}

// Centralized navigation update function - handles all navigation changes and canvas updates
export async function updateNavigation(node: TaxonomyNode, animate = true, options: { preservePosition?: boolean } = {}) {
  const startTime = performance.now();

  logInfo(`Starting navigation to "${node.name}" (animate=${animate})`);

  logDebug(`Setting current node to "${node.name}"`);
  setCurrentNode(node);
  // Force layout changed to ensure render happens even if camera doesn't move
  state.layoutChanged = true;

  // Must have pre-baked layout - no runtime D3 calculation
  if (state.rootLayout) {
    if (state.layout !== state.rootLayout) {
      state.layout = state.rootLayout;
      state.layoutChanged = true;
    }
    logDebug('Using cached global layout');
  } else {
    // No baked layout - this is an error state
    logError('No pre-baked layout available. Run "node tools/bake-layout.js" to generate layout data.');
    throw new Error('No pre-baked layout available');
  }

  // Force render update when current node changes, even if camera doesn't move much
  requestRender();

  // Check if layout was successfully computed before using it
  if (!state.layout || !state.layout.diameter) {
    logWarn(`Layout computation failed for node "${node.name}", skipping camera update`);
    requestRender();
    const endTime = performance.now();
    logInfo(`Navigation completed (no layout): ${node.name}, ${(endTime - startTime).toFixed(2)}ms total`);
    return;
  }

  if (options.preservePosition) {
    const d = state.nodeLayoutMap.get(node._id);
    const targetRadiusPx = Math.min(W, H) * perf.navigation.fitTargetRadiusMultiplier;
    state.camera.k = clampCameraZoom(d && d._vr > 0
      ? targetRadiusPx / d._vr
      : Math.min(W, H) / state.layout.diameter);
    stopCameraAnimation();
  } else if (animate) {
    if (state.rootLayout) {
      // Global layout: zoom to node position
      const d = state.nodeLayoutMap.get(node._id);
      if (d) {
        // Calculate k to fit the node's circle using the same multiplier as fitNodeInView
        const targetRadiusPx = Math.min(W, H) * perf.navigation.fitTargetRadiusMultiplier;
        const targetK = clampCameraZoom(targetRadiusPx / d._vr);
        console.log(`[updateNavigation] node="${node.name}" _id=${node._id} _vr=${d._vr} W=${W} H=${H} mult=${perf.navigation.fitTargetRadiusMultiplier} targetR=${targetRadiusPx} k=${targetK} currentK=${state.camera.k}`);
        // Render the new subtree immediately before starting animation
        requestRender();
        animateToCam(d._vx, d._vy, targetK);
      } else {
        // Fallback for root or error
        const targetK = clampCameraZoom(Math.min(W / state.layout.diameter, H / state.layout.diameter));
        // Render the new subtree immediately before starting animation
        requestRender();
        animateToCam(0, 0, targetK);
      }
    } else {
      // Local layout: center at 0,0
      const targetK = clampCameraZoom(Math.min(W / state.layout.diameter, H / state.layout.diameter));
      // Render the new subtree immediately before starting animation
      requestRender();
      animateToCam(0, 0, targetK);
    }
  } else {
    if (state.rootLayout) {
      const d = state.nodeLayoutMap.get(node._id);
      if (d) {
        state.camera.x = d._vx;
        state.camera.y = d._vy;
        const targetRadiusPx = Math.min(W, H) * perf.navigation.fitTargetRadiusMultiplier;
        state.camera.k = clampCameraZoom(targetRadiusPx / d._vr);
      } else {
        state.camera.x = 0;
        state.camera.y = 0;
        state.camera.k = clampCameraZoom(Math.min(W, H) / state.layout.diameter);
      }
    } else {
      state.camera.x = 0;
      state.camera.y = 0;
      state.camera.k = clampCameraZoom(Math.min(W, H) / state.layout.diameter);
    }
    // Cancel any previous transition and synchronize its target with the new position.
    stopCameraAnimation();
    // Request render immediately after setting camera position in non-animated navigation
    requestRender();
  }

  // Request render after camera positioning to show the new focused subtree immediately
  requestRender();

  const endTime = performance.now();
  logInfo(`Navigation completed: ${node.name}, ${(endTime - startTime).toFixed(2)}ms total`);
}

// Legacy function for backward compatibility
export async function goToNode(node: TaxonomyNode, animate = true, options: { preservePosition?: boolean } = {}) {
  return updateNavigation(node, animate, options);
}

// Update the current node without navigating the camera to a new position.
export function updateCurrentNodeOnly(node: TaxonomyNode) {
  logInfo(`Updating current node to "${node.name}" with an immediate level zoom boundary`);

  stopCameraAnimation();
  const previousZoom = state.camera.k;
  setCurrentNode(node);
  state.layoutChanged = true;

  // The bottom breadcrumb changes the zoom-out boundary. Apply the new
  // boundary immediately while keeping that circle fixed on screen.
  const nextZoom = clampCameraZoom(previousZoom);
  if (nextZoom !== previousZoom) {
    const anchorX = Number(node._vx);
    const anchorY = Number(node._vy);
    if (Number.isFinite(anchorX) && Number.isFinite(anchorY) && previousZoom > 0) {
      state.camera.x = anchorX - ((anchorX - state.camera.x) * previousZoom) / nextZoom;
      state.camera.y = anchorY - ((anchorY - state.camera.y) * previousZoom) / nextZoom;
    }
    state.camera.k = nextZoom;
    state.targetCam = { ...state.camera };
  }
  
  // Clear hover node if it's outside the new current subtree
  if (state.hoverNode && !isNodeInCurrentSubtree(state.hoverNode)) {
    setHoverNode(null);
  }
  
  // Ensure layout is set
  if (state.rootLayout) {
    if (state.layout !== state.rootLayout) {
      state.layout = state.rootLayout;
      state.layoutChanged = true;
    }
  }
  
  requestRender();
}

/**
 * Zoom camera to a node without changing current node or layout (performance-critical)
 * Used for search results - just moves camera, doesn't update breadcrumbs or navigation state
 */
export function zoomToNode(node: TaxonomyNode, durationMs?: number) {
  const d = state.nodeLayoutMap.get(node._id);
  if (!d || typeof d._vr !== 'number' || d._vr <= 0) {
    logWarn(`Cannot zoom to node "${node.name}": node not found in layout map or invalid radius`);
    return;
  }
  
  // Calculate zoom level to fit the node
  const targetRadiusPx = Math.min(W, H) * perf.navigation.fitTargetRadiusMultiplier;
  const targetK = clampCameraZoom(targetRadiusPx / d._vr);
  
  // Animate camera to the node's position
  animateToCam(d._vx, d._vy, targetK, durationMs);
}
