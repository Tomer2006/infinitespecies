import {
  canvas,
  helpModal,
  helpCloseBtn,
  helpBackToMenuBtn,
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
  backToMenuBtn,
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
import { showLandingPage } from './landing.js';
import { state } from './state.js';
import { updateTooltip } from './tooltip.js';
import { logInfo, logDebug, logTrace } from './logger.js';
import { openProviderSearch } from './providers.js';
import { fitNodeInView, goToNode } from './navigation.js';
import { handleSearch } from './search.js';
import { showLoading, hideLoading, isCurrentlyLoading } from './loading.js';
import { loadFromJSONText } from './data.js';
import { getNodePath } from './deeplink.js';
import { showBigFor, hideBigPreview } from './preview.js';

export function initEvents() {
  let isMiddlePanning = false;
  let lastPan = null;

  // Throttle picking to once per animation frame
  let pickingScheduled = false;
  let lastMouse = { x: 0, y: 0 };

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
        const n = pickNodeAt(lastMouse.x, lastMouse.y);
        const prevId = state.hoverNode?._id || 0;
        const nextId = n?._id || 0;
        state.hoverNode = n;
        // Only update tooltip position every frame; only update content when id changes (handled inside)
        updateTooltip(n, lastMouse.x, lastMouse.y);
        // No canvas re-render needed - highlight is now CSS-based
      });
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.hoverNode = null;
    if (document.getElementById('tooltip')) document.getElementById('tooltip').style.opacity = 0;
    hideBigPreview();
    // No canvas re-render needed - highlight is now CSS-based
  });

  canvas.addEventListener('mousedown', ev => {
    logTrace(`Mouse down: button=${ev.button}, position=(${ev.clientX}, ${ev.clientY})`);
    if (ev.button === 1) {
      isMiddlePanning = true;
      const rect = canvas.getBoundingClientRect();
      lastPan = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      logDebug('Middle mouse pan started');
      ev.preventDefault();
    }
  });
  window.addEventListener('mouseup', () => {
    if (isMiddlePanning) {
      logDebug('Middle mouse pan ended');
    }
    isMiddlePanning = false;
    lastPan = null;
  });

  canvas.addEventListener('contextmenu', async ev => {
    ev.preventDefault();

    // Prevent right-clicks during loading to avoid bugs
    if (isCurrentlyLoading()) {
      console.log('🚫 [EVENTS] Right-click ignored - currently loading data');
      logDebug('Right-click ignored during loading');
      return;
    }

    if (state.current && state.current.parent) await goToNode(state.current.parent, true);
  });

  canvas.addEventListener('click', async ev => {
    if (ev.button !== 0) return;

    // Prevent clicks during loading to avoid bugs
    if (isCurrentlyLoading()) {
      console.log('🚫 [EVENTS] Click ignored - currently loading data');
      logDebug('Click ignored during loading');
      // Visual feedback - briefly change cursor to indicate disabled state
      canvas.style.cursor = 'not-allowed';
      setTimeout(() => {
        canvas.style.cursor = '';
      }, 200);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const screenX = ev.clientX - rect.left;
    const screenY = ev.clientY - rect.top;

    logTrace(`Canvas click: screen=(${screenX}, ${screenY}), canvas_rect=(${rect.left}, ${rect.top}, ${rect.width}, ${rect.height})`);

    const n = pickNodeAt(screenX, screenY);
    if (!n) {
      logDebug('Click missed any node');
      return;
    }

    logInfo(`Node clicked: "${n.name}" (id: ${n._id || 'unknown'})`);
    if (n === state.current) {
      logDebug('Fitting current node in view');
      fitNodeInView(n);
    } else {
      logDebug('Navigating to new node');
      await goToNode(n, true);
    }
  });

  canvas.addEventListener(
    'wheel',
    ev => {
      const scale = Math.exp(-ev.deltaY * 0.0015);
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left,
        my = ev.clientY - rect.top;
      const [wx, wy] = screenToWorld(mx, my);

      const oldK = state.camera.k;
      const oldX = state.camera.x;
      const oldY = state.camera.y;

      state.camera.k *= scale;
      state.camera.x = wx - (mx - rect.width / 2) / state.camera.k;
      state.camera.y = wy - (my - rect.height / 2) / state.camera.k;

      logTrace(`Zoom: deltaY=${ev.deltaY}, scale=${scale.toFixed(4)}, zoom=${oldK.toFixed(4)}→${state.camera.k.toFixed(4)}, pan=(${oldX.toFixed(2)}, ${oldY.toFixed(2)})→(${state.camera.x.toFixed(2)}, ${state.camera.y.toFixed(2)})`);

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
      if (state.DATA_ROOT) (async () => await goToNode(state.DATA_ROOT, true))();
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
    // No canvas re-render needed - highlight is now CSS-based
    const r = document.getElementById('searchResults');
    if (r) { r.style.display = 'none'; r.innerHTML = ''; }
  });

  resetBtn?.addEventListener('click', async () => {
    if (isCurrentlyLoading()) {
      console.log('🚫 [EVENTS] Reset button ignored - currently loading data');
      return;
    }
    if (state.DATA_ROOT) await goToNode(state.DATA_ROOT, true);
    // No canvas re-render needed - highlight is now CSS-based
  });

  fitBtn?.addEventListener('click', () => {
    if (isCurrentlyLoading()) {
      console.log('🚫 [EVENTS] Fit button ignored - currently loading data');
      return;
    }
    if (state.DATA_ROOT) fitNodeInView(state.DATA_ROOT);
  });

  surpriseBtn?.addEventListener('click', () => {
    if (isCurrentlyLoading()) {
      console.log('🚫 [EVENTS] Surprise button ignored - currently loading data');
      return;
    }
    // Pick a random visible leaf by walking the current layout subtree
    if (!state.layout?.root) return;
    const leaves = [];
    for (const d of state.layout.root.descendants()) {
      if (!d.children || d.children.length === 0) leaves.push(d.data);
    }
    if (!leaves.length) return;
    const pick = leaves[Math.floor(Math.random() * leaves.length)];
    state.current = pick;
    fitNodeInView(state.current);
    // No canvas re-render needed - highlight is now CSS-based
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
  backToMenuBtn?.addEventListener('click', () => {
    // Hide topbar and show landing page
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      topbar.style.visibility = 'hidden';
    }
    showLandingPage();
  });
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

  helpBackToMenuBtn?.addEventListener('click', () => {
    // Close help modal and show landing page
    if (helpModal) {
      helpModal.classList.remove('open');
      helpModal.setAttribute('aria-hidden', 'true');
    }
    // Hide topbar and show landing page
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      topbar.style.visibility = 'hidden';
    }
    showLandingPage();
  });
}


