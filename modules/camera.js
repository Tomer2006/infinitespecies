import { state } from './state.js';
import { requestRender } from './canvas.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function animateToCam(nx, ny, nk, dur = 700) {
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
    const e = d3.easeCubicInOut(t);
    state.camera.x = lerp(sx, state.targetCam.x, e);
    state.camera.y = lerp(sy, state.targetCam.y, e);
    state.camera.k = lerp(sk, state.targetCam.k, e);
    requestRender();
    if (t < 1) requestAnimationFrame(step);
    else state.animating = false;
  }
  requestAnimationFrame(step);
}


