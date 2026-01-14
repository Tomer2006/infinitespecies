/**
 * Camera animation and viewport management module
 *
 * Handles smooth camera transitions, viewport tracking, and coordinates the
 * loading system when the viewport changes during animations.
 */

import { state } from './state.js';
import { requestRender, screenToWorld } from './canvas.js';
import { perf } from './settings.js';

// Native cubic-in-out easing function (replaces d3-ease)
function easeCubicInOut(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function animateToCam(nx, ny, nk, dur = perf.animation.cameraAnimationMs) {
  state.targetCam.x = nx;
  state.targetCam.y = ny;
  state.targetCam.k = nk;

  const sx = state.camera.x,
    sy = state.camera.y,
    sk = state.camera.k,
    start = performance.now();
  state.animating = true;

  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const e = easeCubicInOut(t);
    state.camera.x = lerp(sx, state.targetCam.x, e);
    state.camera.y = lerp(sy, state.targetCam.y, e);
    state.camera.k = lerp(sk, state.targetCam.k, e);

    requestRender();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      state.animating = false;
    }
  }
  requestAnimationFrame(step);
}

/**
 * Handle wheel zoom (performance-critical - runs on every scroll)
 * @param {WheelEvent} e - The wheel event
 * @param {HTMLElement} canvas - The canvas element
 */
export function handleWheelZoom(e, canvas) {
  const scale = Math.exp(-e.deltaY * perf.input.zoomSensitivity);
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const [wx, wy] = screenToWorld(mx, my);

  state.camera.k *= scale;
  state.camera.x = wx - (mx - rect.width / 2) / state.camera.k;
  state.camera.y = wy - (my - rect.height / 2) / state.camera.k;

  requestRender();
  e.preventDefault();
}

/**
 * Handle camera panning (performance-critical - runs during drag)
 * @param {number} dx - Delta X in screen pixels
 * @param {number} dy - Delta Y in screen pixels
 */
export function handleCameraPan(dx, dy) {
  state.camera.x -= dx / state.camera.k;
  state.camera.y -= dy / state.camera.k;
  requestRender();
}

