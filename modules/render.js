/* Rendering System */
import { PALETTE, settings } from './constants.js';
import { camera } from './camera.js';
import { ctx, W, H } from './canvas.js';
import { layout, highlightNode, nodeLayoutMap } from './state.js';

let needRender = true;
let rafId = null;

export function requestRender() { 
  needRender = true; 
  ensureRAF(); 
}

function ensureRAF() { 
  if (rafId == null) { 
    rafId = requestAnimationFrame(loop); 
  } 
}

function loop() { 
  rafId = null; 
  draw(); 
  if (needRender) { 
    ensureRAF(); 
  } 
}

export function tick() { 
  needRender = true; 
  ensureRAF(); 
}

function nodeInView(d) {
  const viewR = Math.hypot(W, H) * 0.5 / camera.k * settings.renderDistance;
  const dx = d._vx - camera.x, dy = d._vy - camera.y;
  const r = viewR + d._vr;
  return (dx * dx + dy * dy) <= (r * r);
}

function nodeVertInView(d) {
  const sy = H/2 + (d._vy - camera.y) * camera.k;
  const sr = d._vr * camera.k;
  const pad = settings.verticalPadPx;
  return (sy + sr) >= -pad && (sy - sr) <= (H + pad);
}

function worldToScreen(x, y) { 
  return [W/2 + (x - camera.x) * camera.k, H/2 + (y - camera.y) * camera.k]; 
}

export function draw() {
  if (!needRender || !layout) return; 
  needRender = false;
  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.save(); 
  ctx.globalAlpha = 0.05;
  ctx.translate(Math.floor((W/2 - camera.x * camera.k) % 40), Math.floor((H/2 - camera.y * camera.k) % 40));
  ctx.beginPath();
  for (let x = -40; x <= W + 40; x += 40) { 
    ctx.moveTo(x, -40); 
    ctx.lineTo(x, H + 40); 
  }
  for (let y = -40; y <= H + 40; y += 40) { 
    ctx.moveTo(-40, y); 
    ctx.lineTo(W + 40, y); 
  }
  ctx.strokeStyle = "#8aa1ff"; 
  ctx.lineWidth = 1; 
  ctx.stroke(); 
  ctx.restore();

  const nodes = layout.root.descendants().sort((a, b) => a._vr - b._vr);
  const MIN_PX_R = settings.minPxRadius;
  const LABEL_MIN = settings.labelMinPxRadius;
  const labelCandidates = [];

  for (const d of nodes) {
    if (!nodeVertInView(d)) continue;
    if (!nodeInView(d)) continue;
    const [sx, sy] = worldToScreen(d._vx, d._vy);
    const sr = d._vr * camera.k; 
    if (sr < MIN_PX_R) continue;

    const level = d.data.level || "Life";
    ctx.beginPath(); 
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE(level) || "#7aa2ff"; 
    ctx.globalAlpha = .17; 
    ctx.fill();
    ctx.globalAlpha = .9; 
    ctx.lineWidth = Math.max(1, Math.min(3, 1.5 * Math.sqrt(Math.max(sr/40, .25))));
    ctx.strokeStyle = d.children && d.children.length ? "#3a478e" : "#2b356f"; 
    ctx.stroke();

    if (sr > LABEL_MIN) {
      const fontSize = Math.min(18, Math.max(10, sr/3));
      if (fontSize >= settings.labelMinFontPx) {
        ctx.save(); 
        ctx.font = `600 ${fontSize}px ui-sans-serif`;
        const text = d.data.name; 
        const metrics = ctx.measureText(text);
        ctx.restore();
        const textWidth = metrics.width, textHeight = fontSize, pad = 2;
        const rect = { 
          x1: sx - textWidth/2 - pad, 
          y1: sy - textHeight/2 - pad, 
          x2: sx + textWidth/2 + pad, 
          y2: sy + textHeight/2 + pad 
        };
        labelCandidates.push({ sx, sy, fontSize, text, rect });
      }
    }
  }

  // Label placement pass
  if (labelCandidates.length) {
    const placed = [];
    const overlaps = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
    labelCandidates.sort((a, b) => b.fontSize - a.fontSize);
    for (const cand of labelCandidates) {
      let hit = false; 
      for (const r of placed) { 
        if (overlaps(cand.rect, r)) { 
          hit = true; 
          break; 
        } 
      }
      if (hit) continue;
      ctx.save();
      ctx.font = `600 ${cand.fontSize}px ui-sans-serif`;
      ctx.textAlign = "center"; 
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2, Math.min(6, cand.fontSize/3));
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.lineJoin = "round"; 
      ctx.miterLimit = 2;
      ctx.strokeText(cand.text, cand.sx, cand.sy);
      ctx.fillStyle = "#e9eeff"; 
      ctx.globalAlpha = .95;
      ctx.fillText(cand.text, cand.sx, cand.sy);
      ctx.restore();
      placed.push(cand.rect);
    }
  }

  if (highlightNode) {
    const d = nodeLayoutMap.get(highlightNode._id);
    if (d && nodeVertInView(d) && nodeInView(d)) {
      const [sx, sy] = worldToScreen(d._vx, d._vy); 
      const sr = d._vr * camera.k;
      if (sr > 4) { 
        ctx.beginPath(); 
        ctx.arc(sx, sy, sr + 4, 0, Math.PI * 2); 
        ctx.strokeStyle = "rgba(255,255,255,.35)";
        ctx.lineWidth = 2; 
        ctx.setLineDash([6, 6]); 
        ctx.stroke(); 
        ctx.setLineDash([]); 
      }
    }
  }
}
