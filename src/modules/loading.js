/**
 * Loading state management module (React-compatible)
 *
 * Provides loading indicator functionality that integrates with React state.
 */

let loadingState = false;

export function showLoading(title = 'Loading…') {
  loadingState = true;
  
  // Call React's loading handler if available
  if (typeof window.__reactShowLoading === 'function') {
    window.__reactShowLoading(title);
  }
}

export function hideLoading() {
  loadingState = false;
  
  // Call React's hide loading handler if available
  if (typeof window.__reactHideLoading === 'function') {
    window.__reactHideLoading();
  }
}

export function isCurrentlyLoading() {
  return loadingState;
}

/**
 * Set loading progress
 * @param {number} progress - Progress value 0-1
 * @param {string} label - Progress label text
 * @param {number} currentStage - Current stage number (1-based)
 * @param {number} totalStages - Total number of stages
 */
export function setProgress(progress, label, currentStage = 1, totalStages = 1) {
  const percentage = Math.round(progress * 100);
  const stageText = `Stage ${currentStage} of ${totalStages}`;
  
  // Call React's progress update handler if available
  if (typeof window.__reactUpdateProgress === 'function') {
    window.__reactUpdateProgress(percentage, label, stageText);
  }
}

export function updateProgress(progress, label, stage) {
  setProgress(progress / 100, label, parseInt(stage?.split(' ')[1]) || 1, parseInt(stage?.split(' ')[3]) || 1);
}
