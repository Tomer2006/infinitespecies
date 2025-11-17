import { loadingEl, progressFill, progressLabel, progressPct, stage, topbarEl, canvas } from './dom.js';

let isLoading = false;

export function showLoading(title = 'Loading…') {
  console.log('🔄 [LOADING] Showing loading screen:', title);
  const loadingTitle = document.getElementById('loadingTitle');
  if (loadingTitle) loadingTitle.textContent = title;
  loadingEl.style.display = 'flex';
  stage.setAttribute('aria-busy', 'true');
  isLoading = true;
  setProgress(0, 'Starting…');
  if (topbarEl) topbarEl.style.visibility = 'hidden';
  if (canvas) canvas.classList.add('loading');
}

export function hideLoading() {
  console.log('✅ [LOADING] Hiding loading screen');
  loadingEl.style.display = 'none';
  stage.setAttribute('aria-busy', 'false');
  isLoading = false;
  if (topbarEl) topbarEl.style.visibility = 'visible';
  if (canvas) canvas.classList.remove('loading');
}

export function isCurrentlyLoading() {
  return isLoading;
}

export function setProgress(ratio, label = '') {
  const pct = Math.max(0, Math.min(1, ratio));
  if (progressFill) progressFill.style.width = (pct * 100).toFixed(1) + '%';
  if (progressPct) progressPct.textContent = Math.round(pct * 100) + '%';
  // Keep operation details private by not updating the user-facing label
  // if (label && !document.hidden) progressLabel.textContent = label;
}
