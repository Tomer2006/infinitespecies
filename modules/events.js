import {
  canvas,
  helpModal,
  helpCloseBtn,
  providerSearchBtn,
  copyLinkBtn,
  searchInputEl,
  searchBtn,
  clearBtn,
  resetBtn,
  fitBtn,
  surpriseBtn,
  tooltipSearchBtn,
  loadBtn,
  cancelLoadBtn,
  applyLoadBtn,
  insertSampleBtn,
  fileInput,
  jsonText,
  loadError,
  providerSelect,
  progressLabel
} from './dom.js';
import { requestRender, screenToWorld } from './canvas.js';
import { pickNodeAt } from './picking.js';
import { state } from './state.js';
import { updateTooltip } from './tooltip.js';
import { openProviderSearch } from './providers.js';
import { fitNodeInView, goToNode } from './navigation.js';
import { handleSearch } from './search.js';
import { showLoading, hideLoading } from './loading.js';
import { loadFromJSONText } from './data.js';
import { getNodePath } from './deeplink.js';
import { showBigFor, hideBigPreview } from './preview.js';

export function initEvents() {
  let isMiddlePanning = false;
  let lastPan = null;

  // Throttle picking to once per animation frame
  let pickingScheduled = false;
  let lastMouse = { x: 0, y: 0 };
  let lastPickTime = 0;

  canvas.addEventListener('mousemove', ev => {
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left,
      y = ev.clientY - rect.top;
    lastMouse = { x, y };
    if (isMiddlePanning && lastPan) {
      const dx = x - lastPan.x,
        dy = y - lastPan.y;
      state.camera.x -= dx / state.camera.k;
      state.camera.y -= dy / state.camera.k;
      lastPan = { x, y };
      requestRender();
      // Hide tooltip and big preview while panning
      const tooltipEl = document.getElementById('tooltip');
      if (tooltipEl) tooltipEl.style.opacity = 0;
      hideBigPreview();
      return;
    }

    if (!pickingScheduled) {
      pickingScheduled = true;
      requestAnimationFrame(() => {
        pickingScheduled = false;
        const now = performance.now();
        // Reduce picking frequency when hovering over the same area
        if (now - lastPickTime < 32) return; // ~30fps max picking rate
        lastPickTime = now;
        
        const n = pickNodeAt(lastMouse.x, lastMouse.y);
        const prevId = state.hoverNode?._id || 0;
        const nextId = n?._id || 0;
        state.hoverNode = n;
        updateTooltip(n, lastMouse.x, lastMouse.y);
        if (prevId !== nextId) requestRender();
      });
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.hoverNode = null;
    if (document.getElementById('tooltip')) document.getElementById('tooltip').style.opacity = 0;
    hideBigPreview();
  });

  canvas.addEventListener('mousedown', ev => {
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

  canvas.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    if (state.current && state.current.parent) goToNode(state.current.parent, true);
  });

  canvas.addEventListener('click', ev => {
    if (ev.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const n = pickNodeAt(ev.clientX - rect.left, ev.clientY - rect.top);
    if (!n) return;
    if (n === state.current) fitNodeInView(n);
    else goToNode(n, true);
  });

  canvas.addEventListener(
    'wheel',
    ev => {
      const scale = Math.exp(-ev.deltaY * 0.0015);
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left,
        my = ev.clientY - rect.top;
      const [wx, wy] = screenToWorld(mx, my);
      state.camera.k *= scale;
      state.camera.x = wx - (mx - rect.width / 2) / state.camera.k;
      state.camera.y = wy - (my - rect.height / 2) / state.camera.k;
      requestRender();
      ev.preventDefault();
    },
    { passive: false }
  );

  // Keyboard shortcuts
  window.addEventListener('keydown', e => {
    const active = document.activeElement;
    const tag = (active && active.tagName) || '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable === true);
    if (isTyping) return;
    if (e.code === 'KeyS') {
      const target = state.hoverNode || state.current || state.DATA_ROOT;
      if (target) openProviderSearch(target);
      e.preventDefault();
    }
  });

  // R / F / ?
  window.addEventListener('keydown', e => {
    const active = document.activeElement;
    const tag = (active && active.tagName) || '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active && active.isContentEditable === true);
    if (isTyping) return;

    if (e.code === 'KeyR') {
      if (state.DATA_ROOT) goToNode(state.DATA_ROOT, true);
      e.preventDefault();
    } else if (e.code === 'KeyF') {
      const target = state.hoverNode || state.current;
      if (target) fitNodeInView(target);
      e.preventDefault();
    } else if (e.code === 'Slash' || e.code === 'IntlRo' || e.key === 'F1' || e.code === 'F1') {
      if (!helpModal) return;
      const isOpen = helpModal.classList.contains('open');
      if (isOpen) {
        helpModal.classList.remove('open');
        helpModal.setAttribute('aria-hidden', 'true');
      } else {
        helpModal.classList.add('open');
        helpModal.setAttribute('aria-hidden', 'false');
      }
      e.preventDefault();
    }
  });

  // Tooltip search button
  tooltipSearchBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const target = state.hoverNode || state.current;
    if (target) openProviderSearch(target);
  });

  providerSearchBtn?.addEventListener('click', () => {
    const target = state.hoverNode || state.current || state.DATA_ROOT;
    if (target) openProviderSearch(target);
  });

  // Copy link
  copyLinkBtn?.addEventListener('click', async () => {
    const url = new URL(location.href);
    const path = (state.current ? getNodePath(state.current) : []).join('/');
    url.hash = path ? `#${encodeURIComponent(path)}` : '';
    try {
      await navigator.clipboard.writeText(url.toString());
      if (progressLabel) {
        progressLabel.textContent = 'Link copied';
        progressLabel.style.color = '';
        setTimeout(() => {
          if (progressLabel.textContent === 'Link copied') progressLabel.textContent = '';
        }, 1200);
      }
    } catch (_e) {
      window.prompt('Copy link:', url.toString());
    }
  });

  // Search
  searchBtn?.addEventListener('click', () => handleSearch(progressLabel));
  searchInputEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      handleSearch(progressLabel);
      e.preventDefault();
    }
  });
  clearBtn?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    state.highlightNode = null;
    requestRender();
    const r = document.getElementById('searchResults');
    if (r) { r.style.display = 'none'; r.innerHTML = ''; }
  });

  resetBtn?.addEventListener('click', () => {
    if (state.DATA_ROOT) goToNode(state.DATA_ROOT, true);
    state.highlightNode = null;
    requestRender();
  });

  fitBtn?.addEventListener('click', () => {
    const target = state.hoverNode || state.current;
    if (target) fitNodeInView(target);
  });

  surpriseBtn?.addEventListener('click', () => {
    // Pick a random visible leaf by walking the current layout subtree
    if (!state.layout?.root) return;
    const leaves = [];
    for (const d of state.layout.root.descendants()) {
      if (!d.children || d.children.length === 0) leaves.push(d.data);
    }
    if (!leaves.length) return;
    const pick = leaves[Math.floor(Math.random() * leaves.length)];
    state.current = pick;
    goToNode(state.current, false);
    state.highlightNode = state.current;
    requestRender();
  });

  // JSON modal and loader
  function openModal() {
    const modal = document.getElementById('jsonModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    const modal = document.getElementById('jsonModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (loadError) loadError.textContent = '';
  }

  loadBtn?.addEventListener('click', () => openModal());
  cancelLoadBtn?.addEventListener('click', () => closeModal());
  insertSampleBtn?.addEventListener('click', () => {
    jsonText.value = JSON.stringify(
      {
        name: 'Life',
        children: [
          {
            name: 'Eukarya',
            children: [
              {
                name: 'Animalia',
                children: [
                  {
                    name: 'Chordata',
                    children: [
                      {
                        name: 'Mammalia',
                        children: [
                          {
                            name: 'Primates',
                            children: [
                              { name: 'Hominidae', children: [{ name: 'Homo', children: [{ name: 'Homo sapiens' }] }] }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      null,
      2
    );
  });
  fileInput?.addEventListener('change', () => {
    if (loadError) loadError.textContent = '';
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onerror = () => {
      if (loadError) loadError.textContent = 'Failed to read file.';
    };
    reader.onload = e => {
      jsonText.value = e.target.result;
    };
    reader.readAsText(f);
  });
  applyLoadBtn?.addEventListener('click', async () => {
    try {
      if (loadError) loadError.textContent = '';
      const text = jsonText.value.trim();
      if (!text) {
        if (loadError) loadError.textContent = 'Please paste JSON or choose a file.';
        return;
      }
      closeModal();
      showLoading('Parsing custom JSON…');
      await loadFromJSONText(text);
      hideLoading();
    } catch (err) {
      hideLoading();
      openModal();
      if (loadError) loadError.textContent = err.message || String(err);
    }
  });

  // Demo button removed

  // Help modal close button
  helpCloseBtn?.addEventListener('click', () => {
    if (!helpModal) return;
    helpModal.classList.remove('open');
    helpModal.setAttribute('aria-hidden', 'true');
  });
}


