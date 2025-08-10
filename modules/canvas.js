import { stage, canvas } from './dom.js';
import { state } from './state.js';

let ctx;
let W = 0;
let H = 0;
let DPR = 1;

let needRender = true;
let rafId = null;
let drawCallback = null;

export function getContext() {
  return ctx;
}

export function getSize() {
  return { W, H, DPR };
}

export function resizeCanvas() {
  const bb = stage.getBoundingClientRect();
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = Math.floor(bb.width);
  H = Math.floor(bb.height);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx = canvas.getContext('2d');
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
  if (drawCallback) drawCallback();
  if (needRender) ensureRAF();
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


