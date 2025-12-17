/**
 * Landing page and application initialization module
 *
 * Manages the initial application startup sequence, landing page UI,
 * data loading mode selection, and deep link resolution.
 * Handles fallback scenarios when data loading fails.
 */

import { showLoading, hideLoading } from './loading.js';
import { loadEager } from './data.js';
import { decodePath, findNodeByPath } from './deeplink.js';
import { updateNavigation, fitNodeInView } from './navigation.js';
import { state } from './state.js';
import { tick } from './canvas.js';
import { logWarn } from './logger.js';
import { perf } from './settings.js';

export function showLandingPage() {
  const landingPage = document.getElementById('landingPage');
  if (landingPage) {
    landingPage.style.display = 'flex';
    landingPage.setAttribute('aria-hidden', 'false');
  }
  const canvas = document.getElementById('view');
  if (canvas) {
    canvas.style.pointerEvents = 'none';
  }
}

export function hideLandingPage() {
  const landingPage = document.getElementById('landingPage');
  if (landingPage) {
    landingPage.style.display = 'none';
    landingPage.setAttribute('aria-hidden', 'true');
  }
  const canvas = document.getElementById('view');
  if (canvas) {
    canvas.style.pointerEvents = 'auto';
  }
}

export async function initDataAndDeepLinks() {
  // Initialize deep links
  initDeepLinks();

  // Load data (eager mode)
  await initData();
}

function initDeepLinks() {
  // Navigate when hash changes
  window.addEventListener('hashchange', async () => {
    const hash = decodePath(location.hash.slice(1));
    if (!hash || !state.DATA_ROOT) return;
    const node = await findNodeByPath(hash);
    if (node) updateNavigation(node, true);
  });
}

async function initData() {
  console.log('🚀 [LANDING] Starting data initialization process');
  const startTime = performance.now();

  const params = new URLSearchParams(location.search);
  const qUrl = params.get('data');

  console.log('📋 [LANDING] URL parameters:', { qUrl, search: location.search });

  // Add default data sources - split files in data folder
  const candidates = [];
  if (qUrl) {
    candidates.push(qUrl);
    console.log('🔗 [LANDING] Adding query URL to candidates:', qUrl);
  }
  candidates.push('data/manifest.json');
  console.log('📁 [LANDING] Candidate URLs prepared:', candidates);

  let attemptCount = 0;

  // Try each candidate with eager loading
  for (const url of candidates) {
    attemptCount++;
    const attemptStartTime = performance.now();

    try {
      console.log(`🎯 [LANDING] Attempt ${attemptCount}/${candidates.length}: Loading ${url}`);
      showLoading(`Loading ${url}…`);

      await loadEager(url);

      const attemptDuration = performance.now() - attemptStartTime;
      console.log(`✅ [LANDING] SUCCESS: ${url} loaded in ${attemptDuration.toFixed(2)}ms`);
      hideLoading();

      console.log('🎨 [LANDING] Triggering initial render and fitting view...');
      state.layoutChanged = true;
      fitNodeInView(state.DATA_ROOT);
      tick();

      const totalDuration = performance.now() - startTime;
      console.log(`🎉 [LANDING] Data loading completed successfully in ${totalDuration.toFixed(2)}ms`);
      return;
    } catch (err) {
      const attemptDuration = performance.now() - attemptStartTime;
      console.error(`❌ [LANDING] FAILED: Attempt ${attemptCount} for ${url} failed after ${attemptDuration.toFixed(2)}ms`, err);
      logWarn(`Failed to load ${url}: ${err.message}`);
    }
  }

  console.error('💥 [LANDING] ALL CANDIDATES FAILED');

  // If all else fails, prompt user to load their own JSON
  hideLoading();
  const modal = document.getElementById('jsonModal');
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  const label = document.getElementById('progressLabel');
  if (label) {
    label.textContent = 'No data found. Use Load JSON to import your taxonomy.';
  }
}

export async function initTestDataAndDeepLinks() {
  initDeepLinks();
  await initTestData();
}

async function initTestData() {
  console.log('🚀 [LANDING] Test data not supported in eager mode.');
  alert('Test data loading is not currently supported in eager mode.');
}

export function initLandingPage() {
  console.log('🎯 [LANDING] Initializing landing page buttons...');

  try {
    const startExplorationBtn = document.getElementById('startExplorationBtn');
    const helpBtn = document.getElementById('helpBtn');
    const aboutBtn = document.getElementById('aboutBtn');
    const testDataBtn = document.getElementById('testDataBtn');

    // Start Exploration
    if (startExplorationBtn) {
      startExplorationBtn.addEventListener('click', async () => {
        try {
          if (document.activeElement) document.activeElement.blur();
          hideLandingPage();
          const topbar = document.querySelector('.topbar');
          if (topbar) topbar.style.visibility = 'visible';
          await initDataAndDeepLinks();
        } catch (error) {
          console.error('❌ [LANDING] Error in startExplorationBtn:', error);
        }
      });
    }


    // Help
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
          helpModal.classList.add('open');
          helpModal.setAttribute('aria-hidden', 'false');
        }
      });
    }

    // About
    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => {
        showAboutModal();
      });
    }

    // Test Data
    if (testDataBtn) {
      testDataBtn.addEventListener('click', async () => {
        if (document.activeElement) document.activeElement.blur();
        hideLandingPage();
        const topbar = document.querySelector('.topbar');
        if (topbar) topbar.style.visibility = 'visible';
        await initTestDataAndDeepLinks();
      });
    }

    console.log('🎉 [LANDING] All landing page buttons initialized');
  } catch (error) {
    console.error('❌ [LANDING] Critical error initializing landing page:', error);
  }
}

function showAboutModal() {
  const aboutModal = document.getElementById('aboutModal');
  if (!aboutModal) return;

  aboutModal.classList.add('open');
  aboutModal.setAttribute('aria-hidden', 'false');
}

export function initAboutModal() {
  const aboutModal = document.getElementById('aboutModal');
  const closeBtn = document.getElementById('aboutCloseBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const aboutBtn = document.getElementById('aboutBtn');
      if (document.activeElement) document.activeElement.blur();

      aboutModal.classList.remove('open');
      aboutModal.setAttribute('aria-hidden', 'true');

      if (aboutBtn) aboutBtn.focus();
    });
  }

  // Close on backdrop click
  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) {
        aboutModal.classList.remove('open');
        aboutModal.setAttribute('aria-hidden', 'true');
      }
    });
  }
}

