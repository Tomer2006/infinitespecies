/**
 * Search functionality and result management module
 *
 * Handles taxonomy tree searching, result filtering, and UI management.
 * Provides fuzzy search capabilities, result highlighting, and navigation
 * to search results with visual feedback (pulsing animations).
 */

import { state } from './state.js';
import { worldToScreen } from './canvas.js';
import { updateNavigation } from './navigation.js';
import { searchResultsEl } from './dom.js';
import { getNodePath } from './deeplink.js';
import { perf } from './settings.js';
import { logWarn } from './logger.js';
import { lookupScientificName, isLikelyCommonName } from './scientific-name-lookup.js';

/**
 * Calculate relevance score for a search match (fast version without path lookup)
 * Higher score = more relevant result
 */
function calculateRelevanceScoreFast(node, query, queryLower) {
  const name = node.name || '';
  const nameLower = name.toLowerCase();
  let score = 0;

  // Exact match (case-insensitive) - highest priority
  if (nameLower === queryLower) {
    score += 1000;
  }
  // Exact match at start of name - very high priority
  else if (nameLower.startsWith(queryLower)) {
    score += 800;
    // Bonus for shorter names (more specific matches)
    score += Math.max(0, 100 - name.length);
  }
  // Query is contained in name
  else if (nameLower.includes(queryLower)) {
    score += 400;
    // Bonus for earlier position in name
    const position = nameLower.indexOf(queryLower);
    score += Math.max(0, 50 - position);
    // Bonus for shorter names
    score += Math.max(0, 50 - name.length / 2);
  }
  // Fuzzy match - check if all query characters appear in order
  else {
    let queryIdx = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    
    for (let i = 0; i < nameLower.length && queryIdx < queryLower.length; i++) {
      if (nameLower[i] === queryLower[queryIdx]) {
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
        queryIdx++;
      } else {
        consecutiveMatches = 0;
      }
    }
    
    // If all query characters found in order, give partial score
    if (queryIdx === queryLower.length) {
      score += 200;
      // Bonus based on how close together the matches are
      score += maxConsecutive * 10;
      // Penalty for longer names
      score -= Math.max(0, name.length - queryLower.length * 2);
    }
  }

  // Prefer nodes with fewer children (more specific)
  const childCount = node.children?.length || 0;
  if (childCount === 0) {
    score += 30; // Leaf nodes get bonus
  } else if (childCount < 10) {
    score += 20; // Nodes with few children get bonus
  }

  // Prefer nodes at moderate depth (not too shallow, not too deep)
  const level = node.level || 0;
  if (level >= 2 && level <= 8) {
    score += 10;
  }

  return score;
}

/**
 * Add path-based scoring to an existing score (expensive operation, use sparingly)
 */
function addPathScore(node, queryLower, baseScore) {
  try {
    const parts = getNodePath(node);
    const fullPath = parts.join(' / ').toLowerCase();
    
    if (fullPath.includes(queryLower)) {
      baseScore += 100; // Bonus for path match
      // Extra bonus if query matches in parent path
      const parentPath = parts.slice(0, -1).join(' / ').toLowerCase();
      if (parentPath.includes(queryLower)) {
        baseScore += 50;
      }
    }
  } catch (_e) {
    // Ignore path errors
  }
  return baseScore;
}

/**
 * Check if a node matches the search query (fast version without path lookup)
 * Returns the relevance score, or 0 if no match
 */
function matchesQueryFast(node, query, queryLower) {
  const name = node.name || '';
  const nameLower = name.toLowerCase();
  
  // Direct substring match
  if (nameLower.includes(queryLower)) {
    return calculateRelevanceScoreFast(node, query, queryLower);
  }
  
  // Fuzzy match - check if all query characters appear in order
  let queryIdx = 0;
  for (let i = 0; i < nameLower.length && queryIdx < queryLower.length; i++) {
    if (nameLower[i] === queryLower[queryIdx]) {
      queryIdx++;
    }
  }
  
  // If all characters found in order, it's a fuzzy match
  if (queryIdx === queryLower.length) {
    return calculateRelevanceScoreFast(node, query, queryLower);
  }
  
  return 0; // No match (don't check path during initial search - too expensive)
}

export function findAllByQuery(q, limit = perf.search.maxResults) {
  if (!q) return [];
  q = q.trim();
  if (!q || !state.layout?.root) return [];
  
  const queryLower = q.toLowerCase();
  const scoredResults = [];
  const stack = [state.layout.root];
  const maxCandidates = Math.min(limit * 3, 500); // Collect more candidates than needed for path scoring
  
  // Phase 1: Fast search - collect candidates without expensive path lookups
  while (stack.length && scoredResults.length < maxCandidates) {
    const d = stack.pop();
    if (!d?.data) continue;
    
    const score = matchesQueryFast(d.data, q, queryLower);
    if (score > 0) {
      scoredResults.push({ node: d.data, score });
    }
    
    const ch = d.children || [];
    for (let i = 0; i < ch.length; i++) {
      stack.push(ch[i]);
    }
  }
  
  // If we have exact matches (score >= 1000), prioritize those and skip path scoring
  const exactMatches = scoredResults.filter(r => r.score >= 1000);
  if (exactMatches.length > 0) {
    // Sort exact matches and return top results
    exactMatches.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.node.name || '').localeCompare(b.node.name || '');
    });
    
    // If we have enough exact matches, return them
    if (exactMatches.length >= limit) {
      return exactMatches.slice(0, limit).map(r => r.node);
    }
    
    // Otherwise, add path scores to remaining candidates and combine
    const otherResults = scoredResults.filter(r => r.score < 1000);
    for (let i = 0; i < Math.min(otherResults.length, limit * 2); i++) {
      otherResults[i].score = addPathScore(otherResults[i].node, queryLower, otherResults[i].score);
    }
    
    // Combine and sort
    const allResults = [...exactMatches, ...otherResults];
    allResults.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.node.name || '').localeCompare(b.node.name || '');
    });
    
    return allResults.slice(0, limit).map(r => r.node);
  }
  
  // Phase 2: Add path scores only to top candidates (expensive operation)
  const candidatesToScore = Math.min(scoredResults.length, limit * 2);
  for (let i = 0; i < candidatesToScore; i++) {
    scoredResults[i].score = addPathScore(scoredResults[i].node, queryLower, scoredResults[i].score);
  }
  
  // Sort by score (highest first), then by name for ties
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.node.name || '').localeCompare(b.node.name || '');
  });
  
  // Return top results
  return scoredResults.slice(0, limit).map(r => r.node);
}

export function pulseAtNode(node) {
  if (!node || typeof node._id !== 'number') return;
  const d = state.nodeLayoutMap.get(node._id);
  if (!d) return;
  const [sx, sy] = worldToScreen(d._vx, d._vy);
  const sr = d._vr * state.camera.k;
  if (sr <= perf.search.pulseMinScreenRadius) return;
  const el = document.getElementById('pulse');
  if (!el) return;
  el.style.display = 'block';
  const posMult = perf.search.pulsePositionMultiplier;
  const sizeMult = perf.search.pulseSizeMultiplier;
  el.style.left = sx - sr * posMult + 'px';
  el.style.top = sy - sr * posMult + 'px';
  el.style.width = sr * sizeMult + 'px';
  el.style.height = sr * sizeMult + 'px';
  el.style.boxShadow = `0 0 ${sr * perf.search.pulseShadowOuter}px ${sr * perf.search.pulseShadowInner}px rgba(113,247,197,.3), inset 0 0 ${sr * perf.search.pulseShadowOuter2}px ${sr * perf.search.pulseShadowInner2}px rgba(113,247,197,.25)`;
  el.style.border = `${perf.search.pulseBorderWidth}px solid ${perf.search.pulseColor}`;
  el
    .animate(
      [
        { transform: `scale(${perf.search.pulseScaleStart})`, opacity: 0.0 },
        { transform: 'scale(1)', opacity: perf.search.pulseOpacity, offset: perf.search.pulseScaleOffset },
        { transform: `scale(${perf.search.pulseScaleEnd})`, opacity: 0.0 }
      ],
      { duration: perf.search.pulseDurationMs, easing: 'ease-out' }
    )
    .onfinish = () => {
    el.style.display = 'none';
  };
}

let resultsEventsBound = false;

function hideResults() {
  if (!searchResultsEl) return;
  searchResultsEl.style.display = 'none';
  searchResultsEl.innerHTML = '';
}

/**
 * Highlight matching text in a string
 */
function highlightMatch(text, query) {
  if (!query) return text;
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const index = textLower.indexOf(queryLower);
  
  if (index === -1) {
    // Try fuzzy highlighting - find characters in order
    const parts = [];
    let lastIdx = 0;
    let queryIdx = 0;
    
    for (let i = 0; i < text.length && queryIdx < query.length; i++) {
      if (textLower[i] === queryLower[queryIdx]) {
        if (i > lastIdx) {
          parts.push(text.slice(lastIdx, i));
        }
        parts.push(`<mark>${text[i]}</mark>`);
        lastIdx = i + 1;
        queryIdx++;
      }
    }
    
    if (queryIdx === query.length && lastIdx < text.length) {
      parts.push(text.slice(lastIdx));
    }
    
    return queryIdx === query.length ? parts.join('') : text;
  }
  
  // Direct match - highlight the substring
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  return `${before}<mark>${match}</mark>${after}`;
}

function renderResults(nodes, q) {
  if (!searchResultsEl) return;
  searchResultsEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  nodes.forEach(n => {
    const item = document.createElement('div');
    item.className = 'item';
    item.setAttribute('role', 'option');
    item.dataset.id = String(n._id);
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.innerHTML = highlightMatch(n.name || '', q);
    item.appendChild(nameEl);

    // Add path context under the name for disambiguation
    try {
      const parts = getNodePath(n);
      const parentPath = parts.slice(0, Math.max(0, parts.length - 1)).join(' / ');
      if (parentPath) {
        const pathEl = document.createElement('div');
        pathEl.className = 'path';
        pathEl.innerHTML = highlightMatch(parentPath, q);
        item.appendChild(pathEl);
      }
    } catch (_e) {
      // best-effort; ignore path errors
    }
    frag.appendChild(item);
  });
  searchResultsEl.appendChild(frag);
  searchResultsEl.style.display = 'block';

  if (!resultsEventsBound) {
    resultsEventsBound = true;
    searchResultsEl.addEventListener('click', e => {
      const target = e.target.closest('.item');
      if (!target) return;
      
      const idStr = target.dataset.id || '';
      const id = Number(idStr);
      
      // Validate ID is a valid number
      if (!idStr || isNaN(id) || id <= 0) {
        logWarn(`Invalid search result ID: "${idStr}"`);
        return;
      }
      
      const d = state.nodeLayoutMap.get(id);
      const node = d?.data;
      
      // Explicitly handle missing node with logging
      if (!node) {
        logWarn(`Search result node not found in layout map (ID: ${id})`);
        return;
      }
      
      updateNavigation(node, false);
      if (state.current) pulseAtNode(state.current);
      // No canvas re-render needed - highlight is now CSS-based
      hideResults();
    });

    document.addEventListener('click', e => {
      const searchbar = document.querySelector('.searchbar');
      if (!searchbar) return;
      if (searchbar.contains(e.target)) return;
      hideResults();
    });
  }
}

/**
 * Process search results and format them (performance-critical)
 * @param {Array} matches - Array of matched nodes
 * @param {string} query - The search query
 * @returns {Array} Formatted search results
 */
export function processSearchResults(matches, query) {
  return matches.map(n => {
    let path = '';
    try {
      const parts = getNodePath(n);
      path = parts.slice(0, -1).join(' / ');
    } catch (_e) {
      // best-effort; ignore path errors
    }
    return {
      _id: n._id,
      name: n.name,
      path,
      node: n,
    };
  });
}

export async function handleSearch(progressLabelEl) {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  let q = searchInput.value;
  let matches = findAllByQuery(q, perf.search.maxResults);
  
  // If it looks like a common name, OR if no results were found, try to look up scientific name
  const shouldLookupScientificName = isLikelyCommonName(q) || matches.length === 0;
  
  if (shouldLookupScientificName) {
    if (progressLabelEl) {
      progressLabelEl.textContent = 'Looking up scientific name...';
      progressLabelEl.style.color = '';
    }
    
    try {
      const scientificName = await lookupScientificName(q);
      
      if (scientificName) {
        console.log(`Looking up scientific name for "${q}": found "${scientificName}"`);
        if (progressLabelEl) {
          progressLabelEl.textContent = `Found: ${scientificName}`;
          progressLabelEl.style.color = '';
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
        console.log(`No scientific name found for "${q}"`);
      }
    } catch (error) {
      console.warn('Failed to lookup scientific name:', error);
    }
  }
  
  if (!matches.length) {
    if (progressLabelEl) {
      progressLabelEl.textContent = `No match for "${q}"`;
      progressLabelEl.style.color = 'var(--warn)';
      setTimeout(() => {
        progressLabelEl.textContent = '';
        progressLabelEl.style.color = '';
      }, perf.search.noMatchDisplayMs);
    }
    hideResults();
    return;
  }
  if (matches.length === 1) {
    const node = matches[0];
    updateNavigation(node, false);
    if (state.current) pulseAtNode(state.current);
    // No canvas re-render needed - highlight is now CSS-based
    hideResults();
  } else {
    renderResults(matches, q);
  }
}

