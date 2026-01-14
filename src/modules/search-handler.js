/**
 * Search handler module (vanilla JS)
 * 
 * Handles all search logic including scientific name lookup and result processing.
 * React components should only call these functions and update UI state.
 */

import { findAllByQuery, pulseAtNode } from './search.js';
import { updateNavigation, zoomToNode } from './navigation.js';
import { lookupScientificName, isLikelyCommonName } from './scientific-name-lookup.js';
import { processSearchResults } from './search.js';
import { perf } from './settings.js';

/**
 * Perform search with scientific name lookup
 * @param {string} query - The search query
 * @param {Function} onToast - Callback to show toast messages (message, type, duration)
 * @returns {Promise<{matches: Array, hasResults: boolean, singleResult: boolean}>}
 */
export async function performSearch(query, onToast) {
  if (!query || !query.trim()) {
    return { matches: [], hasResults: false, singleResult: false };
  }

  const trimmedQuery = query.trim();
  
  if (onToast) {
    onToast('Searching...', 'info', 1000);
  }

  let matches = findAllByQuery(trimmedQuery, perf.search.maxResults);
  
  // If it looks like a common name, OR if no results were found, try to look up scientific name
  const shouldLookupScientificName = isLikelyCommonName(trimmedQuery) || matches.length === 0;
  
  if (shouldLookupScientificName) {
    if (onToast) {
      onToast('Looking up scientific name...', 'info', 2000);
    }
    
    try {
      const scientificName = await lookupScientificName(trimmedQuery);
      
      if (scientificName) {
        console.log(`Looking up scientific name for "${trimmedQuery}": found "${scientificName}"`);
        if (onToast) {
          onToast(`Found scientific name: ${scientificName}`, 'info', 2000);
        }
        
        // Search with the scientific name
        let scientificMatches = findAllByQuery(scientificName, perf.search.maxResults);
        console.log(`Search results for "${scientificName}": ${scientificMatches.length} matches`);
        
        // If no results with full scientific name, try variations
        if (scientificMatches.length === 0) {
          // Try just genus and species (first two words)
          const parts = scientificName.split(' ');
          if (parts.length >= 2) {
            const genusSpecies = `${parts[0]} ${parts[1]}`;
            console.log(`Trying genus+species: "${genusSpecies}"`);
            scientificMatches = findAllByQuery(genusSpecies, perf.search.maxResults);
            console.log(`Search results for "${genusSpecies}": ${scientificMatches.length} matches`);
          }
          
          // If still no results, try just the genus (first word)
          if (scientificMatches.length === 0) {
            const genus = scientificName.split(' ')[0];
            if (genus && genus.length > 2) {
              console.log(`Trying genus only: "${genus}"`);
              scientificMatches = findAllByQuery(genus, perf.search.maxResults);
              console.log(`Search results for "${genus}": ${scientificMatches.length} matches`);
            }
          }
        }
        
        // Merge results, prioritizing scientific name matches at the top
        // Remove duplicates by node ID, keeping scientific matches
        const scientificIds = new Set(scientificMatches.map(n => n._id));
        const originalMatchesWithoutDupes = matches.filter(n => !scientificIds.has(n._id));
        
        // Put scientific name matches first, then original matches
        matches = [...scientificMatches, ...originalMatchesWithoutDupes];
        
        console.log(`Total matches after merging: ${matches.length} (${scientificMatches.length} scientific, ${originalMatchesWithoutDupes.length} original)`);
        
        // Limit to max results
        matches = matches.slice(0, perf.search.maxResults);
      } else {
        console.log(`No scientific name found for "${trimmedQuery}"`);
      }
    } catch (error) {
      console.warn('Failed to lookup scientific name:', error);
    }
  }
  
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
