/* Search Functionality */
import { nameIndex, setHighlightNode, setCurrent, setLayout, rebuildNodeMap } from './state.js';
import { setBreadcrumbs } from './navigation.js';
import { animateToCam } from './camera.js';
import { layoutFor } from './layout.js';
import { W, H } from './canvas.js';
import { requestRender } from './render.js';
import { progressLabel, nodeLayoutMap } from './state.js';
import { searchInputEl } from './dom.js';

export function findByQuery(q) { 
  if (!q) return null; 
  q = q.trim().toLowerCase(); 
  if (!q) return null; 
  const exact = nameIndex.get(q); 
  if (exact && exact.length) return exact[0]; 
  for (const [k, arr] of nameIndex) { 
    if (k.includes(q)) return arr[0]; 
  } 
  return null; 
}

export function pulseAtNode(node) { 
  const d = nodeLayoutMap.get(node._id); 
  if (!d) return; 
  const [sx, sy] = worldToScreen(d._vx, d._vy); 
  const sr = d._vr * camera.k; 
  if (sr <= 2) return; 
  const el = document.getElementById('pulse'); 
  el.style.display = "block"; 
  el.style.left = (sx - sr * 1.2) + "px"; 
  el.style.top = (sy - sr * 1.2) + "px"; 
  el.style.width = (sr * 2.4) + "px"; 
  el.style.height = (sr * 2.4) + "px"; 
  el.style.boxShadow = `0 0 ${sr * .6}px ${sr * .3}px rgba(113,247,197,.3), inset 0 0 ${sr * .5}px ${sr * .25}px rgba(113,247,197,.25)`; 
  el.style.border = "2px solid rgba(113,247,197,.6)"; 
  el.animate([
    { transform: 'scale(0.9)', opacity: .0 }, 
    { transform: 'scale(1)', opacity: .7, offset: .2 }, 
    { transform: 'scale(1.2)', opacity: .0 }
  ], { duration: 900, easing: 'ease-out' }).onfinish = () => { 
    el.style.display = "none"; 
  }; 
}

function worldToScreen(x, y) { 
  return [W/2 + (x - camera.x) * camera.k, H/2 + (y - camera.y) * camera.k]; 
}

export function handleSearch() { 
  const q = searchInputEl.value; 
  const node = findByQuery(q); 
  if (!node) { 
    progressLabel.textContent = `No match for "${q}"`; 
    progressLabel.style.color = 'var(--warn)'; 
    setTimeout(() => { 
      progressLabel.textContent = ""; 
      progressLabel.style.color = ""; 
    }, 900); 
    return; 
  } 
  setCurrent(node); 
  setLayout(layoutFor(node)); 
  rebuildNodeMap(); 
  setBreadcrumbs(node); 
  animateToCam(0, 0, Math.min(W, H) / layout.diameter); 
  setHighlightNode(node); 
  pulseAtNode(node); 
  requestRender(); 
}

export function clearSearch() {
  searchInputEl.value = "";
  setHighlightNode(null);
  requestRender();
}

export async function surpriseMe() {
  const { allNodes } = await import('./state.js');
  if (!allNodes.length) return; 
  const leaves = allNodes.filter(n => !n.children || n.children.length === 0); 
  if (!leaves.length) return; 
  const pick = leaves[Math.floor(Math.random() * leaves.length)]; 
  setCurrent(pick); 
  setLayout(layoutFor(pick)); 
  rebuildNodeMap(); 
  setBreadcrumbs(pick); 
  animateToCam(0, 0, Math.min(W, H) / layout.diameter); 
  setHighlightNode(pick); 
  pulseAtNode(pick); 
  requestRender(); 
}
