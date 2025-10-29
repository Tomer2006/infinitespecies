// Landing page module for biozoom
// Handles the initial start menu and navigation to different app sections

import { showLoading, hideLoading } from './loading.js';
import { loadFromUrl, loadEager, loadLazy } from './data.js';
import { decodePath, findNodeByPath } from './deeplink.js';
import { updateNavigation } from './navigation.js';
import { state } from './state.js';
import { tick } from './canvas.js';
import { logWarn } from './logger.js';

export function showLandingPage() {
  const landingPage = document.getElementById('landingPage');
  if (landingPage) {
    landingPage.style.display = 'flex';
    landingPage.setAttribute('aria-hidden', 'false');
  }
}

export function hideLandingPage() {
  const landingPage = document.getElementById('landingPage');
  if (landingPage) {
    landingPage.style.display = 'none';
    landingPage.setAttribute('aria-hidden', 'true');
  }
}

export async function initDataAndDeepLinks() {
  // Initialize deep links
  initDeepLinks();

  // Load data (eager mode)
  await initData();

  // After data load completes, attempt a jump to a lightweight start node
  // Note: jump is triggered inside setDataRoot after layout/indexing
}

export async function initDataAndDeepLinksLazy() {
  // Initialize deep links
  initDeepLinks();

  // Load data in lazy mode
  await initDataLazy();

  // After data load completes, attempt a jump to a lightweight start node
  // Note: jump is triggered inside setDataRoot after layout/indexing
}

function initDeepLinks() {
  // Navigate when hash changes
  window.addEventListener('hashchange', async () => {
    const hash = decodePath(location.hash.slice(1));
    if (!hash || !state.DATA_ROOT) return;
    const node = await findNodeByPath(hash);
    if (node) updateNavigation(node, true);
  });

  // On first load, apply hash if present (no-op until data exists)
  setTimeout(async () => {
    const hash = decodePath(location.hash.slice(1));
    if (hash && state.DATA_ROOT) {
      const node = await findNodeByPath(hash);
      if (node) updateNavigation(node, true);
    }
  }, 0);
}

async function initData() {
  console.log('🚀 [LANDING] Starting data initialization process');
  const startTime = performance.now();

  const params = new URLSearchParams(location.search);
  const qUrl = params.get('data');

  console.log('📋 [LANDING] URL parameters:', { qUrl, search: location.search });

  // Always use eager loading mode for split files
  const mode = 'eager';
  console.log('⚡ [LANDING] Using eager loading mode for optimal performance');

  // Prepare candidate URLs - always look for split files first
  const candidates = [];
  if (qUrl) {
    candidates.push(qUrl);
    console.log('🔗 [LANDING] Adding query URL to candidates:', qUrl);
  }

  // Add default data sources - split files in data folder
  candidates.push('data/manifest.json');  // Split files manifest
  console.log('📁 [LANDING] Candidate URLs prepared:', candidates);

  let attemptCount = 0;

  // Try each candidate with eager loading
  for (const url of candidates) {
    attemptCount++;
    const attemptStartTime = performance.now();

    try {
      console.log(`🎯 [LANDING] Attempt ${attemptCount}/${candidates.length}: Loading ${url}`);
      console.log('⏳ [LANDING] Showing loading screen...');
      showLoading(`Loading ${url} (eager mode)…`);

      console.log('📊 [LANDING] Calling loadEager with URL:', url);
      await loadEager(url);

      const attemptDuration = performance.now() - attemptStartTime;
      console.log(`✅ [LANDING] SUCCESS: ${url} loaded in ${attemptDuration.toFixed(2)}ms`);
      console.log('🔄 [LANDING] Hiding loading screen...');
      hideLoading();

      console.log('🎨 [LANDING] Triggering initial render...');
      tick();

      const totalDuration = performance.now() - startTime;
      console.log(`🎉 [LANDING] Data loading completed successfully in ${totalDuration.toFixed(2)}ms`);
      return;
    } catch (err) {
      const attemptDuration = performance.now() - attemptStartTime;
      console.error(`❌ [LANDING] FAILED: Attempt ${attemptCount} for ${url} failed after ${attemptDuration.toFixed(2)}ms`);
      console.error('🔍 [LANDING] Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      logWarn(`Failed to load ${url}: ${err.message}`);
      console.log('🔄 [LANDING] Trying next candidate...');
      // try next candidate
    }
  }

  console.error('💥 [LANDING] ALL CANDIDATES FAILED: No data sources could be loaded');
  console.log('📝 [LANDING] Falling back to manual JSON loading prompt');

  // If all else fails, prompt user to load their own JSON
  hideLoading();
  const modal = document.getElementById('jsonModal');
  if (modal) {
    console.log('🪟 [LANDING] Showing JSON modal for manual upload');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  const label = document.getElementById('progressLabel');
  if (label) {
    label.textContent = 'No data found. Use Load JSON to import your taxonomy.';
  }

  const totalDuration = performance.now() - startTime;
  console.error(`⏰ [LANDING] Total initialization time: ${totalDuration.toFixed(2)}ms - FAILED`);
}

async function initDataLazy() {
  console.log('🚀 [LANDING] Starting lazy data initialization');
  const startTime = performance.now();

  try {
    console.log('⚡ [LANDING] Using lazy loading mode');
    showLoading('Loading tree skeleton (lazy mode)…');

    console.log('📊 [LANDING] Calling loadLazy');
    await loadLazy('data lazy');

    const totalDuration = performance.now() - startTime;
    console.log(`✅ [LANDING] Lazy loading completed successfully in ${totalDuration.toFixed(2)}ms`);
    console.log('🔄 [LANDING] Hiding loading screen...');
    hideLoading();

    console.log('🎨 [LANDING] Triggering initial render...');
    tick();

    return;
  } catch (err) {
    const totalDuration = performance.now() - startTime;
    console.error(`❌ [LANDING] Lazy loading failed after ${totalDuration.toFixed(2)}ms`);
    console.error('🔍 [LANDING] Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });

    logWarn(`Failed to load lazy data: ${err.message}`);
    
    // Fall back to manual JSON loading prompt
    hideLoading();
    const modal = document.getElementById('jsonModal');
    if (modal) {
      console.log('🪟 [LANDING] Showing JSON modal for manual upload');
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
    const label = document.getElementById('progressLabel');
    if (label) {
      label.textContent = 'Lazy loading failed. Use Load JSON to import your taxonomy.';
    }
  }
}

export function initLandingPage() {
  const startExplorationBtn = document.getElementById('startExplorationBtn');
  const startLazyBtn = document.getElementById('startLazyBtn');
  const loadDataBtn = document.getElementById('loadDataBtn');
  const helpBtn = document.getElementById('helpBtn');
  const aboutBtn = document.getElementById('aboutBtn');

  // Start Exploration (Eager) - Load all data at once from data/ folder
  if (startExplorationBtn) {
    startExplorationBtn.addEventListener('click', async () => {
      hideLandingPage();
      // Make sure the topbar is visible
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        topbar.style.visibility = 'visible';
      }

      // Load data and initialize deep links (eager mode)
      await initDataAndDeepLinks();
    });
  }

  // Start Exploration (Lazy) - Load skeleton first from data lazy/ folder
  if (startLazyBtn) {
    startLazyBtn.addEventListener('click', async () => {
      hideLandingPage();
      // Make sure the topbar is visible
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        topbar.style.visibility = 'visible';
      }

      // Load data in lazy mode
      await initDataAndDeepLinksLazy();
    });
  }

  // Load Custom Data - Open the JSON modal
  if (loadDataBtn) {
    loadDataBtn.addEventListener('click', () => {
      hideLandingPage();
      const jsonModal = document.getElementById('jsonModal');
      if (jsonModal) {
        jsonModal.classList.add('open');
        jsonModal.setAttribute('aria-hidden', 'false');
      }
      // Make sure the topbar is visible
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        topbar.style.visibility = 'visible';
      }
    });
  }

  // Help - Open the help modal
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      hideLandingPage();
      const helpModal = document.getElementById('helpModal');
      if (helpModal) {
        helpModal.classList.add('open');
        helpModal.setAttribute('aria-hidden', 'false');
      }
      // Make sure the topbar is visible
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        topbar.style.visibility = 'visible';
      }
    });
  }

  // About - Open the about modal
  if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
      hideLandingPage();
      showAboutModal();
      // Make sure the topbar is visible
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        topbar.style.visibility = 'visible';
      }
    });
  }
}

function showAboutModal() {
  // Create about modal if it doesn't exist
  let aboutModal = document.getElementById('aboutModal');
  if (!aboutModal) {
    aboutModal = createAboutModal();
    document.body.appendChild(aboutModal);
  }

  aboutModal.classList.add('open');
  aboutModal.setAttribute('aria-hidden', 'false');
}

function createAboutModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'aboutModal';
  modal.setAttribute('aria-hidden', 'true');

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <div class="modal-title">About biozoom</div>
        <div style="display:flex;gap:.5rem">
          <button class="btn secondary" id="aboutCloseBtn" title="Close about">Close</button>
        </div>
      </div>
      <div class="modal-body" style="grid-template-columns:1fr">
        <div class="side">
          <h4>About This Application</h4>
          <p>biozoom is an interactive web application for exploring the Tree of Life. It provides a zoomable, interactive visualization of taxonomic relationships across millions of organisms.</p>

          <h4 style="margin-top:1rem">Features</h4>
          <ul style="margin:.2rem 0; padding-left:1.2rem">
            <li>Interactive zoomable tree visualization</li>
            <li>Search functionality for finding specific organisms</li>
            <li>Custom data loading support</li>
            <li>Multiple data providers (Google, Wikipedia, GBIF, NCBI, etc.)</li>
            <li>Deep linking for sharing specific views</li>
            <li>Responsive design with keyboard and mouse controls</li>
          </ul>

          <h4 style="margin-top:1rem">Controls</h4>
          <p><b>Navigation:</b> Left click to zoom into groups, right click to zoom out</p>
          <p><b>Search:</b> Type in the search bar and press Enter</p>
          <p><b>Fit:</b> Press F to fit current selection into view</p>
          <p><b>Help:</b> Press ? to toggle this help overlay</p>

          <h4 style="margin-top:1rem">Data Sources</h4>
          <p>This application supports loading custom taxonomy data in JSON format, as well as connecting to various online databases for additional information about organisms.</p>

          <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid #2a3472; text-align:center; color:#9aa3c7; font-size:12px">
            <p>Built with modern web technologies for exploring biodiversity data.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add close button functionality
  const closeBtn = modal.querySelector('#aboutCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  return modal;
}

