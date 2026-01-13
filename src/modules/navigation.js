/**
 * Navigation and layout management module (React-compatible)
 *
 * Handles node navigation, breadcrumb updates, and camera positioning.
 * Manages the relationship between taxonomy nodes, their visual layout,
 * and user navigation state. Requires pre-baked layout data.
 * 
 * In React mode, breadcrumb DOM manipulation is skipped - React handles it.
 */

import { state } from './state.js';
import { updateDeepLinkFromNode } from './deeplink.js';
import { animateToCam } from './camera.js';
import { requestRender, W, H } from './canvas.js';
import { logInfo, logDebug, logWarn, logError } from './logger.js';
import { perf } from './settings.js';

// Check if we're in React mode (breadcrumbs handled by React component)
const isReactMode = () => typeof window !== 'undefined' && window.__reactCanvas;

export function setBreadcrumbs(node) {
  // In React mode, breadcrumbs are managed by React state - skip DOM manipulation
  // Don't update URL here - URL updates only happen from breadcrumb hover updates, not from clicks
  if (isReactMode()) {
    // updateDeepLinkFromNode(node); // Removed - URL updates only on breadcrumb hover
    return;
  }
  
  // Legacy DOM manipulation for non-React mode
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  if (!breadcrumbsEl) return;
  
  breadcrumbsEl.innerHTML = '';
  const path = [];
  let p = node;
  while (p) {
    path.unshift(p);
    p = p.parent;
  }
  path.forEach((n, i) => {
    const el = document.createElement('div');
    el.className = 'crumb';
    el.textContent = n.name;
    el.title = `Go to ${n.name}`;
    el.addEventListener('click', () => updateNavigation(n, false));
    breadcrumbsEl.appendChild(el);
    if (i < path.length - 1) {
      const sep = document.createElement('div');
      sep.className = 'crumb sep';
      sep.textContent = '›';
      sep.style.cursor = 'default';
      breadcrumbsEl.appendChild(sep);
    }
  });
  // Don't update URL here - URL updates only happen from breadcrumb hover updates, not from clicks
  // updateDeepLinkFromNode(node);

  // Request render whenever breadcrumbs change for any reason
  requestRender();
}

export function fitNodeInView(node) {
  const d = state.nodeLayoutMap.get(node._id);
  if (!d || typeof d._vr !== 'number' || d._vr <= 0) {
    logWarn(`Cannot fit node "${node.name}" in view: node not found in layout map or invalid radius`);
    return;
  }
  const targetRadiusPx = Math.min(W, H) * perf.navigation.fitTargetRadiusMultiplier;
  const k = targetRadiusPx / d._vr;
  console.log(`[fitNodeInView] node="${node.name}" _id=${node._id} _vr=${d._vr} W=${W} H=${H} mult=${perf.navigation.fitTargetRadiusMultiplier} targetR=${targetRadiusPx} k=${k} currentK=${state.camera.k}`);
  // Set camera position instantly instead of animating
  state.camera.x = d._vx;
  state.camera.y = d._vy;
  state.camera.k = k;
  requestRender();
}

// Centralized navigation update function - handles all navigation changes and canvas updates
export async function updateNavigation(node, animate = true) {
  const startTime = performance.now();

  logInfo(`Starting navigation to "${node.name}" (animate=${animate})`);

  logDebug(`Setting current node to "${node.name}"`);
  state.current = node;
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

  setBreadcrumbs(state.current);

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

  if (animate) {
    if (state.rootLayout) {
      // Global layout: zoom to node position
      const d = state.nodeLayoutMap.get(state.current._id);
      if (d) {
        // Calculate k to fit the node's circle using the same multiplier as fitNodeInView
        const targetRadiusPx = Math.min(W, H) * perf.navigation.fitTargetRadiusMultiplier;
        const targetK = targetRadiusPx / d._vr;
        console.log(`[updateNavigation] node="${state.current.name}" _id=${state.current._id} _vr=${d._vr} W=${W} H=${H} mult=${perf.navigation.fitTargetRadiusMultiplier} targetR=${targetRadiusPx} k=${targetK} currentK=${state.camera.k}`);
        // Render the new subtree immediately before starting animation
        requestRender();
        animateToCam(d._vx, d._vy, targetK);
      } else {
        // Fallback for root or error
        const targetK = Math.min(W / state.layout.diameter, H / state.layout.diameter);
        // Render the new subtree immediately before starting animation
        requestRender();
        animateToCam(0, 0, targetK);
      }
    } else {
      // Local layout: center at 0,0
      const targetK = Math.min(W / state.layout.diameter, H / state.layout.diameter);
      // Render the new subtree immediately before starting animation
      requestRender();
      animateToCam(0, 0, targetK);
    }
  } else {
    if (state.rootLayout) {
      const d = state.nodeLayoutMap.get(state.current._id);
      if (d) {
        state.camera.x = d._vx;
        state.camera.y = d._vy;
        const targetRadiusPx = Math.min(W, H) * perf.navigation.fitTargetRadiusMultiplier;
        state.camera.k = targetRadiusPx / d._vr;
      } else {
        state.camera.x = 0;
        state.camera.y = 0;
        state.camera.k = Math.min(W, H) / state.layout.diameter;
      }
    } else {
      state.camera.x = 0;
      state.camera.y = 0;
      state.camera.k = Math.min(W, H) / state.layout.diameter;
    }
    // Request render immediately after setting camera position in non-animated navigation
    requestRender();
  }

  // Request render after camera positioning to show the new focused subtree immediately
  requestRender();

  const endTime = performance.now();
  logInfo(`Navigation completed: ${node.name}, ${(endTime - startTime).toFixed(2)}ms total`);
}

// Legacy function for backward compatibility
export async function goToNode(node, animate = true) {
  return updateNavigation(node, animate);
}

// Update the current node without moving the camera - just changes the visible subtree
export function updateCurrentNodeOnly(node) {
  logInfo(`Updating current node to "${node.name}" without camera movement`);
  
  state.current = node;
  state.layoutChanged = true;
  
  // Ensure layout is set
  if (state.rootLayout) {
    if (state.layout !== state.rootLayout) {
      state.layout = state.rootLayout;
      state.layoutChanged = true;
    }
  }
  
  setBreadcrumbs(state.current);
  requestRender();
}
