import { loadingEl, progressFill, progressLabel, progressPct, stage } from './dom.js';

export function showLoading(title = 'Loading…') {
  document.getElementById('loadingTitle').textContent = title;
  loadingEl.style.display = 'flex';
  stage.setAttribute('aria-busy', 'true');
  setProgress(0, 'Starting…');
}

export function hideLoading() {
  loadingEl.style.display = 'none';
  stage.setAttribute('aria-busy', 'false');
}

export function setProgress(ratio, label = '') {
  const pct = Math.max(0, Math.min(1, ratio));
  progressFill.style.width = (pct * 100).toFixed(1) + '%';
  progressPct.textContent = Math.round(pct * 100) + '%';
  // Import performance config for background tab handling
  import('./performance-config.js').then(({ PERFORMANCE_CONFIG }) => {
    if (label && (!document.hidden || !PERFORMANCE_CONFIG.suppressProgressInBackground)) {
      progressLabel.textContent = label;
    }
  });
}


