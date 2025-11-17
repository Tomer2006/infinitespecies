/**
 * Canvas management and rendering loop module
 *
 * Manages the HTML5 canvas context, handles resize events, coordinates the
 * rendering pipeline, implements frame rate limiting, and provides coordinate
 * transformation utilities between world and screen space.
 */

import { stage, canvas, fpsEl } from './dom.js';
import { buildOverlayText, initRuntimeMetrics } from './metrics.js';
import { state } from './state.js';
import { perf } from './settings.js';
import { logDebug } from './logger.js';

let ctx;
let W = 0;
let H = 0;
let DPR = 1;

let needRender = true;
let rafId = null;
let drawCallback = null;
let frameCounter = 0; // incremented each frame
let lastFpsUpdate = 0;
let framesSinceFps = 0;
let lastCam = { x: 0, y: 0, k: 1 };

// Frame rate limiting
let lastRenderTime = 0;
let targetFrameTime = 1000 / perf.canvas.targetFPS;
let adaptiveFrameRate = perf.canvas.adaptiveFrameRate;

export function getContext() {
  return ctx;
}

export function resizeCanvas() {
  const bb = stage.getBoundingClientRect();
  const oldW = W, oldH = H;
  DPR = Math.max(1, Math.min(perf.canvas.maxDevicePixelRatio, window.devicePixelRatio || 1));
  W = Math.floor(bb.width);
  H = Math.floor(bb.height);

  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx = canvas.getContext('2d', { desynchronized: true, alpha: false });
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  logDebug(`Canvas resized: ${oldW}x${oldH} → ${W}x${H} (DPR: ${DPR})`);
}

export function requestRender() {
  needRender = true;
  ensureRAF();
}

export function tick() {
  needRender = true;
  ensureRAF();
}

function ensureRAF() {
  if (rafId == null) rafId = requestAnimationFrame(loop);
}

function loop() {
  rafId = null;

  const now = performance.now();
  const timeSinceLastRender = now - lastRenderTime;

  // Frame rate limiting: skip frames if we're rendering too fast
  if (adaptiveFrameRate && timeSinceLastRender < targetFrameTime) {
    ensureRAF(); // Schedule next frame
    return;
  }

  if (!needRender) {
    ensureRAF(); // Continue the loop even when not rendering to maintain timing
    return;
  }

  needRender = false;
  lastRenderTime = now;

  // Avoid redraw if camera and layout haven't changed and no one requested a draw
  const cam = state.camera;
  const sameCam = cam.x === lastCam.x && cam.y === lastCam.y && cam.k === lastCam.k;
  const layoutChanged = state.layoutChanged;

  if (!drawCallback || (sameCam && !layoutChanged)) {
    // Still update FPS box timing even when skipping draw
  } else {
    if (drawCallback) drawCallback();
    lastCam = { x: cam.x, y: cam.y, k: cam.k };
    // Reset layout changed flag after drawing
    state.layoutChanged = false;
  }
  if (needRender) ensureRAF(); // draw requested during draw()
  frameCounter++;

  // Update FPS text ~8 times/sec to reduce layout cost
  framesSinceFps++;
  if (fpsEl && now - lastFpsUpdate >= perf.canvas.fpsUpdateIntervalMs) {
    const sec = (now - lastFpsUpdate) / 1000;
    const fps = framesSinceFps / sec;
    fpsEl.textContent = buildOverlayText(fps);
    lastFpsUpdate = now;
    framesSinceFps = 0;
  }


  // Always schedule next frame to maintain consistent timing
  ensureRAF();
}


export function registerDrawCallback(cb) {
  drawCallback = cb;
}

window.addEventListener('resize', () => {
  resizeCanvas();
  requestRender();
});

// Initialize runtime metrics sampling
try { initRuntimeMetrics(); } catch (_) {}

export function worldToScreen(x, y) {
  return [
    W / 2 + (x - state.camera.x) * state.camera.k,
    H / 2 + (y - state.camera.y) * state.camera.k
  ];
}

export function screenToWorld(px, py) {
  return [
    state.camera.x + (px - W / 2) / state.camera.k,
    state.camera.y + (py - H / 2) / state.camera.k
  ];
}

export function viewportRadius(renderDistance) {
  return (Math.hypot(W, H) * perf.canvas.viewportRadiusMultiplier) / state.camera.k * renderDistance;
}

export { W, H, DPR };
export function getFrameCounter() {
  return frameCounter;
}

