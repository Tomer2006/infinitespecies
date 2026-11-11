/**
 * Canvas management and rendering loop module (React-compatible)
 *
 * Manages the HTML5 canvas context, handles resize events, coordinates the
 * rendering pipeline, implements frame rate limiting, and provides coordinate
 * transformation utilities between world and screen space.
 */

import { buildOverlayText, initRuntimeMetrics } from './metrics';
import { state } from './state';
import { perf } from './settings';
import { logDebug } from './logger';

let canvasElement: HTMLCanvasElement | null = null
let stageElement: HTMLElement | null = null
let ctx: CanvasRenderingContext2D | null = null;
let W = 0;
let H = 0;
let DPR = 1;

// Low-resolution offscreen layer for circles (flat fills don't need full DPR).
// Composited onto the main canvas each frame; see getCircleBuffer().
let circleCanvas: HTMLCanvasElement | null = null;
let circleCtx: CanvasRenderingContext2D | null = null;
let circleDPR = 1;

let needRender = true;
let rafId: number | null = null;
let drawCallback: (() => boolean | void) | null = null;
let forceNextDraw = false;
const onCameraChangeCallbacks = new Set<() => void>();
let frameCounter = 0;
let lastFpsUpdate = 0;
let framesSinceFps = 0;
let lastCam = { x: 0, y: 0, k: 1 };

let latestOverlayText = ''
const overlayListeners = new Set<(text: string) => void>()

// Frame rate limiting
let lastRenderTime = 0;
let targetFrameTime = 1000 / perf.canvas.targetFPS;
let adaptiveFrameRate = perf.canvas.adaptiveFrameRate;

export function getContext() {
  return ctx;
}

export function attachCanvas(canvas: HTMLCanvasElement, stage: HTMLElement) {
  canvasElement = canvas
  stageElement = stage
  resizeCanvas()
}

export function detachCanvas(canvas: HTMLCanvasElement) {
  if (canvasElement !== canvas) return
  canvasElement = null
  stageElement = null
  ctx = null
}

export function subscribeMetrics(listener: (text: string) => void) {
  overlayListeners.add(listener)
  listener(latestOverlayText)
  return () => { overlayListeners.delete(listener) }
}

// Offscreen low-DPR layer for drawing circles, or null when a separate layer
// would not be cheaper than the main canvas (e.g. on 1x displays).
export function getCircleBuffer() {
  if (!circleCanvas || !circleCtx || circleDPR >= DPR) return null;
  return { canvas: circleCanvas, ctx: circleCtx };
}

export function resizeCanvas() {
  const stage = stageElement;
  const canvas = canvasElement;
  
  if (!stage || !canvas) {
    return;
  }
  
  const bb = stage.getBoundingClientRect();
  
  // Ensure we have valid dimensions
  if (bb.width === 0 || bb.height === 0) {
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

  // Size the low-res circle layer. Only worth keeping when it's actually
  // cheaper than the main canvas (circleDevicePixelRatio < effective DPR).
  circleDPR = Math.max(0.1, Math.min(perf.canvas.circleDevicePixelRatio || 1, DPR));
  if (circleDPR < DPR) {
    if (!circleCanvas) circleCanvas = document.createElement('canvas');
    circleCanvas.width = Math.max(1, Math.floor(W * circleDPR));
    circleCanvas.height = Math.max(1, Math.floor(H * circleDPR));
    circleCtx = circleCanvas.getContext('2d', { alpha: false });
    if (circleCtx) circleCtx.setTransform(circleDPR, 0, 0, circleDPR, 0, 0);
  } else {
    circleCanvas = null;
    circleCtx = null;
  }

  logDebug(`Canvas resized: ${oldW}x${oldH} → ${W}x${H} (DPR: ${DPR}, circleDPR: ${circleDPR})`);

  // Setting a canvas size clears it, so the next frame must draw even though
  // neither the camera nor the layout changed.
  forceNextDraw = true;
  requestRender();
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

  // Nothing to render: stop the loop entirely. requestRender()/tick() and the
  // camera animation will call ensureRAF() again when there is work to do, so
  // we no longer wake up 60x/sec while idle.
  if (!needRender) {
    return;
  }

  const now = performance.now();
  const timeSinceLastRender = now - lastRenderTime;

  // Frame rate limiting: too soon, keep waiting (needRender is still true).
  if (adaptiveFrameRate && timeSinceLastRender < targetFrameTime) {
    ensureRAF();
    return;
  }

  needRender = false;
  lastRenderTime = now;

  const cam = state.camera;
  const sameCam = cam.x === lastCam.x && cam.y === lastCam.y && cam.k === lastCam.k;
  const layoutChanged = state.layoutChanged;

  // Render for scene changes or for a time-based transition's next frame.
  const callback = drawCallback
  const shouldRender = callback && (!sameCam || layoutChanged || forceNextDraw);

  if (shouldRender) {
    forceNextDraw = false;
    const hasActiveTransitions = callback() === true;
    lastCam = { x: cam.x, y: cam.y, k: cam.k };
    state.layoutChanged = false;

    // Notify about camera change (for hover validation - O(1) check)
    if (!sameCam || layoutChanged) {
      for (const callback of onCameraChangeCallbacks) callback();
    }

    // Time-based canvas fades need frames even after the camera stops moving.
    if (hasActiveTransitions) {
      forceNextDraw = true;
      needRender = true;
    }
  }

  frameCounter++;

  // Update FPS display
  framesSinceFps++;
  if (now - lastFpsUpdate >= perf.canvas.fpsUpdateIntervalMs) {
    const sec = (now - lastFpsUpdate) / 1000;
    const fps = framesSinceFps / sec;
    latestOverlayText = buildOverlayText(fps);
    overlayListeners.forEach((listener) => listener(latestOverlayText));
    lastFpsUpdate = now;
    framesSinceFps = 0;
  }

  // Reschedule only if more rendering was requested during this frame
  // (e.g. an in-progress camera animation called requestRender()).
  if (needRender) ensureRAF();
}

export function registerDrawCallback(cb: () => boolean | void) {
  drawCallback = cb;
  forceNextDraw = true;
}

export function onCameraChange(cb: (() => void) | null | undefined) {
  if (!cb) return () => {};
  onCameraChangeCallbacks.add(cb);
  return () => { onCameraChangeCallbacks.delete(cb) };
}

// Initialize runtime metrics
try { initRuntimeMetrics(); } catch (_) {}

export function worldToScreen(x: number, y: number): [number, number] {
  return [
    W / 2 + (x - state.camera.x) * state.camera.k,
    H / 2 + (y - state.camera.y) * state.camera.k
  ];
}

export function screenToWorld(px: number, py: number): [number, number] {
  return [
    state.camera.x + (px - W / 2) / state.camera.k,
    state.camera.y + (py - H / 2) / state.camera.k
  ];
}

export function viewportRadius(renderDistance: number) {
  return (Math.hypot(W, H) * perf.canvas.viewportRadiusMultiplier) / state.camera.k * renderDistance;
}

export { W, H };
export function getFrameCounter() {
  return frameCounter;
}
