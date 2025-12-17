// Entry point for the modular infinitespecies
// Loads modules, initializes canvas sizing, data, events, deeplinks, and render loop

import { resizeCanvas, registerDrawCallback } from './modules/canvas.js';
import { draw } from './modules/render.js';
import { initEvents } from './modules/events.js';
import { initLandingPage, showLandingPage, initAboutModal } from './modules/landing.js';

(function init() {
  // Canvas and render bootstrap
  resizeCanvas();
  registerDrawCallback(draw);

  // Wire UI and input events
  initEvents();

  // Initialize landing page and modals
  initLandingPage();
  initAboutModal();

  // Show landing page first (data will be loaded when user chooses to start exploration)
  showLandingPage();
})();


