/* Event Handlers and Input Management */
import { canvas, searchInputEl, ttip } from './dom.js';
import { camera } from './camera.js';
import { pickNodeAt } from './picking.js';
import { setHoverNode, hoverNode, current, DATA_ROOT, setHighlightNode } from './state.js';
import { updateTooltip } from './tooltip.js';
import { requestRender } from './render.js';
import { goToNode, fitNodeInView } from './navigation.js';
import { handleSearch, clearSearch, surpriseMe } from './search.js';
import { openProviderSearch, getSearchTarget } from './providers.js';
import { W, H } from './canvas.js';

let isMiddlePanning = false, lastPan = null;

export function setupMouseEvents() {
  canvas.addEventListener('mousemove', async (ev) => {
    const rect = canvas.getBoundingClientRect(); 
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    if (isMiddlePanning && lastPan) { 
      const dx = x - lastPan.x, dy = y - lastPan.y; 
      camera.x -= dx / camera.k; 
      camera.y -= dy / camera.k; 
      lastPan = { x, y }; 
      requestRender(); 
      ttip.style.opacity = 0;
      const images = await import('./images.js');
      if (images.thumbDelayTimer) { 
        clearTimeout(images.thumbDelayTimer); 
        images.thumbDelayTimer = null; 
      }
      if (!images.isPreviewPinned) images.hideBigPreview();
      return; 
    }
    const n = pickNodeAt(x, y); 
    setHoverNode(n); 
    updateTooltip(n, x, y); 
    requestRender();
  });

  canvas.addEventListener('mouseleave', async () => { 
    setHoverNode(null); 
    ttip.style.opacity = 0; 
    const images = await import('./images.js');
    images.lastThumbShownForId = 0; 
    if (images.thumbDelayTimer) { 
      clearTimeout(images.thumbDelayTimer); 
      images.thumbDelayTimer = null; 
    } 
    if (!images.isPreviewPinned) images.hideBigPreview(); 
    requestRender(); 
  });

  canvas.addEventListener('mousedown', (ev) => { 
    if (ev.button === 1) { 
      isMiddlePanning = true; 
      const rect = canvas.getBoundingClientRect(); 
      lastPan = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }; 
      ev.preventDefault(); 
    } 
  });

  window.addEventListener('mouseup', () => { 
    isMiddlePanning = false; 
    lastPan = null; 
  });

  canvas.addEventListener('contextmenu', (ev) => { 
    ev.preventDefault(); 
    if (current && current.parent) goToNode(current.parent, true); 
  });

  canvas.addEventListener('click', (ev) => { 
    if (ev.button !== 0) return; 
    const rect = canvas.getBoundingClientRect(); 
    const n = pickNodeAt(ev.clientX - rect.left, ev.clientY - rect.top); 
    if (!n) return; 
    if (n === current) fitNodeInView(n); 
    else goToNode(n, true); 
  });

  canvas.addEventListener('wheel', (ev) => { 
    const scale = Math.exp(-ev.deltaY * 0.0015); 
    const rect = canvas.getBoundingClientRect(); 
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top; 
    const [wx, wy] = screenToWorld(mx, my); 
    camera.k *= scale; 
    camera.x = wx - (mx - W/2) / camera.k; 
    camera.y = wy - (my - H/2) / camera.k; 
    requestRender(); 
    ev.preventDefault(); 
  }, { passive: false });
}

function screenToWorld(px, py) { 
  return [camera.x + (px - W/2) / camera.k, camera.y + (py - H/2) / camera.k]; 
}

export function setupKeyboardEvents() {
  // Search Enter key
  if (searchInputEl) {
    searchInputEl.addEventListener('keydown', (e) => { 
      if (e.key === 'Enter') { 
        handleSearch(); 
        e.preventDefault(); 
      } 
    });
  }

  // Provider search
  window.addEventListener('keydown', async (e) => {
    const active = document.activeElement;
    const tag = (active && active.tagName) || '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable === true);
    if (isTyping) return;
    if (e.code === 'KeyS') {
      const target = getSearchTarget(); 
      if (target) { 
        openProviderSearch(target); 
      }
      e.preventDefault();
    }
  });

  // Other shortcuts
  window.addEventListener('keydown', async (e) => {
    const active = document.activeElement;
    const tag = (active && active.tagName) || '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable === true);
    if (isTyping) return;

    if (e.code === 'KeyR') {
      if (DATA_ROOT) { 
        goToNode(DATA_ROOT, true); 
      }
      e.preventDefault();
    } else if (e.code === 'KeyF') {
      const target = hoverNode || current;
      if (target) { 
        fitNodeInView(target, 0.4); 
      }
      e.preventDefault();
    } else if (e.code === 'KeyP') {
      const target = hoverNode || current;
      const images = await import('./images.js');
      if (!images.isPreviewPinned) {
        if (target) {
          images.pinPreviewFor(target);
          images.showBigFor(target);
        }
      } else {
        images.unpinPreview(); 
        if (!hoverNode) images.hideBigPreview();
      }
      e.preventDefault();
    } else if (e.code === 'Slash' || e.code === 'IntlRo' || e.key === 'F1' || e.code === 'F1') {
      const { openHelp, closeHelp } = await import('./help.js');
      const { helpModal } = await import('./dom.js');
      const isOpen = helpModal && helpModal.classList.contains('open');
      if (isOpen) closeHelp(); 
      else openHelp();
      e.preventDefault();
    }
  });
}

export function setupButtonEvents() {
  // Search buttons
  document.getElementById('searchBtn')?.addEventListener('click', handleSearch);
  document.getElementById('clearBtn')?.addEventListener('click', clearSearch);
  document.getElementById('surpriseBtn')?.addEventListener('click', surpriseMe);
  
  // Navigation buttons
  document.getElementById('resetBtn')?.addEventListener('click', () => { 
    if (DATA_ROOT) goToNode(DATA_ROOT, true); 
    setHighlightNode(null); 
    requestRender(); 
  });
  
  document.getElementById('fitBtn')?.addEventListener('click', () => { 
    const target = hoverNode || current; 
    if (target) { 
      fitNodeInView(target, 0.4); 
    } 
  });

  // Provider search
  document.getElementById('providerSearchBtn')?.addEventListener('click', () => { 
    const target = getSearchTarget(); 
    if (target) { 
      openProviderSearch(target); 
    } 
  });
  
  document.getElementById('tooltipSearchBtn')?.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    const target = hoverNode || current; 
    if (target) { 
      openProviderSearch(target); 
    } 
  });
}
