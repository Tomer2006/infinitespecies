import { breadcrumbsEl } from './dom.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap, state } from './state.js';
import { updateDeepLinkFromNode } from './deeplink.js';
import { animateToCam } from './camera.js';
import { requestRender, W, H } from './canvas.js';
import { showLoading, hideLoading } from './loading.js';
import { logInfo, logWarn, logDebug, logTrace } from './logger.js';

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
  if (!d) return;
  const targetRadiusPx = Math.min(W, H) * 0.5;
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

  if (animate) {
    const targetK = Math.min(W / state.layout.diameter, H / state.layout.diameter);
    logDebug(`Starting camera animation: zoom to ${targetK.toFixed(4)}`);
    animateToCam(0, 0, targetK);
  } else {
    state.camera.x = 0;
    state.camera.y = 0;
    state.camera.k = Math.min(W, H) / state.layout.diameter;
    logDebug(`Camera set instantly: zoom to ${state.camera.k.toFixed(4)}`);
  }

  requestRender();

  const endTime = performance.now();
  logInfo(`Navigation completed: ${node.name}, ${(endTime - startTime).toFixed(2)}ms total`);
}

// Legacy function for backward compatibility
export async function goToNode(node, animate = true) {
  return updateNavigation(node, animate);
}

