import { getContext, W, H, worldToScreen } from './canvas.js';
import { state } from './state.js';
import { getNodeColor } from './constants.js';
import { perf } from './settings.js';

// Optimized text measurement cache with size limits and hit tracking
const measureCache = new Map();
const MAX_CACHE_SIZE = perf.memory.maxTextCacheSize;
const CACHE_CLEANUP_THRESHOLD = perf.memory.cacheCleanupThreshold;
let cacheAccessOrder = []; // Track access order for LRU-like behavior

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
  const currentSettings = `${perf.rendering.gridTileSize}-${perf.rendering.gridColor}-${perf.rendering.gridAlpha}-${perf.rendering.gridLineWidth}`;
  if (gridPattern && cachedGridSettings === currentSettings) {
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
  cachedGridSettings = currentSettings;
  return gridPattern;
}

export function draw() {
  const ctx = getContext();
  if (!ctx || !state.layout) {
    return;
  }

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
  if (perf.rendering.showGrid) {
    ctx.save();
    const pat = getGridPattern(ctx);
    const tileSize = perf.rendering.gridTileSize;
    const offX = Math.floor((W / 2 - state.camera.x * state.camera.k) % tileSize);
    const offY = Math.floor((H / 2 - state.camera.y * state.camera.k) % tileSize);
    ctx.translate(offX, offY);
    ctx.fillStyle = pat;
    ctx.fillRect(-offX, -offY, W + tileSize, H + tileSize);
    ctx.restore();
  }

  const MIN_PX_R = perf.rendering.minPxRadius;
  const LABEL_MIN = perf.rendering.labelMinPxRadius;
  const labelCandidates = [];

  let drawn = 0;
  const maxNodes = perf.rendering.maxNodesPerFrame || Infinity;

  // LOD thresholds for performance optimization
  const LOD_DETAIL = perf.rendering.lodDetailThreshold;
  const LOD_MEDIUM = perf.rendering.lodMediumThreshold;
  const LOD_SIMPLE = perf.rendering.lodSimpleThreshold;
  const LOD_SKIP = perf.rendering.lodSkipThreshold;

  // Pre-compute viewport bounds for efficient culling
  const padPx = perf.rendering.verticalPadPx;
  const padWorld = padPx / state.camera.k;
  const halfW = W / (2 * state.camera.k);
  const halfH = H / (2 * state.camera.k);
  const minX = state.camera.x - halfW - padWorld;
  const maxX = state.camera.x + halfW + padWorld;
  const minY = state.camera.y - halfH - padWorld;
  const maxY = state.camera.y + halfH + padWorld;

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
    const sr = d._vr * state.camera.k;
    // If this node is too small on screen, its children are even smaller (packed layout) → prune subtree
    if (sr < MIN_PX_R) return;

    const [sx, sy] = worldToScreen(d._vx, d._vy);

    // Level-of-detail rendering based on screen size
    if (sr < LOD_SKIP) {
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
    if (sr < LOD_DETAIL) {
      if (sr < LOD_MEDIUM) {
        lodLevel = sr < LOD_SIMPLE ? 'simple' : 'medium';
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
        if (sr >= LOD_MEDIUM * 2) {
          setLineWidth(1);
          setStrokeStyle(d.children && d.children.length ? perf.rendering.strokeColorWithChildren : perf.rendering.strokeColorLeaf);
          ctx.stroke();
        }
        break;

      case 'detail':
      default:
        // Full detail rendering (original logic)
        setFillStyle(getNodeColor(d.data));
        setGlobalAlpha(1);
        ctx.fill();
        if (sr >= perf.rendering.strokeMinPxRadius) {
          const lineWidth = Math.max(perf.rendering.strokeLineWidthMin, Math.min(perf.rendering.strokeLineWidthMax, perf.rendering.strokeLineWidthBase * Math.sqrt(Math.max(sr / perf.rendering.gridTileSize, perf.rendering.strokeLineWidthMinRatio))));
          setLineWidth(lineWidth);
          setStrokeStyle(d.children && d.children.length ? perf.rendering.strokeColorWithChildrenDetail : perf.rendering.strokeColorLeafDetail);
          ctx.stroke();
        }
        break;
    }

    drawn++;
    if (drawn >= maxNodes) return;

    if (sr > LABEL_MIN) {
      const fontSize = Math.min(perf.rendering.labelFontSizeMax, Math.max(perf.rendering.labelFontSizeMin, sr / perf.rendering.labelFontSizeDivisor));
      if (fontSize >= perf.rendering.labelMinFontPx) {
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
          ctx.save();
          ctx.font = `${perf.rendering.labelFontWeight} ${fontSize}px ${perf.rendering.labelFontFamily}`;
          metrics = { width: ctx.measureText(text).width };
          ctx.restore();

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
    const zoomFactor = Math.max(0.1, Math.min(1, state.camera.k));
    const dynamicMaxLabels = Math.floor(perf.rendering.maxLabels * zoomFactor);
    const capped = labelCandidates.slice(0, Math.min(dynamicMaxLabels, labelCandidates.length));

    if (capped.length > 0) {
      const placed = [];
      const grid = new Map();
      const cell = perf.rendering.labelGridCellPx;

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
        ctx.font = `${perf.rendering.labelFontWeight} ${cand.fontSize}px ${perf.rendering.labelFontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Use same stroke width calculation for all font sizes
        ctx.lineWidth = Math.max(perf.rendering.labelStrokeWidthMin, Math.min(perf.rendering.labelStrokeWidthMax, cand.fontSize / perf.rendering.labelFontSizeDivisor));
        ctx.strokeStyle = cand.fontSize > perf.rendering.labelLargeFontThreshold ? perf.rendering.labelStrokeColorLarge : perf.rendering.labelStrokeColor;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(cand.text, cand.sx, cand.sy);

        ctx.fillStyle = perf.rendering.labelFillColor;
        ctx.globalAlpha = perf.rendering.labelAlpha;
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


