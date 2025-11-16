import { state } from './state.js';
import { worldToScreen } from './canvas.js';
import { updateNavigation } from './navigation.js';
import { searchResultsEl } from './dom.js';
import { getNodePath } from './deeplink.js';
import { perf } from './settings.js';

export function findAllByQuery(q, limit = perf.search.maxResults) {
  if (!q) return [];
  q = q.trim().toLowerCase();
  if (!q || !state.layout?.root) return [];
  const results = [];
  const stack = [state.layout.root];
  while (stack.length) {
    const d = stack.pop();
    const name = (d.data?.name || '').toLowerCase();
    if (name.includes(q)) {
      results.push(d.data);
      if (results.length >= limit) break;
    }
    const ch = d.children || [];
    for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
  }
  return results;
}

export function pulseAtNode(node) {
  const d = state.nodeLayoutMap.get(node._id);
  if (!d) return;
  const [sx, sy] = worldToScreen(d._vx, d._vy);
  const sr = d._vr * state.camera.k;
  if (sr <= perf.search.pulseMinScreenRadius) return;
  const el = document.getElementById('pulse');
  el.style.display = 'block';
  const posMult = perf.search.pulsePositionMultiplier;
  const sizeMult = perf.search.pulseSizeMultiplier;
  el.style.left = sx - sr * posMult + 'px';
  el.style.top = sy - sr * posMult + 'px';
  el.style.width = sr * sizeMult + 'px';
  el.style.height = sr * sizeMult + 'px';
  el.style.boxShadow = `0 0 ${sr * perf.search.pulseShadowOuter}px ${sr * perf.search.pulseShadowInner}px rgba(113,247,197,.3), inset 0 0 ${sr * perf.search.pulseShadowOuter2}px ${sr * perf.search.pulseShadowInner2}px rgba(113,247,197,.25)`;
  el.style.border = `${perf.search.pulseBorderWidth}px solid ${perf.search.pulseColor}`;
  el
    .animate(
      [
        { transform: `scale(${perf.search.pulseScaleStart})`, opacity: 0.0 },
        { transform: 'scale(1)', opacity: perf.search.pulseOpacity, offset: perf.search.pulseScaleOffset },
        { transform: `scale(${perf.search.pulseScaleEnd})`, opacity: 0.0 }
      ],
      { duration: perf.search.pulseDurationMs, easing: 'ease-out' }
    )
    .onfinish = () => {
    el.style.display = 'none';
  };
}

let resultsEventsBound = false;

function hideResults() {
  if (!searchResultsEl) return;
  searchResultsEl.style.display = 'none';
  searchResultsEl.innerHTML = '';
}

function renderResults(nodes, q) {
  if (!searchResultsEl) return;
  searchResultsEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  nodes.forEach(n => {
    const item = document.createElement('div');
    item.className = 'item';
    item.setAttribute('role', 'option');
    item.dataset.id = String(n._id);
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = n.name || '';
    item.appendChild(nameEl);

    // Add path context under the name for disambiguation
    try {
      const parts = getNodePath(n);
      const parentPath = parts.slice(0, Math.max(0, parts.length - 1)).join(' / ');
      if (parentPath) {
        const pathEl = document.createElement('div');
        pathEl.className = 'path';
        pathEl.textContent = parentPath;
        item.appendChild(pathEl);
      }
    } catch (_e) {
      // best-effort; ignore path errors
    }
    frag.appendChild(item);
  });
  searchResultsEl.appendChild(frag);
  searchResultsEl.style.display = 'block';

  if (!resultsEventsBound) {
    resultsEventsBound = true;
    searchResultsEl.addEventListener('click', e => {
      const target = e.target.closest('.item');
      if (!target) return;
      const id = Number(target.dataset.id || '');
      const d = state.nodeLayoutMap.get(id);
      const node = d?.data;
      if (!node) return;
      updateNavigation(node, false);
      pulseAtNode(state.current);
      // No canvas re-render needed - highlight is now CSS-based
      hideResults();
    });

    document.addEventListener('click', e => {
      const searchbar = document.querySelector('.searchbar');
      if (!searchbar) return;
      if (searchbar.contains(e.target)) return;
      hideResults();
    });
  }
}

export function handleSearch(progressLabelEl) {
  const q = document.getElementById('searchInput').value;
  const matches = findAllByQuery(q, perf.search.maxResults);
  if (!matches.length) {
    if (progressLabelEl) {
      progressLabelEl.textContent = `No match for "${q}"`;
      progressLabelEl.style.color = 'var(--warn)';
      setTimeout(() => {
        progressLabelEl.textContent = '';
        progressLabelEl.style.color = '';
      }, perf.search.noMatchDisplayMs);
    }
    hideResults();
    return;
  }
  if (matches.length === 1) {
    const node = matches[0];
    updateNavigation(node, false);
    pulseAtNode(state.current);
    // No canvas re-render needed - highlight is now CSS-based
    hideResults();
  } else {
    renderResults(matches, q);
  }
}

