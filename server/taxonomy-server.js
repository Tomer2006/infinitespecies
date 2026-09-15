#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { TaxonomySearchIndex, normalizeSearchQuery } from './search-index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');
const distDir = path.join(repoRoot, 'dist');
const dataDir = path.join(publicDir, 'data');

const port = Number(process.env.PORT || 8787);
const defaultDepth = Number(process.env.SUBTREE_DEPTH || 2);
const maxDepth = Number(process.env.MAX_SUBTREE_DEPTH || 4);
const configuredSearchLimit = Number(process.env.MAX_SEARCH_LIMIT || 20);
const maxSearchLimit = Number.isFinite(configuredSearchLimit)
  ? Math.max(1, Math.min(configuredSearchLimit, 20))
  : 20;
const defaultViewportLimit = Number(process.env.VIEWPORT_NODE_LIMIT || 12000);
const configuredSpatialCellSize = Number(process.env.SPATIAL_CELL_SIZE || 8);
const spatialCellSize = Number.isFinite(configuredSpatialCellSize) && configuredSpatialCellSize > 0
  ? configuredSpatialCellSize
  : 8;

const index = loadIndex();
if (typeof global.gc === 'function') global.gc();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/health') {
      return sendJson(res, {
        ok: true,
        total_nodes: index.totalNodes,
        root_id: index.rootId,
      });
    }

    if (url.pathname === '/api/tree/root') {
      return sendJson(res, buildNodeResponse(index.rootId, readDepth(url)));
    }

    if (url.pathname === '/api/tree/viewport') {
      return sendJson(res, buildViewportResponse(url));
    }

    const childrenMatch = url.pathname.match(/^\/api\/tree\/children\/(\d+)$/);
    if (childrenMatch) {
      const id = Number(childrenMatch[1]);
      if (!nodeExists(id)) return sendJson(res, { error: 'Node not found' }, 404);
      const requestedOffset = Number(url.searchParams.get('offset') || 0);
      const offset = Number.isSafeInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0;
      const children = childIds(id);
      const page = children.slice(offset, offset + 50);
      return sendJson(res, {
        nodes: [...new Set([...ancestorIds(id), ...page])].map(serializeNode),
        child_ids: page,
        total: children.length,
      });
    }

    const nodeMatch = url.pathname.match(/^\/api\/tree\/node\/(\d+)$/);
    if (nodeMatch) {
      const id = Number(nodeMatch[1]);
      if (!nodeExists(id)) return sendJson(res, { error: 'Node not found' }, 404);
      return sendJson(res, buildNodeResponse(id, readDepth(url)));
    }

    if (url.pathname === '/api/tree/path') {
      const pathValue = url.searchParams.get('path') || '';
      const id = findNodeByPath(pathValue);
      if (!id) return sendJson(res, { error: 'Path not found' }, 404);
      return sendJson(res, buildNodeResponse(id, readDepth(url)));
    }

    if (url.pathname === '/api/search') {
      const query = normalizeSearchQuery(url.searchParams.get('q'));
      const requestedLimit = Number(url.searchParams.get('limit') || 20);
      const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 20, maxSearchLimit));
      const searchStarted = performance.now();
      const body = query.length >= 2 ? searchNodes(query, limit) : { matches: [] };
      const durationMs = performance.now() - searchStarted;
      return sendJson(res, body, 200, {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'Server-Timing': `search;dur=${durationMs.toFixed(1)}`,
      });
    }

    if (url.pathname === '/api/random') {
      const fromRaw = url.searchParams.get('from');
      const fromId = fromRaw != null && nodeExists(Number(fromRaw)) ? Number(fromRaw) : index.rootId;
      return sendJson(res, buildNodeResponse(pickRandomLeaf(fromId), readDepth(url)));
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, { error: 'Internal server error' }, 500);
  }
});

server.listen(port, () => {
  console.log(`[taxonomy-server] Listening on http://localhost:${port}`);
  console.log(`[taxonomy-server] Loaded ${index.totalNodes.toLocaleString()} nodes`);
});

function loadIndex() {
  const started = Date.now();
  const manifestPath = path.join(dataDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const capacity = Number(manifest.total_nodes) + 1;
  if (!Number.isSafeInteger(capacity) || capacity <= 1) {
    throw new Error('Invalid manifest total_nodes');
  }

  const namesById = new Array(capacity);
  const parentIds = new Uint32Array(capacity);
  const levels = new Uint8Array(capacity);
  const xCentis = new Int32Array(capacity);
  const yCentis = new Int32Array(capacity);
  const radiusCentis = new Uint32Array(capacity);
  const firstChildIds = new Uint32Array(capacity);
  const nextSiblingIds = new Uint32Array(capacity);
  const lastChildIds = new Uint32Array(capacity);
  const searchIndex = new TaxonomySearchIndex({ maxCacheEntries: 500 });
  let rootId = null;
  let maxId = 0;
  let totalNodes = 0;

  for (const file of manifest.files || []) {
    const filePath = path.join(dataDir, file.filename);
    console.log(`[taxonomy-server] Reading ${file.filename}`);
    const nodes = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const compactRows = manifest.format === 'compact-rows-v1';
    const firstImplicitId = Number(file.start_id) || totalNodes + 1;

    for (let rowIndex = 0; rowIndex < nodes.length; rowIndex++) {
      const raw = nodes[rowIndex];
      const id = compactRows ? firstImplicitId + rowIndex : Number(raw.id);
      const parentId = Number(compactRows ? raw[0] : raw.parent_id) || 0;
      const name = String((compactRows ? raw[1] : raw.name) || 'Unnamed');
      const level = Number(compactRows ? raw[2] : raw.level) || 0;
      const x = Number(compactRows ? raw[3] : raw.x) || 0;
      const y = Number(compactRows ? raw[4] : raw.y) || 0;
      const radius = Number(compactRows ? raw[5] : raw.r) || 0;

      if (!Number.isSafeInteger(id) || id <= 0 || id >= capacity) {
        throw new Error(`Node id ${id} is outside manifest capacity`);
      }
      if (!Number.isSafeInteger(parentId) || parentId < 0 || parentId >= capacity) {
        throw new Error(`Parent id ${parentId} for node ${id} is outside manifest capacity`);
      }

      namesById[id] = name;
      parentIds[id] = parentId;
      levels[id] = level;
      xCentis[id] = Math.round(x * 100);
      yCentis[id] = Math.round(y * 100);
      radiusCentis[id] = Math.max(0, Math.round(radius * 100));
      searchIndex.add(id, name);
      totalNodes++;
      if (id > maxId) maxId = id;

      if (parentId === 0) {
        rootId = id;
      } else {
        const previousChild = lastChildIds[parentId];
        if (previousChild) nextSiblingIds[previousChild] = id;
        else firstChildIds[parentId] = id;
        lastChildIds[parentId] = id;
      }
    }
  }

  searchIndex.finalize();

  const leaves = new Uint32Array(capacity);
  for (let id = maxId; id >= 1; id--) {
    if (!namesById[id]) continue;
    const firstChildId = firstChildIds[id];
    if (!firstChildId) {
      leaves[id] = 1;
      continue;
    }

    let sum = 0;
    for (let childId = firstChildId; childId; childId = nextSiblingIds[childId]) {
      sum += leaves[childId] || 1;
    }
    leaves[id] = sum || 1;
  }

  const spatialIndex = buildSpatialIndex(namesById, xCentis, yCentis, radiusCentis, maxId);

  console.log(`[taxonomy-server] Indexed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return {
    manifest,
    namesById,
    parentIds,
    levels,
    xCentis,
    yCentis,
    radiusCentis,
    firstChildIds,
    nextSiblingIds,
    leaves,
    ...spatialIndex,
    searchIndex,
    rootId,
    maxId,
    totalNodes,
  };
}

function buildSpatialIndex(namesById, xCentis, yCentis, radiusCentis, maxId) {
  const cellSizeCentis = Math.max(1, Math.round(spatialCellSize * 100));
  let gridMinX = Number.POSITIVE_INFINITY;
  let gridMaxX = Number.NEGATIVE_INFINITY;
  let gridMinY = Number.POSITIVE_INFINITY;
  let gridMaxY = Number.NEGATIVE_INFINITY;
  let largeCount = 0;
  let smallCount = 0;

  for (let id = 1; id <= maxId; id++) {
    if (!namesById[id]) continue;
    if (radiusCentis[id] >= cellSizeCentis) {
      largeCount++;
      continue;
    }
    const gx = Math.floor(xCentis[id] / cellSizeCentis);
    const gy = Math.floor(yCentis[id] / cellSizeCentis);
    gridMinX = Math.min(gridMinX, gx);
    gridMaxX = Math.max(gridMaxX, gx);
    gridMinY = Math.min(gridMinY, gy);
    gridMaxY = Math.max(gridMaxY, gy);
    smallCount++;
  }

  const largeSpatialIds = new Uint32Array(largeCount);
  if (smallCount === 0) {
    let largeOffset = 0;
    for (let id = 1; id <= maxId; id++) {
      if (namesById[id] && radiusCentis[id] >= cellSizeCentis) largeSpatialIds[largeOffset++] = id;
    }
    return {
      largeSpatialIds,
      smallSpatialIds: new Uint32Array(0),
      spatialCellOffsets: new Uint32Array(1),
      spatialGridMinX: 0,
      spatialGridMinY: 0,
      spatialGridWidth: 0,
      spatialGridHeight: 0,
    };
  }

  const spatialGridWidth = gridMaxX - gridMinX + 1;
  const spatialGridHeight = gridMaxY - gridMinY + 1;
  const gridCellCount = spatialGridWidth * spatialGridHeight;
  if (!Number.isSafeInteger(gridCellCount) || gridCellCount > 10_000_000) {
    throw new Error(`Spatial grid is too large: ${gridCellCount} cells`);
  }

  const counts = new Uint32Array(gridCellCount);
  let largeOffset = 0;
  for (let id = 1; id <= maxId; id++) {
    if (!namesById[id]) continue;
    if (radiusCentis[id] >= cellSizeCentis) {
      largeSpatialIds[largeOffset++] = id;
      continue;
    }
    const gx = Math.floor(xCentis[id] / cellSizeCentis);
    const gy = Math.floor(yCentis[id] / cellSizeCentis);
    const cellIndex = (gy - gridMinY) * spatialGridWidth + gx - gridMinX;
    counts[cellIndex]++;
  }

  const spatialCellOffsets = new Uint32Array(gridCellCount + 1);
  for (let index = 0; index < gridCellCount; index++) {
    spatialCellOffsets[index + 1] = spatialCellOffsets[index] + counts[index];
  }

  const writeOffsets = spatialCellOffsets.slice(0, gridCellCount);
  const smallSpatialIds = new Uint32Array(smallCount);
  for (let id = 1; id <= maxId; id++) {
    if (!namesById[id] || radiusCentis[id] >= cellSizeCentis) continue;
    const gx = Math.floor(xCentis[id] / cellSizeCentis);
    const gy = Math.floor(yCentis[id] / cellSizeCentis);
    const cellIndex = (gy - gridMinY) * spatialGridWidth + gx - gridMinX;
    smallSpatialIds[writeOffsets[cellIndex]++] = id;
  }

  return {
    largeSpatialIds,
    smallSpatialIds,
    spatialCellOffsets,
    spatialGridMinX: gridMinX,
    spatialGridMinY: gridMinY,
    spatialGridWidth,
    spatialGridHeight,
  };
}

function readDepth(url) {
  const rawDepth = Number(url.searchParams.get('depth') || defaultDepth);
  if (!Number.isFinite(rawDepth)) return defaultDepth;
  return Math.max(0, Math.min(maxDepth, Math.floor(rawDepth)));
}

function buildNodeResponse(id, depth) {
  const included = new Set();
  const expanded = new Set();
  const stack = [{ id, depthLeft: depth }];

  for (const ancestorId of ancestorIds(id)) included.add(ancestorId);

  while (stack.length) {
    const current = stack.pop();
    included.add(current.id);
    if (current.depthLeft <= 0) continue;

    const children = childIds(current.id);
    expanded.add(current.id);
    for (const childId of children) {
      included.add(childId);
      stack.push({ id: childId, depthLeft: current.depthLeft - 1 });
    }
  }

  const nodes = Array.from(included)
    .map(nodeId => serializeNode(nodeId))
    .filter(Boolean);

  return {
    root_id: index.rootId,
    requested_id: id,
    depth,
    path: ancestorIds(id).map(ancestorId => serializeNode(ancestorId)),
    expanded_ids: Array.from(expanded),
    nodes,
  };
}

function buildViewportResponse(url) {
  const cameraX = Number(url.searchParams.get('x') || 0);
  const cameraY = Number(url.searchParams.get('y') || 0);
  const cameraK = Number(url.searchParams.get('k') || 1);
  const width = Number(url.searchParams.get('w') || 1200);
  const height = Number(url.searchParams.get('h') || 800);
  const minPxRadius = Number(url.searchParams.get('minPxRadius') || 7);
  const padPx = Number(url.searchParams.get('padPx') || 100);
  const limit = Math.max(100, Math.min(Number(url.searchParams.get('limit') || defaultViewportLimit), 50000));
  const currentId = Number(url.searchParams.get('currentId') || index.rootId);

  const safeK = Number.isFinite(cameraK) && cameraK > 0 ? cameraK : 1;
  const halfW = width / (2 * safeK);
  const halfH = height / (2 * safeK);
  const padWorld = padPx / safeK;
  const minX = cameraX - halfW - padWorld;
  const maxX = cameraX + halfW + padWorld;
  const minY = cameraY - halfH - padWorld;
  const maxY = cameraY + halfH + padWorld;
  const minWorldRadius = minPxRadius / safeK;

  const visibleIds = [];
  let candidateCount = 0;
  let truncated = false;

  const candidateIds = viewportCandidateIds(minX, maxX, minY, maxY, minWorldRadius);
  for (const id of candidateIds) {
    const radius = index.radiusCentis[id] / 100;
    if (radius < minWorldRadius) continue;
    const x = index.xCentis[id] / 100;
    const y = index.yCentis[id] / 100;
    if (!circleIntersectsRect(x, y, radius, minX, maxX, minY, maxY)) continue;

    candidateCount++;
    visibleIds.push(id);
    if (visibleIds.length >= limit) {
      truncated = true;
      break;
    }
  }

  const included = new Set();
  for (const id of ancestorIds(currentId || index.rootId)) included.add(id);
  for (const id of visibleIds) {
    for (const ancestorId of ancestorIds(id)) included.add(ancestorId);
    included.add(id);
  }

  return {
    root_id: index.rootId,
    requested_id: currentId || index.rootId,
    viewport: {
      x: cameraX,
      y: cameraY,
      k: safeK,
      w: width,
      h: height,
      minPxRadius,
      padPx,
      candidate_count: candidateCount,
      returned_visible_count: visibleIds.length,
      truncated,
    },
    visible_ids: visibleIds,
    nodes: Array.from(included).map(nodeId => serializeNode(nodeId)).filter(Boolean),
  };
}

function* viewportCandidateIds(minX, maxX, minY, maxY, minWorldRadius) {
  for (const id of index.largeSpatialIds) {
    if (index.radiusCentis[id] / 100 >= minWorldRadius) yield id;
  }

  if (minWorldRadius >= spatialCellSize || index.spatialGridWidth === 0) return;

  const gridMinX = Math.max(index.spatialGridMinX, Math.floor((minX - spatialCellSize) / spatialCellSize));
  const gridMaxX = Math.min(index.spatialGridMinX + index.spatialGridWidth - 1, Math.floor((maxX + spatialCellSize) / spatialCellSize));
  const gridMinY = Math.max(index.spatialGridMinY, Math.floor((minY - spatialCellSize) / spatialCellSize));
  const gridMaxY = Math.min(index.spatialGridMinY + index.spatialGridHeight - 1, Math.floor((maxY + spatialCellSize) / spatialCellSize));

  for (let gx = gridMinX; gx <= gridMaxX; gx++) {
    for (let gy = gridMinY; gy <= gridMaxY; gy++) {
      const cellIndex = (gy - index.spatialGridMinY) * index.spatialGridWidth + gx - index.spatialGridMinX;
      const start = index.spatialCellOffsets[cellIndex];
      const end = index.spatialCellOffsets[cellIndex + 1];
      for (let offset = start; offset < end; offset++) yield index.smallSpatialIds[offset];
    }
  }
}

function circleIntersectsRect(cx, cy, r, minX, maxX, minY, maxY) {
  if (cx + r < minX || cx - r > maxX || cy + r < minY || cy - r > maxY) return false;
  const closestX = Math.max(minX, Math.min(cx, maxX));
  const closestY = Math.max(minY, Math.min(cy, maxY));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

function serializeNode(id) {
  if (!nodeExists(id)) return null;
  const parentId = index.parentIds[id];
  return {
    id,
    parent_id: parentId || null,
    name: index.namesById[id],
    level: index.levels[id],
    x: index.xCentis[id] / 100,
    y: index.yCentis[id] / 100,
    r: index.radiusCentis[id] / 100,
    leaves: index.leaves[id] || 1,
    has_children: index.firstChildIds[id] !== 0,
  };
}

function ancestorIds(id) {
  const ids = [];
  while (nodeExists(id)) {
    ids.unshift(id);
    id = index.parentIds[id];
  }
  return ids;
}

function findNodeByPath(pathValue) {
  const parts = decodeURIComponent(pathValue || '').split('/').filter(Boolean);
  if (!parts.length) return index.rootId;

  let currentId = index.rootId;
  let partIndex = parts[0] === index.namesById[currentId] ? 1 : 0;

  for (; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex];
    let nextId = 0;
    for (const childId of childIds(currentId)) {
      if (index.namesById[childId] === part) {
        nextId = childId;
        break;
      }
    }
    if (!nextId) return null;
    currentId = nextId;
  }

  return currentId;
}

function pickRandomLeaf(fromId) {
  let id = nodeExists(fromId) ? fromId : index.rootId;

  // Weighted random descent by leaf counts, mirroring the client-side surprise walk.
  // targetIndex is uniform over all leaves under `id`, so every leaf is equally likely.
  let targetIndex = Math.floor(Math.random() * (index.leaves[id] || 1));
  let guard = 0;
  while (guard++ < 100000) {
    const firstChildId = index.firstChildIds[id];
    if (!firstChildId) break;

    let chosen = firstChildId;
    for (const childId of childIds(id)) {
      chosen = childId;
      const weight = index.leaves[childId] || 1;
      if (targetIndex < weight) {
        chosen = childId;
        break;
      }
      targetIndex -= weight;
    }
    id = chosen;
  }

  return id;
}

function searchNodes(query, limit) {
  return {
    matches: index.searchIndex.search(query, limit).map(({ id, score }) => {
      return {
        ...serializeNode(id),
        score,
        path: ancestorIds(id).map(ancestorId => index.namesById[ancestorId]).join(' / '),
      };
    }),
  };
}

function nodeExists(id) {
  return Number.isSafeInteger(id) && id > 0 && id <= index.maxId && Boolean(index.namesById[id]);
}

function childIds(id) {
  const ids = [];
  for (let childId = index.firstChildIds[id]; childId; childId = index.nextSiblingIds[childId]) {
    ids.push(childId);
  }
  return ids;
}

function sendJson(res, body, status = 200, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
}

function serveStatic(pathname, res) {
  const baseDir = fs.existsSync(distDir) ? distDir : publicDir;
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const targetPath = path.resolve(baseDir, `.${decodeURIComponent(cleanPath)}`);

  if (targetPath !== baseDir && !targetPath.startsWith(baseDir + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const candidate = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()
    ? path.join(targetPath, 'index.html') : targetPath;
  const found = fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  const filePath = found ? candidate : path.join(baseDir, '404.html');

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }

  res.writeHead(found ? 200 : 404, {
    'Content-Type': contentType(filePath),
    'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=3600',
  });
  fs.createReadStream(filePath).pipe(res);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.xml': return 'application/xml; charset=utf-8';
    case '.txt': return 'text/plain; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}
