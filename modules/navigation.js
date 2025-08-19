import { breadcrumbsEl } from './dom.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap, state as appState } from './state.js';
import { loadClosestPathSubtree } from './data.js';
import { updateDeepLinkFromNode } from './deeplink.js';
import { animateToCam } from './camera.js';
import { requestRender, W, H } from './canvas.js';

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
    el.addEventListener('click', () => goToNode(n, true));
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

export function goToNode(node, animate = true) {
  appState.current = node;
  appState.layout = layoutFor(appState.current);
  rebuildNodeMap();
  setBreadcrumbs(appState.current);
  if (animate) {
    const targetK = Math.min(W / appState.layout.diameter, H / appState.layout.diameter);
    animateToCam(0, 0, targetK);
  } else {
    appState.camera.x = 0;
    appState.camera.y = 0;
    appState.camera.k = Math.min(W, H) / appState.layout.diameter;
  }
  requestRender();

  // If manifest exists, try to load the closest available subtree for this path
  if (appState.datasetManifest && appState.datasetBaseUrl) {
    const path = [];
    let p = node;
    while (p) { path.unshift(p.name); p = p.parent; }
    const subPath = path.join('/');
    if (subPath && subPath !== appState.currentLoadedPath) {
      loadClosestPathSubtree(subPath).catch(() => {});
    }
  }
}


