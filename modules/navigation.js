/**
 * Navigation and layout management module
 *
 * Handles node navigation, breadcrumb updates, and camera positioning.
 * Manages the relationship between taxonomy nodes, their visual layout,
 * and user navigation state. Requires pre-baked layout data.
 */

import { breadcrumbsEl } from './dom.js';
import { rebuildNodeMap, state } from './state.js';
import { updateDeepLinkFromNode } from './deeplink.js';
import { animateToCam } from './camera.js';
import { requestRender, W, H } from './canvas.js';
import { logInfo, logDebug, logWarn, logError } from './logger.js';
import { perf } from './settings.js';

export function setBreadcrumbs(node) {
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
    el.addEventListener('click', () => updateNavigation(n, true));
    breadcrumbsEl.appendChild(el);
    if (i < path.length - 1) {
      const sep = document.createElement('div');
      sep.className = 'crumb sep';
      sep.textContent = '›';
      sep.style.cursor = 'default';
      breadcrumbsEl.appendChild(sep);
    }
  });
  updateDeepLinkFromNode(node);
}

export function fitNodeInView(node) {
  const d = state.nodeLayoutMap.get(node._id);
  if (!d || typeof d._vr !== 'number' || d._vr <= 0) {
    logWarn(`Cannot fit node "${node.name}" in view: node not found in layout map or invalid radius`);
    return;
  }
  const targetRadiusPx = Math.min(W, H) * perf.navigation.fitTargetRadiusMultiplier;
  const k = targetRadiusPx / d._vr;
  animateToCam(d._vx, d._vy, k);
}

// Centralized navigation update function - handles all navigation changes and canvas updates
export async function updateNavigation(node, animate = true) {
  const startTime = performance.now();

  logInfo(`Starting navigation to "${node.name}" (animate=${animate})`);

  logDebug(`Setting current node to "${node.name}"`);
  state.current = node;

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
        // Calculate k to fit the node's circle (d._vr) into the view (min(W, H))
        // Target diameter = min(W, H)
        // d._vr is radius, so diameter is 2 * d._vr
        // k = target_diameter / (2 * d._vr)
        const targetK = Math.min(W, H) / (2 * d._vr);
        animateToCam(d._vx, d._vy, targetK);
      } else {
        // Fallback for root or error
        const targetK = Math.min(W / state.layout.diameter, H / state.layout.diameter);
        animateToCam(0, 0, targetK);
      }
    } else {
      // Local layout: center at 0,0
      const targetK = Math.min(W / state.layout.diameter, H / state.layout.diameter);
      animateToCam(0, 0, targetK);
    }
  } else {
    if (state.rootLayout) {
      const d = state.nodeLayoutMap.get(state.current._id);
      if (d) {
        state.camera.x = d._vx;
        state.camera.y = d._vy;
        state.camera.k = Math.min(W, H) / (2 * d._vr);
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
  }

  requestRender();

  const endTime = performance.now();
  logInfo(`Navigation completed: ${node.name}, ${(endTime - startTime).toFixed(2)}ms total`);
}

// Legacy function for backward compatibility
export async function goToNode(node, animate = true) {
  return updateNavigation(node, animate);
}

