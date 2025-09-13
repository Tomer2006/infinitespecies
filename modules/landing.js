// Landing page module for Taxonomy Explorer
// Handles the initial start menu and navigation to different app sections

import { showLoading, hideLoading } from './loading.js';
import { loadFromUrl } from './data.js';
import { decodePath, findNodeByPath } from './deeplink.js';
import { goToNode } from './navigation.js';
import { state } from './state.js';
import { tick } from './canvas.js';

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

  // Load data
  await initData();

  // After data load completes, attempt a jump to a lightweight start node
  // Note: jump is triggered inside setDataRoot after layout/indexing
}

function initDeepLinks() {
  // Navigate when hash changes
  window.addEventListener('hashchange', () => {
    const hash = decodePath(location.hash.slice(1));
    if (!hash || !state.DATA_ROOT) return;
    const node = findNodeByPath(hash);
    if (node) goToNode(node, true);
  });

  // On first load, apply hash if present (no-op until data exists)
  setTimeout(() => {
    const hash = decodePath(location.hash.slice(1));
    if (hash && state.DATA_ROOT) {
      const node = findNodeByPath(hash);
      if (node) goToNode(node, true);
    }
  }, 0);
}

async function initData() {
  const params = new URLSearchParams(location.search);
  const qUrl = params.get('data');

  // Priority order: URL param, split data/, then single files
  const candidates = [
    qUrl,
    'data/manifest.json',  // Check for split files first
    'tree.json',
    'taxonomy.json',
    'data.json'
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      showLoading(`Loading ${url}…`);
      await loadFromUrl(url);
      hideLoading();
      tick();
      return;
    } catch (_err) {
      // try next
    }
  }

  // If all else fails, prompt user to load their own JSON
  hideLoading();
  const modal = document.getElementById('jsonModal');
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  const label = document.getElementById('progressLabel');
  if (label) label.textContent = 'No data found. Use Load JSON to import your taxonomy.';
}

export function initLandingPage() {
  const startExplorationBtn = document.getElementById('startExplorationBtn');
  const loadDataBtn = document.getElementById('loadDataBtn');
  const helpBtn = document.getElementById('helpBtn');
  const aboutBtn = document.getElementById('aboutBtn');

  // Start Exploration - Load data and start exploration
  if (startExplorationBtn) {
    startExplorationBtn.addEventListener('click', async () => {
      hideLandingPage();
      // Make sure the topbar is visible
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        topbar.style.visibility = 'visible';
      }

      // Load data and initialize deep links
      await initDataAndDeepLinks();
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
        <div class="modal-title">About Taxonomy Explorer</div>
        <div style="display:flex;gap:.5rem">
          <button class="btn secondary" id="aboutCloseBtn" title="Close about">Close</button>
        </div>
      </div>
      <div class="modal-body" style="grid-template-columns:1fr">
        <div class="side">
          <h4>About This Application</h4>
          <p>Taxonomy Explorer is an interactive web application for exploring the Tree of Life. It provides a zoomable, interactive visualization of taxonomic relationships across millions of organisms.</p>

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
