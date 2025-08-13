/* Main Application Entry Point */
import { resizeCanvas } from './canvas.js';
import { setupMouseEvents, setupKeyboardEvents, setupButtonEvents } from './events.js';
import { setupExportPNG } from './export.js';
import { initializeApp } from './init.js';
import { tick } from './render.js';

// Initialize everything
(function main() {
  resizeCanvas();
  
  // Setup all event handlers
  setupMouseEvents();
  setupKeyboardEvents();
  setupButtonEvents();
  setupExportPNG();
  
  // Load initial data
  initializeApp().then(() => {
    tick();
  });
})();
