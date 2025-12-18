/**
 * DOM element references module (React-compatible)
 *
 * Provides getters for DOM elements that work with React's dynamic rendering.
 * Elements are looked up on-demand rather than cached at module load time.
 */

// Canvas and stage are accessed via getter functions for React compatibility
export const getCanvas = () => {
  // Prefer the React canvas reference if set
  if (window.__reactCanvas) return window.__reactCanvas;
  return document.getElementById('view');
};

export const getStage = () => {
  // Look for the stage element by class first (React uses className)
  const stage = document.querySelector('.stage');
  if (stage) return stage;
  return document.getElementById('stage');
};

// Export these as getters for backwards compatibility
export const canvas = { get current() { return getCanvas(); } };
export const stage = { get current() { return getStage(); } };

// Legacy exports for modules that use direct references
export const topbarEl = { get current() { return document.querySelector('.topbar'); } };
export const ttip = { get current() { return document.getElementById('tooltip'); } };
export const tName = { get current() { return document.querySelector('.tooltip .name'); } };
export const tMeta = { get current() { return document.querySelector('.tooltip .meta'); } };

export const bigPreview = { get current() { return document.getElementById('bigPreview'); } };
export const bigPreviewImg = { get current() { return document.getElementById('bigPreviewImg'); } };
export const bigPreviewCap = { get current() { return document.getElementById('bigPreviewCap'); } };
export const bigPreviewEmpty = { get current() { return document.getElementById('bigPreviewEmpty'); } };

export const helpModal = { get current() { return document.getElementById('helpModal'); } };
export const helpCloseBtn = { get current() { return document.getElementById('helpCloseBtn'); } };

export const providerSelect = { get current() { return document.getElementById('providerSelect'); } };
export const providerSearchBtn = { get current() { return document.getElementById('providerSearchBtn'); } };

export const breadcrumbsEl = { get current() { return document.getElementById('breadcrumbs'); } };
export const fpsEl = { get current() { return document.getElementById('fps'); } };

export const loadingEl = { get current() { return document.getElementById('loading'); } };
export const progressFill = { get current() { return document.getElementById('progressFill'); } };
export const progressLabel = { get current() { return document.getElementById('progressLabel'); } };
export const progressPct = { get current() { return document.getElementById('progressPct'); } };
export const stageInfo = { get current() { return document.getElementById('stageInfo'); } };
export const loadingTimer = { get current() { return document.getElementById('loadingTimer'); } };

export const jsonModal = { get current() { return document.getElementById('jsonModal'); } };
export const loadBtn = { get current() { return document.getElementById('loadBtn'); } };
export const backToMenuBtn = { get current() { return document.getElementById('backToMenuBtn'); } };
export const cancelLoadBtn = { get current() { return document.getElementById('cancelLoadBtn'); } };
export const applyLoadBtn = { get current() { return document.getElementById('applyLoadBtn'); } };
export const insertSampleBtn = { get current() { return document.getElementById('insertSampleBtn'); } };
export const fileInput = { get current() { return document.getElementById('fileInput'); } };
export const jsonText = { get current() { return document.getElementById('jsonText'); } };
export const loadError = { get current() { return document.getElementById('loadError'); } };

export const searchInputEl = { get current() { return document.getElementById('searchInput'); } };
export const searchResultsEl = { get current() { return document.getElementById('searchResults'); } };
export const copyLinkBtn = { get current() { return document.getElementById('copyLinkBtn'); } };
export const fitBtn = { get current() { return document.getElementById('fitBtn'); } };
export const tooltipSearchBtn = { get current() { return document.getElementById('tooltipSearchBtn'); } };
export const clearBtn = { get current() { return document.getElementById('clearBtn'); } };
export const searchBtn = { get current() { return document.getElementById('searchBtn'); } };
export const surpriseBtn = { get current() { return document.getElementById('surpriseBtn'); } };
export const resetBtn = { get current() { return document.getElementById('resetBtn'); } };
