import { stage, canvas, fpsEl } from './dom.js';
import { buildOverlayText, initRuntimeMetrics } from './metrics.js';
import { state } from './state.js';
import { perf } from './performance.js';
import { shouldAutoLoad, requestAutoLoad } from './data-lazy.js';
import { logInfo, logWarn, logError, logDebug, logTrace } from './logger.js';

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
let targetFrameTime = 1000 / 60; // Target 60 FPS
let adaptiveFrameRate = true;

export function getContext() {
  return ctx;
}

export function getSize() {
  return { W, H, DPR };
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

  logTrace(`Frame loop started - time since last: ${timeSinceLastRender.toFixed(2)}ms`);

  // Frame rate limiting: skip frames if we're rendering too fast
  if (adaptiveFrameRate && timeSinceLastRender < targetFrameTime) {
    logTrace(`Frame skipped - too fast (${timeSinceLastRender.toFixed(2)}ms < ${targetFrameTime.toFixed(2)}ms)`);
    ensureRAF(); // Schedule next frame
    return;
  }

  if (!needRender) {
    logTrace('Frame skipped - no render needed');
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
    logTrace('Frame skipped - no changes detected');
    // Still update FPS box timing even when skipping draw
  } else {
    logTrace(`Rendering frame - camera: (${cam.x.toFixed(2)}, ${cam.y.toFixed(2)}, ${cam.k.toFixed(4)}), layout changed: ${layoutChanged}`);
    if (drawCallback) drawCallback();
    lastCam = { x: cam.x, y: cam.y, k: cam.k };
    // Reset layout changed flag after drawing
    state.layoutChanged = false;
  }
  if (needRender) ensureRAF(); // draw requested during draw()
  frameCounter++;

  // Update FPS text ~8 times/sec to reduce layout cost
  framesSinceFps++;
  if (fpsEl && now - lastFpsUpdate >= 125) {
    const sec = (now - lastFpsUpdate) / 1000;
    const fps = framesSinceFps / sec;
    fpsEl.textContent = buildOverlayText(fps);
    lastFpsUpdate = now;
    framesSinceFps = 0;
  }

  // Check for automatic subtree loading
  if (state.layout && state.loadMode !== 'eager') {
    checkAutoLoad();
  }

  // Always schedule next frame to maintain consistent timing
  ensureRAF();
}

// Check for nodes that should auto-load based on zoom level
function checkAutoLoad() {
  if (!state.layout?.root || state.loadMode === 'eager') {
    logTrace('Auto-load check skipped - no layout root or eager mode');
    return;
  }

  logTrace('Checking for auto-load candidates...');
  const autoLoadResult = requestAutoLoad();
  if (!autoLoadResult?.length) {
    logTrace('No auto-load candidates found');
    return;
  }

  logInfo(`Auto-loading ${autoLoadResult.length} subtrees`);
  autoLoadResult.forEach(info => {
    const { node, status } = info;
    if (status === 'loading') {
      logInfo(`Auto-loading subtree: ${node.name} (descendants: ${node.descendants?.()?.length || 0})`);
    } else if (status === 'pending') {
      logDebug(`Subtree already loading: ${node.name}`);
    }
  });
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

export function nodeVertInView(d, verticalPadPx) {
  const sy = H / 2 + (d._vy - state.camera.y) * state.camera.k;
  const sr = d._vr * state.camera.k;
  const pad = verticalPadPx;
  return sy + sr >= -pad && sy - sr <= H + pad;
}

export function viewportRadius(renderDistance) {
  return (Math.hypot(W, H) * 0.5) / state.camera.k * renderDistance;
}

export { W, H, DPR };
export function getFrameCounter() {
  return frameCounter;
}

// Checks whether a circle in world coordinates intersects the current viewport rectangle
export function circleInViewportWorld(cx, cy, r, padPx = 0) {
  const padWorld = (padPx || 0) / state.camera.k;
  const halfW = W / (2 * state.camera.k);
  const halfH = H / (2 * state.camera.k);
  const minX = state.camera.x - halfW - padWorld;
  const maxX = state.camera.x + halfW + padWorld;
  const minY = state.camera.y - halfH - padWorld;
  const maxY = state.camera.y + halfH + padWorld;
  const closestX = Math.max(minX, Math.min(cx, maxX));
  const closestY = Math.max(minY, Math.min(cy, maxY));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}


