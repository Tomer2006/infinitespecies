import { stage, canvas, fpsEl } from './dom.js';
import { state } from './state.js';
import { perf, tuneForFps } from './performance.js';

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

export function getContext() {
  return ctx;
}

export function getSize() {
  return { W, H, DPR };
}

export function resizeCanvas() {
  const bb = stage.getBoundingClientRect();
  DPR = Math.max(1, Math.min(perf.canvas.maxDevicePixelRatio, window.devicePixelRatio || 1));
  W = Math.floor(bb.width);
  H = Math.floor(bb.height);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx = canvas.getContext('2d', { desynchronized: true, alpha: false });
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
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
  if (!needRender) return; // skip if nothing requested
  needRender = false;
  if (drawCallback) drawCallback();
  if (needRender) ensureRAF(); // draw requested during draw()
  frameCounter++;
  // Update FPS text ~8 times/sec to reduce layout cost
  const now = performance.now();
  framesSinceFps++;
  if (fpsEl && now - lastFpsUpdate >= 125) {
    const sec = (now - lastFpsUpdate) / 1000;
    const fps = framesSinceFps / sec;
    fpsEl.textContent = Math.round(fps) + ' fps';
    // Adaptive tuning
    const resized = tuneForFps(fps);
    if (resized) {
      resizeCanvas();
    }
    lastFpsUpdate = now;
    framesSinceFps = 0;
  }
}

export function registerDrawCallback(cb) {
  drawCallback = cb;
}

window.addEventListener('resize', () => {
  resizeCanvas();
  requestRender();
});

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


