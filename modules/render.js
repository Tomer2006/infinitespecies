import { getContext, W, H, worldToScreen, nodeVertInView } from './canvas.js';
import { state } from './state.js';
import { getNodeColor, settings } from './constants.js';
import { nodeInView } from './picking.js';

// Simple LRU-ish cache for text measurement
const measureCache = new Map();

export function draw() {
  const ctx = getContext();
  if (!ctx || !state.layout) return;
  // Clear once per frame
  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.translate(
    Math.floor((W / 2 - state.camera.x * state.camera.k) % 40),
    Math.floor((H / 2 - state.camera.y * state.camera.k) % 40)
  );
  ctx.beginPath();
  for (let x = -40; x <= W + 40; x += 40) {
    ctx.moveTo(x, -40);
    ctx.lineTo(x, H + 40);
  }
  for (let y = -40; y <= H + 40; y += 40) {
    ctx.moveTo(-40, y);
    ctx.lineTo(W + 40, y);
  }
  ctx.strokeStyle = '#8aa1ff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const nodes = state.drawOrder || state.layout.root.descendants();
  const MIN_PX_R = settings.minPxRadius;
  const LABEL_MIN = settings.labelMinPxRadius;
  const labelCandidates = [];

  // Precompute view radius (in world units)
  const viewR = (Math.hypot(W, H) * 0.5) / state.camera.k * settings.renderDistance;

  for (const d of nodes) {
    if (!nodeVertInView(d, settings.verticalPadPx)) continue;
    // faster in-view test inline
    const dx = d._vx - state.camera.x;
    const dy = d._vy - state.camera.y;
    const rr = viewR + d._vr;
    if (dx * dx + dy * dy > rr * rr) continue;
    const [sx, sy] = worldToScreen(d._vx, d._vy);
    const sr = d._vr * state.camera.k;
    if (sr < MIN_PX_R) continue;

    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = getNodeColor(d.data);
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.lineWidth = Math.max(1, Math.min(3, 1.5 * Math.sqrt(Math.max(sr / 40, 0.25))));
    ctx.strokeStyle = d.children && d.children.length ? 'rgba(220,230,255,0.85)' : 'rgba(180,195,240,0.85)';
    ctx.stroke();

    if (sr > LABEL_MIN) {
      const fontSize = Math.min(18, Math.max(10, sr / 3));
      if (fontSize >= settings.labelMinFontPx) {
        const text = d.data.name;
        // Cache measurements by fontSize+text
        const key = fontSize + '|' + text;
        let metrics = measureCache.get(key);
        if (!metrics) {
          ctx.save();
          ctx.font = `600 ${fontSize}px ui-sans-serif`;
          metrics = { width: ctx.measureText(text).width };
          ctx.restore();
          if (measureCache.size > 2000) measureCache.clear();
          measureCache.set(key, metrics);
        }
        const textWidth = metrics.width,
          textHeight = fontSize,
          pad = 2;
        const rect = {
          x1: sx - textWidth / 2 - pad,
          y1: sy - textHeight / 2 - pad,
          x2: sx + textWidth / 2 + pad,
          y2: sy + textHeight / 2 + pad
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
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, Math.min(6, cand.fontSize / 3));
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(cand.text, cand.sx, cand.sy);
      ctx.fillStyle = '#e9eeff';
      ctx.globalAlpha = 0.95;
      ctx.fillText(cand.text, cand.sx, cand.sy);
      ctx.restore();
      placed.push(cand.rect);
    }
  }

  // Highlight ring
  if (state.highlightNode) {
    const d = state.nodeLayoutMap.get(state.highlightNode._id);
    if (d && nodeVertInView(d, settings.verticalPadPx) && nodeInView(d)) {
      const [sx, sy] = worldToScreen(d._vx, d._vy);
      const sr = d._vr * state.camera.k;
      if (sr > 4) {
        ctx.beginPath();
        ctx.arc(sx, sy, sr + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}


