/* Canvas Management */
import { canvas, stage } from './dom.js';

export let ctx, W, H, DPR = 1;

export function resizeCanvas() {
  const bb = stage.getBoundingClientRect();
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = Math.floor(bb.width); 
  H = Math.floor(bb.height);
  canvas.width = W * DPR; 
  canvas.height = H * DPR;
  canvas.style.width = W + "px"; 
  canvas.style.height = H + "px";
  ctx = canvas.getContext('2d'); 
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

export { W as getW, H as getH, ctx as getCtx };

// Initialize canvas on load
window.addEventListener('resize', () => {
  resizeCanvas();
  // Import requestRender dynamically to avoid circular deps
  import('./render.js').then(({ requestRender }) => requestRender());
});
