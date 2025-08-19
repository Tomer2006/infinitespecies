import { breadcrumbsEl } from './dom.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap, state } from './state.js';
import { updateDeepLinkFromNode } from './deeplink.js';
import { animateToCam } from './camera.js';
import { requestRender, W, H } from './canvas.js';
import { isStub, loadChunk, preloadNearbyChunks, clearMemory, getMemoryStats } from './lazy-loader.js';
import { showLoading, hideLoading } from './loading.js';

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

export async function goToNode(node, animate = true) {
  try {
    // Load node data if it's a stub
    if (isStub(node)) {
      showLoading(`Loading ${node.name}...`);
      node = await loadChunk(node);
      hideLoading();
    }

    state.current = node;
    state.layout = layoutFor(state.current);
    rebuildNodeMap();
    setBreadcrumbs(state.current);
    
    if (animate) {
      const targetK = Math.min(W / state.layout.diameter, H / state.layout.diameter);
      animateToCam(0, 0, targetK);
    } else {
      state.camera.x = 0;
      state.camera.y = 0;
      state.camera.k = Math.min(W, H) / state.layout.diameter;
    }
    
    requestRender();

    // Background operations
    setTimeout(() => {
      // Preload nearby chunks for smooth navigation
      preloadNearbyChunks(node).catch(() => {});
      
      // Manage memory if we have too many chunks loaded
      const stats = getMemoryStats();
      if (stats.chunksLoaded > 10) {
        clearMemory(5);
      }
    }, 100);
    
  } catch (error) {
    hideLoading();
    console.error('Failed to navigate to node:', error);
    // Fallback: stay on current node
  }
}


