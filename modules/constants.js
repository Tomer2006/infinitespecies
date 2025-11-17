/**
 * Color constants and node styling utilities
 *
 * Provides color palette definitions and functions for determining node colors
 * based on taxonomic level and other node properties. Contains styling constants
 * that are not performance-related (performance settings are in settings.js).
 */

import { perf } from './settings.js';

// Function to get color based on node level
export function getNodeColor(node) {
  // Add null check for node parameter
  if (!node || typeof node !== 'object') {
    return perf.colors.palette[0]; // Default to first color
  }
  // Use numeric level directly, default to 0 if not set
  const level = typeof node.level === 'number' ? node.level : 0;
  return perf.colors.palette[level % perf.colors.palette.length];
}


