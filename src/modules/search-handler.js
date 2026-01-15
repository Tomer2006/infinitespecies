/**
 * Search handler module (vanilla JS)
 * 
 * Handles all search logic including scientific name lookup and result processing.
 * React components should only call these functions and update UI state.
 */

import { findAllByQuery, pulseAtNode } from './search.js';
import { updateNavigation, zoomToNode } from './navigation.js';
import { processSearchResults } from './search.js';
import { perf } from './settings.js';

/**
 * Perform search
 * @param {string} query - The search query
 * @param {Function} onToast - Callback to show toast messages (message, type, duration)
 * @returns {Promise<{matches: Array, hasResults: boolean, singleResult: boolean}>}
 */
export async function performSearch(query, onToast) {
  if (!query || !query.trim()) {
    return { matches: [], hasResults: false, singleResult: false };
  }

  const trimmedQuery = query.trim();
  let matches = findAllByQuery(trimmedQuery, perf.search.maxResults);
  
  return {
    matches,
    hasResults: matches.length > 0,
    singleResult: matches.length === 1,
  };
}

/**
 * Handle single search result - navigate to it
 * @param {Object} node - The node to navigate to
 * @param {Function} onUpdateBreadcrumbs - Callback to update breadcrumbs
 */
export function handleSingleSearchResult(node, onUpdateBreadcrumbs) {
  updateNavigation(node, false);
  pulseAtNode(node);
  if (onUpdateBreadcrumbs) {
    onUpdateBreadcrumbs(node);
  }
}

/**
 * Handle search result click - zoom to node without changing navigation
 * @param {Object} node - The node to zoom to
 */
export function handleSearchResultClick(node) {
  zoomToNode(node);
  pulseAtNode(node);
}
