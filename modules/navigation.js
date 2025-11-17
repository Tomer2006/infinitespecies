/**
 * Navigation and layout management module
 *
 * Handles node navigation, layout computation, breadcrumb updates,
 * and camera positioning. Manages the relationship between taxonomy
 * nodes, their visual layout, and user navigation state.
 */

import { breadcrumbsEl } from './dom.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap, state } from './state.js';
import { updateDeepLinkFromNode } from './deeplink.js';
import { animateToCam } from './camera.js';
import { requestRender, W, H } from './canvas.js';
import { logInfo, logDebug, logTrace, logWarn } from './logger.js';
import { onViewportChange } from './data.js';
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

  logTrace('Computing layout for current node');
  state.layout = layoutFor(state.current);

  if (state.layout) {
    logDebug(`Layout computed: ${state.layout.root?.descendants()?.length || 0} nodes, diameter=${state.layout.diameter}px`);
  }

  rebuildNodeMap();
  setBreadcrumbs(state.current);

  // Mark that layout has changed for canvas rendering
  state.layoutChanged = true;

  // Check if layout was successfully computed before using it
  if (!state.layout || !state.layout.diameter) {
    logWarn(`Layout computation failed for node "${node.name}", skipping camera update`);
    requestRender();
    const endTime = performance.now();
    logInfo(`Navigation completed (no layout): ${node.name}, ${(endTime - startTime).toFixed(2)}ms total`);
    if (state.loadMode === 'lazy') {
      setTimeout(() => onViewportChange(), perf.timing.navigationViewportDelayMs);
    }
    return;
  }

  if (animate) {
    const targetK = Math.min(W / state.layout.diameter, H / state.layout.diameter);
    animateToCam(0, 0, targetK);
  } else {
    state.camera.x = 0;
    state.camera.y = 0;
    state.camera.k = Math.min(W, H) / state.layout.diameter;
  }

  requestRender();

  const endTime = performance.now();
  logInfo(`Navigation completed: ${node.name}, ${(endTime - startTime).toFixed(2)}ms total`);
  
  // Trigger viewport-based loading after navigation settles
  if (state.loadMode === 'lazy') {
    setTimeout(() => onViewportChange(), perf.timing.navigationViewportDelayMs);
  }
}

// Legacy function for backward compatibility
export async function goToNode(node, animate = true) {
  return updateNavigation(node, animate);
}

