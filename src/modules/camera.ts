/**
 * Camera animation and viewport management module
 *
 * Handles smooth camera transitions, viewport tracking, and coordinates the
 * loading system when the viewport changes during animations.
 */

import { state } from './state';
import { requestRender, screenToWorld, W, H } from './canvas';
import { perf } from './settings';

// Native cubic-in-out easing function (replaces d3-ease)
function easeCubicInOut(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function getBreadcrumbZoomOutLimit() {
  const breadcrumbRadius = Number(state.current?._vr ?? state.DATA_ROOT?._vr);
  const zoomLimitRadius = breadcrumbRadius > 0 ? breadcrumbRadius : state.maxNodeRadius;

  if (!(zoomLimitRadius > 0) || !(W > 0) || !(H > 0)) {
    return Number.POSITIVE_INFINITY;
  }

  const targetDiameterPx = Math.min(W, H) * perf.navigation.zoomOutLargestCircleViewportRatio;
  return targetDiameterPx / (zoomLimitRadius * 2);
}

function getMinCameraZoom() {
  const zoomOutLimit = getBreadcrumbZoomOutLimit();
  if (!Number.isFinite(zoomOutLimit) || zoomOutLimit <= 0) {
    return 0;
  }

  return zoomOutLimit;
}

function getMaxCameraZoom() {
  const maxZoom = perf.navigation.maxCameraZoom;
  if (!Number.isFinite(maxZoom) || maxZoom <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return maxZoom;
}

export function clampCameraZoom(k: number) {
  if (!Number.isFinite(k) || k <= 0) {
    return 1;
  }

  const minZoom = getMinCameraZoom();
  const maxZoom = getMaxCameraZoom();
  let clamped = Number.isFinite(minZoom) ? Math.max(k, minZoom) : k;
  clamped = Number.isFinite(maxZoom) ? Math.min(clamped, maxZoom) : clamped;
  return clamped;
}

export function animateToCam(nx: number, ny: number, nk: number, dur = perf.animation.cameraAnimationMs) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stopCameraAnimation();
    state.camera = { x: nx, y: ny, k: clampCameraZoom(nk) };
    state.targetCam = { ...state.camera };
    requestRender();
    return;
  }
  if (!Number.isFinite(dur) || dur <= 0) dur = perf.animation.cameraAnimationMs;
  const animationId = ++state.cameraAnimationId;
  state.targetCam.x = nx;
  state.targetCam.y = ny;
  state.targetCam.k = clampCameraZoom(nk);

  const sx = state.camera.x,
    sy = state.camera.y,
    sk = state.camera.k,
    start = performance.now();
  state.animating = true;

  function step(now: number) {
    if (animationId !== state.cameraAnimationId) return;
    const t = Math.min(1, (now - start) / dur);
    const e = easeCubicInOut(t);
    state.camera.x = lerp(sx, state.targetCam.x, e);
    state.camera.y = lerp(sy, state.targetCam.y, e);
    state.camera.k = clampCameraZoom(lerp(sk, state.targetCam.k, e));

    requestRender();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      state.animating = false;
    }
  }
  requestAnimationFrame(step);
}

export function stopCameraAnimation() {
  state.cameraAnimationId += 1;
  state.animating = false;
  state.targetCam = { ...state.camera };
}

// Smooth wheel zoom: instead of snapping the camera to each wheel tick, ease
// the zoom toward an accumulating target so newly revealed detail grows in
// continuously instead of popping. The world point under the cursor is kept
// pinned throughout the ease.
const zoomAnim = {
  active: false,
  targetK: 1,
  mx: 0,   // cursor x in canvas px (anchor)
  my: 0,   // cursor y in canvas px (anchor)
  wx: 0,   // world point under the cursor to keep fixed
  wy: 0
};

function stepWheelZoom() {
  if (!zoomAnim.active) return;

  const k = state.camera.k;
  const target = zoomAnim.targetK;
  const smoothing = perf.input.zoomSmoothing;

  // Move a fraction of the remaining distance each frame; snap when close.
  const done = Math.abs(target - k) <= target * 0.001;
  const nk = clampCameraZoom(done ? target : k + (target - k) * smoothing);

  state.camera.k = nk;
  // Re-pin the anchored world point under the cursor as the zoom changes.
  state.camera.x = zoomAnim.wx - (zoomAnim.mx - W / 2) / nk;
  state.camera.y = zoomAnim.wy - (zoomAnim.my - H / 2) / nk;

  requestRender();

  if (done) {
    zoomAnim.active = false;
  } else {
    requestAnimationFrame(stepWheelZoom);
  }
}

/**
 * Handle wheel zoom (performance-critical - runs on every scroll)
 * @param {WheelEvent} e - The wheel event
 * @param {HTMLElement} canvas - The canvas element
 */
export function handleWheelZoom(e: WheelEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const scale = Math.exp(-e.deltaY * perf.input.zoomSensitivity);

  // Take over from any in-flight click/zoom animation.
  state.cameraAnimationId += 1;

  // Accumulate onto the existing target during a rapid scroll burst so ticks
  // compound the way they did when zoom was applied instantly.
  const baseK = zoomAnim.active ? zoomAnim.targetK : state.camera.k;
  zoomAnim.targetK = clampCameraZoom(baseK * scale);

  // Re-anchor to the world point currently under the cursor (handles the
  // cursor moving between ticks). No positional jump: it matches the live cam.
  const [wx, wy] = screenToWorld(mx, my);
  zoomAnim.mx = mx;
  zoomAnim.my = my;
  zoomAnim.wx = wx;
  zoomAnim.wy = wy;

  if (!zoomAnim.active) {
    zoomAnim.active = true;
    requestAnimationFrame(stepWheelZoom);
  }

  requestRender();
  e.preventDefault();
}

/**
 * Handle camera panning (performance-critical - runs during drag)
 * @param {number} dx - Delta X in screen pixels
 * @param {number} dy - Delta Y in screen pixels
 */
export function handleCameraPan(dx: number, dy: number) {
  state.camera.x -= dx / state.camera.k;
  state.camera.y -= dy / state.camera.k;
  requestRender();
}
