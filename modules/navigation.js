import { breadcrumbsEl } from './dom.js';
import { layoutFor } from './layout.js';
import { rebuildNodeMap, state } from './state.js';
import { updateDeepLinkFromNode } from './deeplink.js';
import { animateToCam } from './camera.js';
import { requestRender, W, H } from './canvas.js';
import { loadStubNode, indexTreeProgressive, mapToChildren } from './data.js';
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
    el.addEventListener('click', () => goToNode(n, true).catch(console.error));
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
  // Check if this is a stub node that needs to be loaded
  if (node._isStub) {
    try {
      showLoading(`Loading ${node.name || 'data'}...`);
      const loadedData = await loadStubNode(node);
      
      // Convert the loaded data to proper tree structure
      const newChildren = mapToChildren(loadedData);
      
      // Replace stub properties with real data
      delete node._isStub;
      delete node._lazyFiles;
      delete node._stubPath;
      delete node._hasChildren;
      
      // Add the loaded children
      node.children = newChildren;
      
      // Re-index the node and its children
      const tempRoot = { name: 'temp', children: [node] };
      await indexTreeProgressive(tempRoot);
      
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('Failed to load lazy node:', error);
      // Continue with stub node if loading fails
    }
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
}


