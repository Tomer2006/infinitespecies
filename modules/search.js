import { state } from './state.js';
import { requestRender, worldToScreen } from './canvas.js';
import { goToNode } from './navigation.js';
import { searchResultsEl } from './dom.js';
import { getNodePath } from './deeplink.js';

export function findByQuery(q) {
  if (!q) return null;
  q = q.trim().toLowerCase();
  if (!q || !state.layout?.root) return null;
  // Simple on-demand scan of current hierarchy to reduce memory
  const stack = [state.layout.root];
  while (stack.length) {
    const d = stack.pop();
    const name = (d.data?.name || '').toLowerCase();
    if (name.includes(q)) return d.data;
    const ch = d.children || [];
    for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
  }
  return null;
}

export function findAllByQuery(q, limit = 50) {
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
  if (sr <= 2) return;
  const el = document.getElementById('pulse');
  el.style.display = 'block';
  el.style.left = sx - sr * 1.2 + 'px';
  el.style.top = sy - sr * 1.2 + 'px';
  el.style.width = sr * 2.4 + 'px';
  el.style.height = sr * 2.4 + 'px';
  el.style.boxShadow = `0 0 ${sr * 0.6}px ${sr * 0.3}px rgba(113,247,197,.3), inset 0 0 ${sr * 0.5}px ${sr * 0.25}px rgba(113,247,197,.25)`;
  el.style.border = '2px solid rgba(113,247,197,.6)';
  el
    .animate(
      [
        { transform: 'scale(0.9)', opacity: 0.0 },
        { transform: 'scale(1)', opacity: 0.7, offset: 0.2 },
        { transform: 'scale(1.2)', opacity: 0.0 }
      ],
      { duration: 900, easing: 'ease-out' }
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
    const pathEl = document.createElement('div');
    pathEl.className = 'path';
    try {
      const path = getNodePath(n).join(' / ');
      pathEl.textContent = path;
    } catch (_e) {
      pathEl.textContent = '';
    }
    item.appendChild(nameEl);
    item.appendChild(pathEl);
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
      state.current = node;
      goToNode(state.current, false);
      state.highlightNode = state.current;
      pulseAtNode(state.current);
      requestRender();
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
  const matches = findAllByQuery(q, 50);
  if (!matches.length) {
    if (progressLabelEl) {
      progressLabelEl.textContent = `No match for “${q}”`;
      progressLabelEl.style.color = 'var(--warn)';
      setTimeout(() => {
        progressLabelEl.textContent = '';
        progressLabelEl.style.color = '';
      }, 900);
    }
    hideResults();
    return;
  }
  if (matches.length === 1) {
    const node = matches[0];
    state.current = node;
    goToNode(state.current, false);
    state.highlightNode = state.current;
    pulseAtNode(state.current);
    requestRender();
    hideResults();
  } else {
    renderResults(matches, q);
  }
}


