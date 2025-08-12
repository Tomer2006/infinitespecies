/* Navigation and Breadcrumbs */
import { breadcrumbsEl } from './dom.js';
import { nodeLayoutMap, setCurrent, setLayout, rebuildNodeMap } from './state.js';
import { layoutFor } from './layout.js';
import { animateToCam, camera } from './camera.js';
import { W, H } from './canvas.js';
import { requestRender } from './render.js';
import { updateDeepLinkFromNode } from './deeplink.js';

export function setBreadcrumbs(node) {
  breadcrumbsEl.innerHTML = "";
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
  // Update URL hash for deep link
  updateDeepLinkFromNode(node);
}

export function fitNodeInView(node, frac = 0.35) { 
  const d = nodeLayoutMap.get(node._id); 
  if (!d) return; 
  const targetRadiusPx = Math.min(W, H) * frac; 
  const k = targetRadiusPx / d._vr; 
  animateToCam(d._vx, d._vy, k); 
}

export function goToNode(node, animate = true) { 
  setCurrent(node); 
  setLayout(layoutFor(node)); 
  rebuildNodeMap(); 
  setBreadcrumbs(node); 
  if (animate) { 
    const pad = 20; 
    const targetK = Math.min((W - pad) / layout.diameter, (H - pad) / layout.diameter); 
    animateToCam(0, 0, targetK); 
  } else { 
    camera.x = 0; 
    camera.y = 0; 
    camera.k = Math.min(W, H) / layout.diameter; 
  } 
  requestRender(); 
}
