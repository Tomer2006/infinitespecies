/**
 * Canvas management and rendering loop module (React-compatible)
 *
 * Manages the HTML5 canvas context, handles resize events, coordinates the
 * rendering pipeline, implements frame rate limiting, and provides coordinate
 * transformation utilities between world and screen space.
 */

import { getCanvas, getStage } from './dom.js';
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
let onCameraChangeCallback = null;  // Callback when camera changes (for hover validation)
let frameCounter = 0;
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
  const stage = getStage();
  const canvas = getCanvas();
  
  if (!stage || !canvas) {
    // Retry after a short delay if elements aren't ready
    console.log('[Canvas] Waiting for stage/canvas elements...');
    setTimeout(resizeCanvas, 100);
    return;
  }
  
  const bb = stage.getBoundingClientRect();
  
  // Ensure we have valid dimensions
  if (bb.width === 0 || bb.height === 0) {
    console.log('[Canvas] Stage has no dimensions yet, retrying...');
    setTimeout(resizeCanvas, 100);
    return;
  }
  
  const oldW = W, oldH = H;
  DPR = Math.max(1, Math.min(perf.canvas.maxDevicePixelRatio, window.devicePixelRatio || 1));
  W = Math.floor(bb.width);
  H = Math.floor(bb.height);

  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx = canvas.getContext('2d', { desynchronized: true, alpha: false });
  if (ctx) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  logDebug(`Canvas resized: ${oldW}x${oldH} → ${W}x${H} (DPR: ${DPR})`);
  console.log(`[Canvas] Resized: ${W}x${H} (DPR: ${DPR})`);
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

  // Frame rate limiting
  if (adaptiveFrameRate && timeSinceLastRender < targetFrameTime) {
    ensureRAF();
    return;
  }

  if (!needRender) {
    ensureRAF();
    return;
  }

  needRender = false;
  lastRenderTime = now;

  const cam = state.camera;
  const sameCam = cam.x === lastCam.x && cam.y === lastCam.y && cam.k === lastCam.k;
  const layoutChanged = state.layoutChanged;

  // Render if: drawCallback exists AND (camera moved OR layout changed)
  const shouldRender = drawCallback && (!sameCam || layoutChanged);
  
  if (shouldRender) {
    drawCallback();
    lastCam = { x: cam.x, y: cam.y, k: cam.k };
    state.layoutChanged = false;
    
    // Notify about camera change (for hover validation - O(1) check)
    if (onCameraChangeCallback) onCameraChangeCallback();
  }
  
  if (needRender) ensureRAF();
  frameCounter++;

  // Update FPS display
  const fpsEl = document.getElementById('fps');
  framesSinceFps++;
  if (fpsEl && now - lastFpsUpdate >= perf.canvas.fpsUpdateIntervalMs) {
    const sec = (now - lastFpsUpdate) / 1000;
    const fps = framesSinceFps / sec;
    fpsEl.textContent = buildOverlayText(fps);
    lastFpsUpdate = now;
    framesSinceFps = 0;
  }

  ensureRAF();
}

export function registerDrawCallback(cb) {
  drawCallback = cb;
}

export function onCameraChange(cb) {
  onCameraChangeCallback = cb;
}

window.addEventListener('resize', () => {
  resizeCanvas();
  requestRender();
});

// Initialize runtime metrics
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
