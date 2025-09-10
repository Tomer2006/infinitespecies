import { getContext, W, H, worldToScreen, nodeVertInView, circleInViewportWorld } from './canvas.js';
import { state } from './state.js';
import { getNodeColor } from './constants.js';
import { perf } from './performance.js';
import { nodeInView } from './picking.js';

// Memory optimization: periodic cleanup of caches
let lastMemoryCleanup = 0;
const MEMORY_CLEANUP_INTERVAL = 30000; // 30 seconds

function performMemoryCleanup() {
  const now = performance.now();
  if (now - lastMemoryCleanup < MEMORY_CLEANUP_INTERVAL) return;

  // Clear text measurement cache periodically to free memory
  if (measureCache.size > 1000) {
    measureCache.clear();
  }

  // Force garbage collection if available (for development/debugging)
  if (window.gc && typeof window.gc === 'function') {
    window.gc();
  }

  lastMemoryCleanup = now;
}

// Export for use in canvas.js
export { updatePerformanceMetrics };

// Performance monitoring and dynamic optimization
let fpsHistory = [];
const FPS_HISTORY_SIZE = 10;
let lastFpsCheck = 0;
const FPS_CHECK_INTERVAL = 1000; // 1 second

function updatePerformanceMetrics(currentFps) {
  const now = performance.now();
  if (now - lastFpsCheck < FPS_CHECK_INTERVAL) return;

  fpsHistory.push(currentFps);
  if (fpsHistory.length > FPS_HISTORY_SIZE) {
    fpsHistory.shift();
  }

  // Calculate average FPS
  const avgFps = fpsHistory.reduce((sum, fps) => sum + fps, 0) / fpsHistory.length;

  // Dynamic performance optimization based on FPS
  if (avgFps < 20) {
    // Low FPS: enable more aggressive optimizations
    if (perf.rendering.maxLabels > 100) {
      perf.rendering.maxLabels = Math.max(50, perf.rendering.maxLabels - 20);
    }
    if (perf.rendering.maxNodesPerFrame > 8000) {
      perf.rendering.maxNodesPerFrame = Math.max(5000, perf.rendering.maxNodesPerFrame - 1000);
    }
    if (perf.rendering.minPxRadius < 12) {
      perf.rendering.minPxRadius = Math.min(15, perf.rendering.minPxRadius + 2);
    }
  } else if (avgFps > 40) {
    // High FPS: can afford more detail
    if (perf.rendering.maxLabels < 180) {
      perf.rendering.maxLabels = Math.min(180, perf.rendering.maxLabels + 10);
    }
    if (perf.rendering.maxNodesPerFrame < 12000) {
      perf.rendering.maxNodesPerFrame = Math.min(12000, perf.rendering.maxNodesPerFrame + 500);
    }
    if (perf.rendering.minPxRadius > 6) {
      perf.rendering.minPxRadius = Math.max(6, perf.rendering.minPxRadius - 1);
    }
  }

  lastFpsCheck = now;
}

// Optimized LRU cache for text measurement with size limits
class TextMeasureCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  get(key) {
    if (this.cache.has(key)) {
      // Move to end of access order (most recently used)
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return undefined;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      // Update existing entry
      this.cache.set(key, value);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
    } else {
      // Add new entry
      this.cache.set(key, value);
      this.accessOrder.push(key);

      // Evict least recently used if over limit
      if (this.cache.size > this.maxSize) {
        const lruKey = this.accessOrder.shift();
        this.cache.delete(lruKey);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.accessOrder.length = 0;
  }

  get size() {
    return this.cache.size;
  }
}

const measureCache = new TextMeasureCache(1500); // Increased limit for better performance

// Helper function to draw a single circle
function drawCircle(ctx, circle) {
  ctx.beginPath();
  ctx.arc(circle.sx, circle.sy, circle.sr, 0, Math.PI * 2);
  ctx.fillStyle = circle.color;
  ctx.globalAlpha = 1;
  ctx.fill();

  if (circle.sr >= perf.rendering.strokeMinPxRadius) {
    ctx.lineWidth = Math.max(1, Math.min(3, 1.5 * Math.sqrt(Math.max(circle.sr / 40, 0.25))));
    ctx.strokeStyle = circle.hasChildren ? 'rgba(220,230,255,0.85)' : 'rgba(180,195,240,0.85)';
    ctx.stroke();
  }
}

// Level-of-detail rendering function
function shouldRenderWithLOD(circle, level) {
  if (!perf.rendering.lodLevels) return true;

  const thresholds = perf.rendering.lodThresholds;
  if (!thresholds || level >= thresholds.length) return true;

  const threshold = thresholds[level];
  return circle.sr >= threshold;
}

// LOD rendering: draw simplified version for distant nodes
function drawCircleLOD(ctx, circle, lodLevel) {
  const { sx, sy, sr, color, hasChildren } = circle;

  // Skip rendering entirely for very small nodes at high LOD levels
  if (lodLevel >= 2 && sr < 2) return;

  // For LOD level 1+, use simplified rendering
  if (lodLevel >= 1) {
    // Draw as filled rectangle instead of circle for better performance
    const halfSize = Math.max(1, sr * 0.7);
    ctx.fillStyle = color;
    ctx.fillRect(sx - halfSize, sy - halfSize, halfSize * 2, halfSize * 2);

    // Skip borders for small nodes
    if (sr >= perf.rendering.strokeMinPxRadius && lodLevel < 2) {
      ctx.strokeStyle = hasChildren ? 'rgba(220,230,255,0.6)' : 'rgba(180,195,240,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - halfSize, sy - halfSize, halfSize * 2, halfSize * 2);
    }
    return;
  }

  // LOD level 0: full quality circle rendering
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.fill();

  if (sr >= perf.rendering.strokeMinPxRadius) {
    ctx.lineWidth = Math.max(1, Math.min(3, 1.5 * Math.sqrt(Math.max(sr / 40, 0.25))));
    ctx.strokeStyle = hasChildren ? 'rgba(220,230,255,0.85)' : 'rgba(180,195,240,0.85)';
    ctx.stroke();
  }
}

// Batch draw function with LOD support
function batchDrawCircles(ctx, circles, groupName = 'circles') {
  if (!circles.length) return;

  // Sort by size for better rendering order (largest first)
  circles.sort((a, b) => b.sr - a.sr);

  // Group by color for even better batching
  const colorGroups = new Map();

  for (const circle of circles) {
    if (!colorGroups.has(circle.color)) {
      colorGroups.set(circle.color, []);
    }
    colorGroups.get(circle.color).push(circle);
  }

  // Draw each color group
  for (const [color, group] of colorGroups) {
    // Determine LOD level based on average size of group
    const avgSize = group.reduce((sum, c) => sum + c.sr, 0) / group.length;
    let lodLevel = 0;

    if (perf.rendering.lodLevels && perf.rendering.lodThresholds) {
      const thresholds = perf.rendering.lodThresholds;
      for (let i = thresholds.length - 1; i >= 0; i--) {
        if (avgSize < thresholds[i]) {
          lodLevel = i + 1;
          break;
        }
      }
    }

    // Draw all circles in this group with LOD
    for (const circle of group) {
      if (shouldRenderWithLOD(circle, lodLevel)) {
        drawCircleLOD(ctx, circle, lodLevel);
      }
    }
  }
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

  // Memory optimization: periodic cleanup
  performMemoryCleanup();

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

  // Performance optimization: pre-allocate arrays for batching
  const circles = [];
  const smallCircles = [];
  const mediumCircles = [];
  const largeCircles = [];

  function visit(d) {
    if (drawn >= maxNodes) return;
    // Cull entire subtree if parent circle is out of view
    if (!circleInViewportWorld(d._vx, d._vy, d._vr, perf.rendering.verticalPadPx)) return;
    const sr = d._vr * state.camera.k;
    // If this node is too small on screen, its children are even smaller (packed layout) → prune subtree
    if (sr < MIN_PX_R) return;

    const [sx, sy] = worldToScreen(d._vx, d._vy);
    const color = getNodeColor(d.data);

    // Performance optimization: categorize circles by size for batching
    const circleData = { sx, sy, sr, color, hasChildren: !!(d.children && d.children.length) };

    if (perf.rendering.useFastRendering && perf.rendering.batchDrawCalls) {
      // Batch circles by size for optimized rendering
      if (sr < 20) {
        smallCircles.push(circleData);
      } else if (sr < 100) {
        mediumCircles.push(circleData);
      } else {
        largeCircles.push(circleData);
      }
    } else {
      // Fallback to immediate drawing for compatibility
      drawCircle(ctx, circleData);
    }

    drawn++;
    if (drawn >= maxNodes) return;

    if (sr > LABEL_MIN) {
      const fontSize = Math.min(18, Math.max(10, sr / 3));
      if (fontSize >= perf.rendering.labelMinFontPx) {
        const text = d.data.name;
        const key = fontSize + '|' + text;
        let metrics = measureCache.get(key);
        if (!metrics) {
          ctx.save();
          ctx.font = `600 ${fontSize}px ui-sans-serif`;
          metrics = { width: ctx.measureText(text).width };
          ctx.restore();
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

  // Performance optimization: batch draw all circles at once
  if (perf.rendering.useFastRendering && perf.rendering.batchDrawCalls) {
    // Draw large circles first (background), then medium, then small (foreground)
    batchDrawCircles(ctx, largeCircles, 'large');
    batchDrawCircles(ctx, mediumCircles, 'medium');
    batchDrawCircles(ctx, smallCircles, 'small');
  }

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

  // Highlight ring removed - now handled by CSS overlay for better performance
}


