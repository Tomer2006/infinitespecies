/* Camera and Animation */
import { W, H } from './canvas.js';
export const camera = { x: 0, y: 0, k: 1 };
export const targetCam = { x: 0, y: 0, k: 1 };
export let animating = false;

export function lerp(a, b, t) { return a + (b - a) * t; }

export function animateToCam(nx, ny, nk, dur = 700) {
  targetCam.x = nx; targetCam.y = ny; targetCam.k = nk;
  const sx = camera.x, sy = camera.y, sk = camera.k, start = performance.now(); 
  animating = true;
  
  function step(now) {
    const t = Math.min(1, (now - start) / dur), e = d3.easeCubicInOut(t);
    camera.x = lerp(sx, targetCam.x, e); 
    camera.y = lerp(sy, targetCam.y, e); 
    camera.k = lerp(sk, targetCam.k, e);
    
    import('./render.js').then(({ requestRender }) => requestRender());
    if (t < 1) requestAnimationFrame(step); 
    else animating = false;
  }
  requestAnimationFrame(step);
}

export function worldToScreen(x, y) { 
  return [W/2 + (x - camera.x) * camera.k, H/2 + (y - camera.y) * camera.k]; 
}

export function screenToWorld(px, py) { 
  return [camera.x + (px - W/2) / camera.k, camera.y + (py - H/2) / camera.k]; 
}
