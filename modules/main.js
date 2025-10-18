/* Main Application Entry Point */
import { resizeCanvas } from './canvas.js';
import { setupMouseEvents, setupKeyboardEvents, setupButtonEvents } from './events.js';
import { initializeApp } from './init.js';
import { tick } from './render.js';

// Initialize everything
(function main() {
  resizeCanvas();
  
  // Setup all event handlers
  setupMouseEvents();
  setupKeyboardEvents();
  setupButtonEvents();
  // PNG export removed
  
  // Load initial data
  initializeApp().then(() => {
    tick();
  });
})();
