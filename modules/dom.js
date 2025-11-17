/**
 * DOM element references module
 *
 * Centralized collection of DOM element references used throughout the application.
 * Provides a single source of truth for DOM queries and avoids repeated
 * document.getElementById() calls scattered throughout the codebase.
 */

export const canvas = document.getElementById('view');
export const stage = document.getElementById('stage');
export const topbarEl = document.querySelector('.topbar');
export const ttip = document.getElementById('tooltip');
export const tName = ttip?.querySelector('.name');
export const tMeta = ttip?.querySelector('.meta');


export const bigPreview = document.getElementById('bigPreview');
export const bigPreviewImg = document.getElementById('bigPreviewImg');
export const bigPreviewCap = document.getElementById('bigPreviewCap');
export const bigPreviewEmpty = document.getElementById('bigPreviewEmpty');

export const helpModal = document.getElementById('helpModal');
export const helpCloseBtn = document.getElementById('helpCloseBtn');
export const helpBackToMenuBtn = document.getElementById('helpBackToMenuBtn');

export const providerSelect = document.getElementById('providerSelect');
export const providerSearchBtn = document.getElementById('providerSearchBtn');

export const breadcrumbsEl = document.getElementById('breadcrumbs');
export const fpsEl = document.getElementById('fps');

export const loadingEl = document.getElementById('loading');
export const progressFill = document.getElementById('progressFill');
export const progressLabel = document.getElementById('progressLabel');
export const progressPct = document.getElementById('progressPct');

export const jsonModal = document.getElementById('jsonModal');
export const loadBtn = document.getElementById('loadBtn');
export const backToMenuBtn = document.getElementById('backToMenuBtn');
export const cancelLoadBtn = document.getElementById('cancelLoadBtn');
export const applyLoadBtn = document.getElementById('applyLoadBtn');
export const insertSampleBtn = document.getElementById('insertSampleBtn');
export const fileInput = document.getElementById('fileInput');
export const jsonText = document.getElementById('jsonText');
export const loadError = document.getElementById('loadError');

export const searchInputEl = document.getElementById('searchInput');
export const searchResultsEl = document.getElementById('searchResults');
export const copyLinkBtn = document.getElementById('copyLinkBtn');
export const fitBtn = document.getElementById('fitBtn');
export const tooltipSearchBtn = document.getElementById('tooltipSearchBtn');
export const clearBtn = document.getElementById('clearBtn');
export const searchBtn = document.getElementById('searchBtn');
export const surpriseBtn = document.getElementById('surpriseBtn');
export const resetBtn = document.getElementById('resetBtn');
