import { getContext, W, H, worldToScreen, nodeVertInView, circleInViewportWorld } from './canvas.js';
import { state } from './state.js';
import { getNodeColor } from './constants.js';
import { perf } from './performance.js';
import { nodeInView } from './picking.js';

// Simple LRU-ish cache for text measurement
const measureCache = new Map();

function isMetadataNodeName(name) {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase();
  return lower.includes('sibling_higher') || 
         lower.includes('barren') || 
         lower.includes('was_container') || 
         lower.includes('not_otu') || 
         lower.includes('unplaced') || 
         lower.includes('hidden') || 
         lower.includes('inconsistent') || 
         lower.includes('merged') ||
         lower === 'infraspecific' ||
         /^[a-z_,]+$/.test(lower); // all lowercase with only underscores/commas
}

// Cached grid pattern for the background
let gridPattern = null;
function getGridPattern(ctx) {
  if (gridPattern) return gridPattern;
  const tile = document.createElement('canvas');
  tile.width = 40;
  tile.height = 40;
  const tctx = tile.getContext('2d');
  tctx.strokeStyle = '#8aa1ff';
  tctx.globalAlpha = 0.05;
  tctx.lineWidth = 1;
  tctx.beginPath();
  // vertical line at x=0
  tctx.moveTo(0, 0);
  tctx.lineTo(0, 40);
  // horizontal line at y=0
  tctx.moveTo(0, 0);
  tctx.lineTo(40, 0);
  tctx.stroke();
  gridPattern = ctx.createPattern(tile, 'repeat');
  return gridPattern;
}

export function draw() {
  const ctx = getContext();
  if (!ctx || !state.layout) return;
  // Clear once per frame
  ctx.clearRect(0, 0, W, H);

  // Grid via cached pattern fill (toggleable)
  if (perf.rendering.showGrid) {
    ctx.save();
    const pat = getGridPattern(ctx);
    const offX = Math.floor((W / 2 - state.camera.x * state.camera.k) % 40);
    const offY = Math.floor((H / 2 - state.camera.y * state.camera.k) % 40);
    ctx.translate(offX, offY);
    ctx.fillStyle = pat;
    ctx.fillRect(-offX, -offY, W + 40, H + 40);
    ctx.restore();
  }

  const MIN_PX_R = perf.rendering.minPxRadius;
  const LABEL_MIN = perf.rendering.labelMinPxRadius;
  const labelCandidates = [];

  let drawn = 0;
  const maxNodes = perf.rendering.maxNodesPerFrame || Infinity;

  function visit(d) {
    if (drawn >= maxNodes) return;
    // Cull entire subtree if parent circle is out of view
    if (!circleInViewportWorld(d._vx, d._vy, d._vr, perf.rendering.verticalPadPx)) return;
    const sr = d._vr * state.camera.k;
    // If this node is too small on screen, its children are even smaller (packed layout) → prune subtree
    if (sr < MIN_PX_R) return;

    const [sx, sy] = worldToScreen(d._vx, d._vy);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = getNodeColor(d.data);
    ctx.globalAlpha = 1;
    ctx.fill();
    if (sr >= perf.rendering.strokeMinPxRadius) {
      ctx.lineWidth = Math.max(1, Math.min(3, 1.5 * Math.sqrt(Math.max(sr / 40, 0.25))));
      ctx.strokeStyle = d.children && d.children.length ? 'rgba(220,230,255,0.85)' : 'rgba(180,195,240,0.85)';
      ctx.stroke();
    }
    drawn++;
    if (drawn >= maxNodes) return;

    if (sr > LABEL_MIN) {
      const fontSize = Math.min(18, Math.max(10, sr / 3));
      if (fontSize >= perf.rendering.labelMinFontPx) {
        const text = d.data.name;
        // Skip metadata/administrative nodes
        if (isMetadataNodeName(text)) {
          return;
        }
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
        const textWidth = metrics.width;
        const textHeight = fontSize;
        const pad = 2;
        const rect = {
          x1: sx - textWidth / 2 - pad,
          y1: sy - textHeight / 2 - pad,
          x2: sx + textWidth / 2 + pad,
          y2: sy + textHeight / 2 + pad
        };
        labelCandidates.push({ sx, sy, fontSize, text, rect });
      }
    }

    const ch = d.children || [];
    for (let i = 0; i < ch.length; i++) {
      if (drawn >= maxNodes) break;
      visit(ch[i]);
    }
  }

  visit(state.layout.root);

  // Label placement pass with spatial grid and cap
  if (labelCandidates.length) {
    const placed = [];
    const grid = new Map();
    const cell = perf.rendering.labelGridCellPx;
    const keyFor = (x, y) => ((x / cell) | 0) + ',' + ((y / cell) | 0);
    const cellsForRect = r => {
      const cells = [];
      const x1 = (r.x1 / cell) | 0;
      const y1 = (r.y1 / cell) | 0;
      const x2 = (r.x2 / cell) | 0;
      const y2 = (r.y2 / cell) | 0;
      for (let gx = x1; gx <= x2; gx++) for (let gy = y1; gy <= y2; gy++) cells.push(gx + ',' + gy);
      return cells;
    };
    const overlaps = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
    labelCandidates.sort((a, b) => b.fontSize - a.fontSize);
    const capped = labelCandidates.slice(0, perf.rendering.maxLabels);
    for (const cand of capped) {
      const nearbyKeys = cellsForRect(cand.rect);
      let hit = false;
      for (const k of nearbyKeys) {
        const arr = grid.get(k);
        if (!arr) continue;
        for (const r of arr) {
          if (overlaps(cand.rect, r)) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) continue;
      ctx.save();
      ctx.font = `600 ${cand.fontSize}px ui-sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Cheaper outline stroke
      ctx.lineWidth = Math.max(2, Math.min(5, cand.fontSize / 3));
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(cand.text, cand.sx, cand.sy);
      ctx.fillStyle = '#e9eeff';
      ctx.globalAlpha = 0.95;
      ctx.fillText(cand.text, cand.sx, cand.sy);
      ctx.restore();
      placed.push(cand.rect);
      for (const k of nearbyKeys) {
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(cand.rect);
      }
    }
  }

  // Highlight ring
  if (state.highlightNode) {
    const d = state.nodeLayoutMap.get(state.highlightNode._id);
    if (d && nodeVertInView(d, perf.rendering.verticalPadPx) && nodeInView(d)) {
      const [sx, sy] = worldToScreen(d._vx, d._vy);
      const sr = d._vr * state.camera.k;
      if (sr > 4) {
        ctx.beginPath();
        ctx.arc(sx, sy, sr + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
}


