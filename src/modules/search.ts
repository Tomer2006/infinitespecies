/**
 * Search functionality and result management module
 *
 * Handles taxonomy tree searching, result filtering, and UI management.
 * Provides exact, prefix, and substring matching, result highlighting, and navigation
 * to search results with visual feedback (pulsing animations).
 */

import { state } from './state';
import { worldToScreen } from './canvas';
import { getNodePath } from './deeplink';
import { perf } from './settings';
import type { SearchResult, TaxonomyNode } from './types'

interface ScoredNode { node: TaxonomyNode; score: number }

export interface PulsePresentation {
  style: Record<string, string>
  keyframes: Keyframe[]
  timing: KeyframeAnimationOptions
}

/**
 * Calculate relevance score for a search match (fast version without path lookup)
 * Higher score = more relevant result
 */
function calculateRelevanceScoreFast(node: TaxonomyNode, queryLower: string) {
  const name = node.name || '';
  const nameLower = name.toLowerCase();
  let score = 0;

  // Exact match (case-insensitive) - highest priority
  if (nameLower === queryLower) {
    // Keep exact matches above every possible prefix/path bonus.
    score += 2000;
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

  // No bonus based on child count - groups and leaf nodes are scored equally

  // Prefer nodes at moderate depth (not too shallow, not too deep)
  const level = typeof node.level === 'number' ? node.level : 0;
  if (level >= 2 && level <= 8) {
    score += 10;
  }

  return score;
}

/**
 * Add path-based scoring to an existing score (expensive operation, use sparingly)
 */
function addPathScore(node: TaxonomyNode, queryLower: string, baseScore: number) {
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
function matchesQueryFast(node: TaxonomyNode, queryLower: string) {
  const name = node.name || '';
  const nameLower = name.toLowerCase();
  
  return nameLower.includes(queryLower)
    ? calculateRelevanceScoreFast(node, queryLower)
    : 0;
}

export function findAllByQuery(q: string, limit = perf.search.maxResults): TaxonomyNode[] {
  limit = Math.max(0, Math.floor(limit));
  if (!limit) return [];
  if (!q) return [];
  q = q.trim();
  if (!q || !state.layout?.root) return [];
  
  const queryLower = q.toLowerCase();
  const scoredResults: ScoredNode[] = [];
  const stack: TaxonomyNode[] = [state.layout.root];
  const maxCandidates = Math.min(limit * 3, 500); // Collect more candidates than needed for path scoring
  
  // Scan the whole tree, retaining only the strongest candidates. Stopping after
  // the first batch of substring matches can miss an exact match later on.
  const compare = (a: ScoredNode, b: ScoredNode) => b.score - a.score || a.node.name.localeCompare(b.node.name) || a.node._id - b.node._id;
  while (stack.length) {
    const d = stack.pop();
    if (!d) continue;

    const score = matchesQueryFast(d, queryLower);
    if (score > 0) {
      const candidate = { node: d, score };
      if (scoredResults.length < maxCandidates || compare(candidate, scoredResults[scoredResults.length - 1]) < 0) {
        scoredResults.push(candidate);
        scoredResults.sort(compare);
        if (scoredResults.length > maxCandidates) scoredResults.pop();
      }
    }
    
    const ch = d.children || [];
    for (let i = 0; i < ch.length; i++) {
      stack.push(ch[i]);
    }
  }
  
  // If we have exact matches (score >= 1000), prioritize those and skip path scoring
  const exactMatches = scoredResults.filter(r => r.score >= 2000);
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
    const otherResults = scoredResults.filter(r => r.score < 2000);
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

export function getPulsePresentation(node: TaxonomyNode): PulsePresentation | null {
  if (!node || typeof node._id !== 'number') return null;
  const d = state.nodeLayoutMap.get(node._id);
  if (!d) return null;
  const [sx, sy] = worldToScreen(d._vx, d._vy);
  const sr = d._vr * state.camera.k;
  if (sr <= perf.search.pulseMinScreenRadius) return null;
  const posMult = perf.search.pulsePositionMultiplier;
  const sizeMult = perf.search.pulseSizeMultiplier;
  return {
    style: {
      display: 'block',
      left: `${sx - sr * posMult}px`,
      top: `${sy - sr * posMult}px`,
      width: `${sr * sizeMult}px`,
      height: `${sr * sizeMult}px`,
      boxShadow: `0 0 ${sr * perf.search.pulseShadowOuter}px ${sr * perf.search.pulseShadowInner}px rgba(113,247,197,.3), inset 0 0 ${sr * perf.search.pulseShadowOuter2}px ${sr * perf.search.pulseShadowInner2}px rgba(113,247,197,.25)`,
      border: `${perf.search.pulseBorderWidth}px solid ${perf.search.pulseColor}`,
    },
    keyframes: [
        { transform: `scale(${perf.search.pulseScaleStart})`, opacity: 0.0 },
        { transform: 'scale(1)', opacity: perf.search.pulseOpacity, offset: perf.search.pulseScaleOffset },
        { transform: `scale(${perf.search.pulseScaleEnd})`, opacity: 0.0 }
    ],
    timing: { duration: perf.search.pulseDurationMs, easing: 'ease-out' },
  }
}

/**
 * Process search results and format them (performance-critical)
 * @param {Array} matches - Array of matched nodes
 * @param {string} query - The search query
 * @returns {Array} Formatted search results
 */
export function processSearchResults(matches: TaxonomyNode[], _query: string): SearchResult[] {
  return matches.map(n => {
    let path = '';
    if (n._searchPath) {
      const parts = String(n._searchPath).split(' / ');
      path = parts.slice(0, -1).join(' / ');
    } else {
      try {
        const parts = getNodePath(n);
        path = parts.slice(0, -1).join(' / ');
      } catch (_e) {
        // best-effort; ignore path errors
      }
    }
    return {
      _id: n._id,
      name: n.name,
      path,
      node: n,
    };
  });
}
