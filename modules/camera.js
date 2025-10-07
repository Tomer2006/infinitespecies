import { state } from './state.js';
import { requestRender } from './canvas.js';
import { perf } from './performance.js';
import { easeCubicInOut } from 'd3-ease';
import { logInfo, logDebug, logTrace } from './logger.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function animateToCam(nx, ny, nk, dur = perf.animation.cameraAnimationMs) {
  const oldCam = { x: state.camera.x, y: state.camera.y, k: state.camera.k };
  state.targetCam.x = nx;
  state.targetCam.y = ny;
  state.targetCam.k = nk;

  logInfo(`Camera animation started: (${oldCam.x.toFixed(2)}, ${oldCam.y.toFixed(2)}, ${oldCam.k.toFixed(4)}) → (${nx.toFixed(2)}, ${ny.toFixed(2)}, ${nk.toFixed(4)}) over ${dur}ms`);

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

    logTrace(`Camera animation step: t=${t.toFixed(3)}, cam=(${state.camera.x.toFixed(2)}, ${state.camera.y.toFixed(2)}, ${state.camera.k.toFixed(4)})`);

    requestRender();
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      state.animating = false;
      logInfo(`Camera animation completed: (${state.camera.x.toFixed(2)}, ${state.camera.y.toFixed(2)}, ${state.camera.k.toFixed(4)})`);
    }
  }
  requestAnimationFrame(step);
}


