import { state, rebuildNodeMap, setTaxonomyData } from './state';
import { setProgress } from './loading';
import { updateNavigation } from './navigation';
import { decodePath } from './deeplink';
import { logInfo } from './logger';
import { W, H, onCameraChange, requestRender } from './canvas';
import { perf } from './settings';
import type { TaxonomyNode } from './types'

interface ServerNode {
  id: number
  parent_id: number | null
  name: string
  level: number | string
  x: number
  y: number
  r: number
  leaves?: number
  has_children?: boolean
  path?: string
}

interface BackendResponse {
  nodes?: ServerNode[]
  matches?: ServerNode[]
  root_id?: number
  requested_id?: number
  expanded_ids?: number[]
  depth?: number
}

interface ViewportOptions { force?: boolean; immediate?: boolean }

const API_BASE = (process.env.NEXT_PUBLIC_DATA_API_URL || '/api').replace(/\/$/, '');
const nodeCache = new Map<number, TaxonomyNode>();
const hydratedNodeIds = new Set<number>();
const nodeLoadPromises = new Map<number, Promise<TaxonomyNode | null>>();
const VIEWPORT_PAD_PX = 120;
const VIEWPORT_LIMIT = 12000;
const VIEWPORT_DEBOUNCE_MS = 160;
let viewportTimer: ReturnType<typeof setTimeout> | null = null;
let viewportLoadingRegistered = false;
let lastViewportKey = '';
let inFlightViewportKey = '';

export async function loadBackend(apiBase = API_BASE): Promise<TaxonomyNode> {
  state.loadMode = 'backend';
  state.backendApiBase = apiBase.replace(/\/$/, '');
  setProgress(0.15, 'Loading taxonomy root from backend...', 1, 1);

  const response = await fetchJson<BackendResponse>(`${state.backendApiBase}/tree/root?depth=0`);
  stitchResponse(response);

  const root = response.root_id == null ? null : nodeCache.get(response.root_id);
  if (!root) throw new Error('Backend did not return a root node');

  state.useBakedLayout = true;
  refreshBackendLayout(root);

  const rawHash = location.hash ? location.hash.slice(1) : '';
  const decoded = decodePath(rawHash);
  if (decoded) {
    const node = await findBackendNodeByPath(decoded);
    if (node) {
      await updateNavigation(node, false);
    } else {
      await updateNavigation(root, false);
    }
  } else {
    await updateNavigation(root, false);
  }

  registerViewportLoader();

  setProgress(1, 'Preparing map…', 1, 1);
  logInfo(`Backend taxonomy loaded with ${nodeCache.size.toLocaleString()} cached nodes`);
  return root;
}

export async function ensureBackendViewport(options: ViewportOptions = {}): Promise<BackendResponse | null> {
  if (state.loadMode !== 'backend') return null;
  if (!(W > 0) || !(H > 0)) return null;

  const key = viewportKey();
  if (!options.force && (key === lastViewportKey || key === inFlightViewportKey)) {
    return null;
  }

  inFlightViewportKey = key;
  const params = new URLSearchParams({
    x: String(state.camera.x),
    y: String(state.camera.y),
    k: String(state.camera.k),
    w: String(W),
    h: String(H),
    minPxRadius: String(perf.rendering.minPxRadius),
    padPx: String(VIEWPORT_PAD_PX),
    limit: String(VIEWPORT_LIMIT),
    currentId: String(state.current?._id || state.DATA_ROOT?._id || 1),
  });

  try {
    const response = await fetchJson<BackendResponse>(`${state.backendApiBase}/tree/viewport?${params}`);
    stitchResponse(response);
    refreshBackendLayout();
    requestRender();
    lastViewportKey = key;
    return response;
  } finally {
    if (inFlightViewportKey === key) inFlightViewportKey = '';
  }
}

function scheduleBackendViewportLoad(options: ViewportOptions = {}) {
  if (state.loadMode !== 'backend') return;
  if (viewportTimer) {
    clearTimeout(viewportTimer);
    viewportTimer = null;
  }

  if (options.immediate) {
    void ensureBackendViewport({ force: options.force }).catch(error => console.warn('Viewport loading failed:', error));
    return;
  }

  viewportTimer = setTimeout(() => {
    viewportTimer = null;
    void ensureBackendViewport({ force: options.force }).catch(error => console.warn('Viewport loading failed:', error));
  }, VIEWPORT_DEBOUNCE_MS);
}

export async function loadBackendNodeById(id: number): Promise<TaxonomyNode | null> {
  if (state.loadMode !== 'backend') return null;
  if (hydratedNodeIds.has(id)) return nodeCache.get(id) || null;
  const existingPromise = nodeLoadPromises.get(id)
  if (existingPromise) return existingPromise;

  const loadPromise = fetchJson<BackendResponse>(`${state.backendApiBase}/tree/node/${id}?depth=0`)
    .then(response => {
      stitchResponse(response);
      refreshBackendLayout();
      hydratedNodeIds.add(id);
      return nodeCache.get(id) || null;
    })
    .finally(() => nodeLoadPromises.delete(id));

  nodeLoadPromises.set(id, loadPromise);
  return loadPromise;
}

export function prefetchBackendNodeById(id: number): Promise<TaxonomyNode | null> {
  if (state.loadMode !== 'backend' || hydratedNodeIds.has(id)) return Promise.resolve(nodeCache.get(id) || null);
  return loadBackendNodeById(id);
}

export async function randomBackendNode(fromId?: number): Promise<TaxonomyNode | null> {
  if (state.loadMode !== 'backend') return null;
  const params = new URLSearchParams({ depth: '0' });
  if (fromId != null) params.set('from', String(fromId));
  const response = await fetchJson<BackendResponse>(`${state.backendApiBase}/random?${params}`);
  stitchResponse(response);
  refreshBackendLayout();
  return response.requested_id == null ? null : nodeCache.get(response.requested_id) || null;
}

export async function findBackendNodeByPath(path: string): Promise<TaxonomyNode | null> {
  if (state.loadMode !== 'backend') return null;
  const httpResponse = await fetch(`${state.backendApiBase}/tree/path?path=${encodeURIComponent(path)}&depth=0`, { signal: AbortSignal.timeout(perf.loading.fetchTimeoutMs) });
  if (httpResponse.status === 404) return null;
  if (!httpResponse.ok) throw new Error(`Path lookup failed: ${httpResponse.status}`);
  const response = await httpResponse.json() as BackendResponse;
  stitchResponse(response);
  refreshBackendLayout();
  return response.requested_id == null ? null : nodeCache.get(response.requested_id) || null;
}

export async function searchBackendNodes(query: string, limit: number, signal?: AbortSignal): Promise<TaxonomyNode[]> {
  if (state.loadMode !== 'backend') return [];
  const response = await fetchJson<BackendResponse>(
    `${state.backendApiBase}/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { signal, cache: 'default' },
  );
  return (response.matches || []).map(match => {
    const cached = getOrCreateNode(match);
    cached._searchPath = match.path || '';
    cached._hasChildren = match.has_children;
    cached._leaves = match.leaves || 1;
    return cached;
  });
}

function stitchResponse(response: BackendResponse) {
  const serverNodes = response.nodes || [];
  for (const serverNode of serverNodes) {
    getOrCreateNode(serverNode);
  }

  const childIdsByParent = new Map<number, number[]>();
  for (const serverNode of serverNodes) {
    if (serverNode.parent_id == null) continue;
    const childIds = childIdsByParent.get(serverNode.parent_id) ?? []
    childIds.push(serverNode.id)
    childIdsByParent.set(serverNode.parent_id, childIds)
  }

  // Note: check `.length`, not just presence — buildNodeResponse always sends an
  // `expanded_ids` array, and an empty one (e.g. a depth=0 node/random/path response)
  // is still truthy. Falling through to the else branch below append-wires the node's
  // ancestor path so the node is reachable from the root (required for zoomToNode).
  if (response.expanded_ids && response.expanded_ids.length) {
    for (const parentId of response.expanded_ids || []) {
      const parent = nodeCache.get(parentId);
      if (!parent) continue;

      const children = (childIdsByParent.get(parentId) || [])
        .map(childId => nodeCache.get(childId))
        .filter((child): child is TaxonomyNode => child !== undefined);

      parent.children = children;
      for (const child of children) child.parent = parent;
    }
  } else {
    for (const [parentId, childIds] of childIdsByParent) {
      const parent = nodeCache.get(parentId);
      if (!parent) continue;
      for (const childId of childIds) {
        const child = nodeCache.get(childId);
        if (!child) continue;
        child.parent = parent;
        if (!parent.children.some(existing => existing._id === child._id)) {
          parent.children.push(child);
        }
      }
    }
  }

  for (const parentId of response.expanded_ids || []) {
    const parent = nodeCache.get(parentId);
    if (!parent) continue;
    parent._loadedDepth = Math.max(parent._loadedDepth || 0, response.depth || 0);
  }

  if (response.root_id && !state.DATA_ROOT) {
    state.DATA_ROOT = nodeCache.get(response.root_id) || null;
  }
}

function registerViewportLoader() {
  if (viewportLoadingRegistered) return;
  viewportLoadingRegistered = true;
  onCameraChange(() => scheduleBackendViewportLoad());
}

export async function loadChildGroups(node: TaxonomyNode, offset = 0, signal?: AbortSignal): Promise<{ nodes: TaxonomyNode[]; total: number }> {
  if (state.loadMode !== 'backend') return { nodes: node.children.slice(offset, offset + 50), total: node.children.length };
  const response = await fetchJson<BackendResponse & { child_ids: number[]; total: number }>(
    `${state.backendApiBase}/tree/children/${node._id}?offset=${offset}`, { signal });
  stitchResponse(response);
  refreshBackendLayout();
  return { nodes: response.child_ids.map(id => nodeCache.get(id)).filter((item): item is TaxonomyNode => !!item), total: response.total };
}

function viewportKey() {
  const bucketWorld = 32 / Math.max(state.camera.k, 0.0001);
  return [
    Math.round(state.camera.x / bucketWorld),
    Math.round(state.camera.y / bucketWorld),
    Math.round(Math.log2(state.camera.k) * 8),
    W,
    H,
    perf.rendering.minPxRadius,
    state.current?._id || state.DATA_ROOT?._id || 1,
  ].join('|');
}

function getOrCreateNode(serverNode: ServerNode): TaxonomyNode {
  let node = nodeCache.get(serverNode.id);
  if (!node) {
    node = {
      _id: serverNode.id,
      name: serverNode.name,
      level: serverNode.level,
      _vx: serverNode.x,
      _vy: serverNode.y,
      _vr: serverNode.r,
      _leaves: serverNode.leaves || 1,
      children: [],
      parent: null,
      _loadedDepth: 0,
    };
    nodeCache.set(serverNode.id, node);
  }

  node.name = serverNode.name;
  node.level = serverNode.level;
  node._id = serverNode.id;
  node._vx = serverNode.x;
  node._vy = serverNode.y;
  node._vr = serverNode.r;
  node._leaves = serverNode.leaves || 1;
  node._hasChildren = Boolean(serverNode.has_children);

  const parent = serverNode.parent_id == null ? null : nodeCache.get(serverNode.parent_id);
  if (parent) node.parent = parent;

  return node;
}

function refreshBackendLayout(rootOverride?: TaxonomyNode) {
  const root = rootOverride ?? state.DATA_ROOT;
  if (!root) return;

  // Render/pick directly on the data nodes — no wrapper tree needed.
  const layout = {
    root,
    diameter: 4000,
  };
  setTaxonomyData(root, layout, 'backend')
  rebuildNodeMap();
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(perf.loading.fetchTimeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(url, { cache: 'no-store', ...options, signal });
  if (!response.ok) throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}
