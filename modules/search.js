import { state } from './state.js';
import { requestRender, worldToScreen } from './canvas.js';
import { goToNode } from './navigation.js';

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

export function handleSearch(progressLabelEl) {
  const q = document.getElementById('searchInput').value;
  const node = findByQuery(q);
  if (!node) {
    if (progressLabelEl) {
      progressLabelEl.textContent = `No match for “${q}”`;
      progressLabelEl.style.color = 'var(--warn)';
      setTimeout(() => {
        progressLabelEl.textContent = '';
        progressLabelEl.style.color = '';
      }, 900);
    }
    return;
  }
  state.current = node;
  goToNode(state.current, false);
  state.highlightNode = state.current;
  pulseAtNode(state.current);
  requestRender();
}


