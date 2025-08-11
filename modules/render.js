import { getContext, W, H, worldToScreen, nodeVertInView } from './canvas.js';
import { state } from './state.js';
import { PALETTE, settings } from './constants.js';
import { nodeInView } from './picking.js';

export function draw() {
  const ctx = getContext();
  if (!ctx || !state.layout) return;
  ctx.clearRect(0, 0, W, H);

  // Lightweight grid (only draw when zoomed out)
  if (state.camera.k < 2) {
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
  }

  // Clamp total nodes rendered for performance
  const nodes = state.layout.root
    .descendants()
    .sort((a, b) => a._vr - b._vr)
    .slice(0, 20000);
  const MIN_PX_R = settings.minPxRadius;
  const LABEL_MIN = settings.labelMinPxRadius;
  const labelCandidates = [];

  for (const d of nodes) {
    if (!nodeVertInView(d, settings.verticalPadPx)) continue;
    if (!nodeInView(d)) continue;
    const [sx, sy] = worldToScreen(d._vx, d._vy);
    const sr = d._vr * state.camera.k;
    if (sr < MIN_PX_R) continue;

    const level = d.data.level || 'Life';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE(level) || '#7aa2ff';
    ctx.globalAlpha = 0.17;
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(1, Math.min(3, 1.5 * Math.sqrt(Math.max(sr / 40, 0.25))));
    ctx.strokeStyle = d.children && d.children.length ? '#3a478e' : '#2b356f';
    ctx.stroke();

    if (sr > LABEL_MIN) {
      const fontSize = Math.min(18, Math.max(10, sr / 3));
      if (fontSize >= settings.labelMinFontPx) {
        ctx.save();
        ctx.font = `600 ${fontSize}px ui-sans-serif`;
        const text = d.data.name;
        const metrics = ctx.measureText(text);
        ctx.restore();
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
    // Cap labels per frame
    const MAX_LABELS = 600;
    let drawn = 0;
    for (const cand of labelCandidates) {
      if (drawn >= MAX_LABELS) break;
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
      drawn++;
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


