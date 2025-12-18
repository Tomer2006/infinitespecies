/**
 * Main rendering engine module
 *
 * Handles the core visualization rendering using HTML5 Canvas 2D API.
 * Implements level-of-detail rendering, text measurement caching, viewport
 * culling, and optimized batch rendering for smooth performance with
 * millions of taxonomy nodes.
 */

import { getContext, W, H, worldToScreen } from './canvas.js';
import { state } from './state.js';
import { getNodeColor } from './constants.js';
import { perf } from './settings.js';

// Optimized text measurement cache with size limits and hit tracking
const measureCache = new Map();
const MAX_CACHE_SIZE = perf.memory.maxTextCacheSize;
const CACHE_CLEANUP_THRESHOLD = perf.memory.cacheCleanupThreshold;
let cacheAccessOrder = []; // Track access order for LRU-like behavior
const labelCandidates = [];

// Memory management: progressive cleanup
let lastMemoryCheck = 0;
const MEMORY_CHECK_INTERVAL = perf.memory.gcHintInterval;

function performMemoryCleanup() {
  const now = performance.now();
  if (now - lastMemoryCheck > MEMORY_CHECK_INTERVAL) {
    lastMemoryCheck = now;

    // Suggest garbage collection if available
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
    }

    // Cleanup text cache if needed
    if (measureCache.size > CACHE_CLEANUP_THRESHOLD) {
      const cleanupSize = Math.min(perf.memory.progressiveCleanupBatch,
        measureCache.size - CACHE_CLEANUP_THRESHOLD);
      for (let i = 0; i < cleanupSize && cacheAccessOrder.length > 0; i++) {
        const lruKey = cacheAccessOrder.shift();
        measureCache.delete(lruKey);
      }
    }
  }
}

// Cached grid pattern for the background
let gridPattern = null;
let cachedGridSettings = null;
function getGridPattern(ctx) {
  // Check if grid settings changed - if so, regenerate pattern
  const p = perf.rendering;
  if (gridPattern && cachedGridSettings &&
    cachedGridSettings.tileSize === p.gridTileSize &&
    cachedGridSettings.color === p.gridColor &&
    cachedGridSettings.alpha === p.gridAlpha &&
    cachedGridSettings.lineWidth === p.gridLineWidth) {
    return gridPattern;
  }

  // Regenerate grid pattern with current settings
  const tileSize = perf.rendering.gridTileSize;
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;
  const tctx = tile.getContext('2d');
  tctx.strokeStyle = perf.rendering.gridColor;
  tctx.globalAlpha = perf.rendering.gridAlpha;
  tctx.lineWidth = perf.rendering.gridLineWidth;
  tctx.beginPath();
  // vertical line at x=0
  tctx.moveTo(0, 0);
  tctx.lineTo(0, tileSize);
  // horizontal line at y=0
  tctx.moveTo(0, 0);
  tctx.lineTo(tileSize, 0);
  tctx.stroke();
  gridPattern = ctx.createPattern(tile, 'repeat');
  cachedGridSettings = {
    tileSize: perf.rendering.gridTileSize,
    color: perf.rendering.gridColor,
    alpha: perf.rendering.gridAlpha,
    lineWidth: perf.rendering.gridLineWidth
  };
  return gridPattern;
}

export function draw() {
  const ctx = getContext();
  if (!ctx || !state.layout) {
    return;
  }

  // Destructure performance settings once at the top
  const { k: camK, x: camX, y: camY } = state.camera;

  const {
    lodDetailThreshold,
    lodMediumThreshold,
    lodSimpleThreshold,
    lodSkipThreshold,
    minPxRadius,
    labelMinPxRadius,
    maxNodesPerFrame,
    verticalPadPx,
    gridTileSize,
    strokeColorWithChildren,
    strokeColorLeaf,
    strokeMinPxRadius,
    strokeLineWidthMin,
    strokeLineWidthMax,
    strokeLineWidthBase,
    strokeLineWidthMinRatio,
    strokeColorWithChildrenDetail,
    strokeColorLeafDetail,
    labelFontSizeMax,
    labelFontSizeMin,
    labelFontSizeDivisor,
    labelMinFontPx,
    labelFontWeight,
    labelFontFamily,
    maxLabels,
    labelGridCellPx,
    labelStrokeWidthMin,
    labelStrokeWidthMax,
    labelLargeFontThreshold,
    labelStrokeColorLarge,
    labelStrokeColor,
    labelFillColor,
    labelAlpha,
    showGrid
  } = perf.rendering;

  // Periodic memory cleanup
  performMemoryCleanup();

  // Clear once per frame
  ctx.clearRect(0, 0, W, H);

  // Batch rendering operations to minimize state changes
  let currentFillStyle = null;
  let currentStrokeStyle = null;
  let currentLineWidth = null;
  let currentGlobalAlpha = 1;

  // Optimized canvas state management
  const setFillStyle = (style) => {
    if (currentFillStyle !== style) {
      ctx.fillStyle = style;
      currentFillStyle = style;
    }
  };

  const setStrokeStyle = (style) => {
    if (currentStrokeStyle !== style) {
      ctx.strokeStyle = style;
      currentStrokeStyle = style;
    }
  };

  const setLineWidth = (width) => {
    if (currentLineWidth !== width) {
      ctx.lineWidth = width;
      currentLineWidth = width;
    }
  };

  const setGlobalAlpha = (alpha) => {
    if (currentGlobalAlpha !== alpha) {
      ctx.globalAlpha = alpha;
      currentGlobalAlpha = alpha;
    }
  };

  // Grid via cached pattern fill (toggleable) - optimized
  if (showGrid) {
    ctx.save();
    const pat = getGridPattern(ctx);
    const offX = Math.floor((W / 2 - camX * camK) % gridTileSize);
    const offY = Math.floor((H / 2 - camY * camK) % gridTileSize);
    ctx.translate(offX, offY);
    ctx.fillStyle = pat;
    ctx.fillRect(-offX, -offY, W + gridTileSize, H + gridTileSize);
    ctx.restore();
  }

  labelCandidates.length = 0;

  let drawn = 0;
  const maxNodes = maxNodesPerFrame || Infinity;

  // Pre-compute viewport bounds for efficient culling
  const padWorld = verticalPadPx / camK;
  const halfW = W / (2 * camK);
  const halfH = H / (2 * camK);
  const minX = camX - halfW - padWorld;
  const maxX = camX + halfW + padWorld;
  const minY = camY - halfH - padWorld;
  const maxY = camY + halfH + padWorld;

  // Optimized viewport culling using pre-computed bounds
  const isInViewport = (cx, cy, r) => {
    // Fast AABB (Axis-Aligned Bounding Box) check first
    const left = cx - r;
    const right = cx + r;
    const top = cy - r;
    const bottom = cy + r;

    // Check if circle's AABB intersects viewport AABB
    if (right < minX || left > maxX || bottom < minY || top > maxY) {
      return false;
    }

    // More precise check: check if circle intersects viewport rectangle
    const closestX = Math.max(minX, Math.min(cx, maxX));
    const closestY = Math.max(minY, Math.min(cy, maxY));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  };

  function visit(d) {
    if (drawn >= maxNodes) return;
    // Optimized viewport culling
    if (!isInViewport(d._vx, d._vy, d._vr)) return;
    const sr = d._vr * camK;
    // If this node is too small on screen, its children are even smaller (packed layout) → prune subtree
    if (sr < minPxRadius) return;

    const [sx, sy] = worldToScreen(d._vx, d._vy);

    // Level-of-detail rendering based on screen size
    if (sr < lodSkipThreshold) {
      // Skip rendering entirely for very small nodes
      drawn++;
      const ch = d.children || [];
      for (let i = 0; i < ch.length; i++) {
        if (drawn >= maxNodes) break;
        visit(ch[i]);
      }
      return;
    }

    // Determine LOD level
    let lodLevel = 'detail';
    if (sr < lodDetailThreshold) {
      if (sr < lodMediumThreshold) {
        lodLevel = sr < lodSimpleThreshold ? 'simple' : 'medium';
      } else {
        lodLevel = 'medium';
      }
    }

    // Render based on LOD level with optimized state management
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);

    switch (lodLevel) {
      case 'simple':
        // Simple rendering: just filled circle, no stroke
        setFillStyle(getNodeColor(d.data));
        setGlobalAlpha(1);
        ctx.fill();
        break;

      case 'medium':
        // Medium detail: filled circle with simplified stroke
        setFillStyle(getNodeColor(d.data));
        setGlobalAlpha(1);
        ctx.fill();
        // Simplified stroke for medium nodes
        if (sr >= lodMediumThreshold * 2) {
          setLineWidth(1);
          setStrokeStyle(d.children && d.children.length ? strokeColorWithChildren : strokeColorLeaf);
          ctx.stroke();
        }
        break;

      case 'detail':
      default:
        // Full detail rendering (original logic)
        setFillStyle(getNodeColor(d.data));
        setGlobalAlpha(1);
        ctx.fill();
        if (sr >= strokeMinPxRadius) {
          const lineWidth = Math.max(strokeLineWidthMin, Math.min(strokeLineWidthMax, strokeLineWidthBase * Math.sqrt(Math.max(sr / gridTileSize, strokeLineWidthMinRatio))));
          setLineWidth(lineWidth);
          setStrokeStyle(d.children && d.children.length ? strokeColorWithChildrenDetail : strokeColorLeafDetail);
          ctx.stroke();
        }
        break;
    }

    drawn++;
    if (drawn >= maxNodes) return;

    if (sr > labelMinPxRadius) {
      const fontSize = Math.min(labelFontSizeMax, Math.max(labelFontSizeMin, sr / labelFontSizeDivisor));
      if (fontSize >= labelMinFontPx) {
        const text = d.data.name;
        const key = fontSize + '|' + text;
        let metrics = measureCache.get(key);

        // Track cache access for LRU behavior
        if (metrics) {
          // Move to end of access order (most recently used)
          const index = cacheAccessOrder.indexOf(key);
          if (index > -1) {
            cacheAccessOrder.splice(index, 1);
          }
          cacheAccessOrder.push(key);
        } else {
          // Cache miss - measure and store
          ctx.font = `${labelFontWeight} ${fontSize}px ${labelFontFamily}`;
          metrics = { width: ctx.measureText(text).width };

          // Cache management
          if (measureCache.size >= MAX_CACHE_SIZE) {
            // Remove least recently used items
            while (measureCache.size >= CACHE_CLEANUP_THRESHOLD && cacheAccessOrder.length > 0) {
              const lruKey = cacheAccessOrder.shift();
              measureCache.delete(lruKey);
            }
          }

          measureCache.set(key, metrics);
          cacheAccessOrder.push(key);
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

  // Optimized label placement with early rejection and reduced computation
  if (labelCandidates.length) {
    // Sort by size (largest first) and apply stricter limits based on zoom level
    labelCandidates.sort((a, b) => b.fontSize - a.fontSize);

    // Dynamic label limit based on zoom level - fewer labels when zoomed out
    const zoomFactor = Math.max(0.1, Math.min(1, camK));
    const dynamicMaxLabels = Math.floor(maxLabels * zoomFactor);
    const capped = labelCandidates.slice(0, Math.min(dynamicMaxLabels, labelCandidates.length));

    if (capped.length > 0) {
      const placed = [];
      const grid = new Map();
      const cell = labelGridCellPx;

      // Pre-compute cell keys to avoid repeated calculations
      const cellsForRect = r => {
        const cells = [];
        const x1 = Math.floor(r.x1 / cell);
        const y1 = Math.floor(r.y1 / cell);
        const x2 = Math.floor(r.x2 / cell);
        const y2 = Math.floor(r.y2 / cell);
        for (let gx = x1; gx <= x2; gx++) {
          for (let gy = y1; gy <= y2; gy++) {
            cells.push(`${gx},${gy}`);
          }
        }
        return cells;
      };

      const overlaps = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

      // Early rejection: check against larger placed labels first
      for (const cand of capped) {
        const nearbyKeys = cellsForRect(cand.rect);
        let hit = false;

        // Check collision with existing labels
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

        // Render label
        ctx.save();
        ctx.font = `${labelFontWeight} ${cand.fontSize}px ${labelFontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Use same stroke width calculation for all font sizes
        ctx.lineWidth = Math.max(labelStrokeWidthMin, Math.min(labelStrokeWidthMax, cand.fontSize / labelFontSizeDivisor));
        ctx.strokeStyle = cand.fontSize > labelLargeFontThreshold ? labelStrokeColorLarge : labelStrokeColor;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(cand.text, cand.sx, cand.sy);

        ctx.fillStyle = labelFillColor;
        ctx.globalAlpha = labelAlpha;
        ctx.fillText(cand.text, cand.sx, cand.sy);
        ctx.restore();

        // Update spatial index
        placed.push(cand.rect);
        for (const k of nearbyKeys) {
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(cand.rect);
        }
      }
    }
  }
}


