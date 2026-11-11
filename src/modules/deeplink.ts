/**
 * Deep linking and URL navigation module
 *
 * Handles browser URL hash-based navigation for bookmarkable taxonomy paths.
 * Encodes/decodes node paths to/from URL fragments and navigates to specific
 * nodes when URLs contain deep links.
 */

import { state } from './state';
import { logWarn, logDebug } from './logger';
import type { TaxonomyNode } from './types'
import { resolveNamePath } from './taxon-path.js'

export function getNodePath(node: TaxonomyNode): string[] {
  const names: string[] = [];
  let p: TaxonomyNode | null = node;
  while (p) {
    names.unshift(String(p.name));
    p = p.parent;
  }
  return names;
}

function encodePath(pathStr: string) {
  return encodeURIComponent(pathStr);
}

export function decodePath(hash: string) {
  try {
    return decodeURIComponent(hash || '');
  } catch (_e) {
    return hash || '';
  }
}

export function updateDeepLinkFromNode(node: TaxonomyNode) {
  const path = getNodePath(node).join('/');
  const newHash = path ? `#${encodePath(path)}` : '';
  if (location.hash !== newHash || location.pathname !== '/' || new URL(location.href).searchParams.has('explore')) {
    const url = new URL(location.href);
    url.pathname = '/';
    url.searchParams.delete('explore');
    url.hash = newHash;
    history.replaceState(null, '', url);
  }
}

export async function findNodeByPath(pathStr: string): Promise<TaxonomyNode | null> {
  if (!state.DATA_ROOT) {
    logWarn('findNodeByPath called but DATA_ROOT is not initialized');
    return null;
  }

  const node = resolveNamePath<TaxonomyNode>(pathStr, state.DATA_ROOT, n => String(n.name), n => n.children || []);
  if (!node) logDebug(`Path "${pathStr}" does not match a loaded branch`);
  return node;
}

