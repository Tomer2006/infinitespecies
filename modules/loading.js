/**
 * Loading screen and progress management module
 *
 * Manages the loading overlay UI, progress bars, and loading state.
 * Provides functions to show/hide loading screens and update progress
 * indicators during data loading operations.
 */

import { loadingEl, progressFill, progressLabel, progressPct, stageInfo, stage, topbarEl, canvas, loadingTimer } from './dom.js';

let isLoading = false;

let timerInterval;
let startTime;

export function showLoading(title = 'Loading…') {
  console.log('🔄 [LOADING] Showing loading screen:', title);
  const loadingTitle = document.getElementById('loadingTitle');
  if (loadingTitle) loadingTitle.textContent = title;
  loadingEl.style.display = 'flex';
  stage.setAttribute('aria-busy', 'true');
  isLoading = true;
  if (stageInfo) stageInfo.style.display = 'none';
  setProgress(0, 'Starting…', 1, 3);
  if (topbarEl) topbarEl.style.visibility = 'hidden';
  if (canvas) canvas.classList.add('loading');
  startTimer();
}

export function hideLoading() {
  console.log('✅ [LOADING] Hiding loading screen');
  stopTimer();
  loadingEl.style.display = 'none';
  stage.setAttribute('aria-busy', 'false');
  isLoading = false;
  if (topbarEl) topbarEl.style.visibility = 'visible';
  if (canvas) canvas.classList.remove('loading');
}

export function isCurrentlyLoading() {
  return isLoading;
}

function startTimer() {
  stopTimer(); // Clear any existing timer
  startTime = Date.now();
  if (loadingTimer) loadingTimer.textContent = '00:00';

  timerInterval = setInterval(() => {
    if (!loadingTimer) return;
    const elapsed = Date.now() - startTime;
    const totalSeconds = Math.floor(elapsed / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    loadingTimer.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

export function setProgress(ratio, label = '', currentStage = null, totalStages = null) {
  const pct = Math.max(0, Math.min(1, ratio));
  if (progressFill) progressFill.style.width = (pct * 100).toFixed(1) + '%';
  if (progressPct) progressPct.textContent = Math.round(pct * 100) + '%';

  // Update stage info display
  if (stageInfo) {
    if (currentStage !== null && totalStages !== null) {
      stageInfo.textContent = `Stage ${currentStage} of ${totalStages}`;
      stageInfo.style.display = 'block';
    } else {
      stageInfo.style.display = 'none';
    }
  }

  // Format label (remove stage prefix since it's now separate)
  if (label && !document.hidden) progressLabel.textContent = label;
}
