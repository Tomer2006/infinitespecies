// Constants and tunables
import { getRenderingConfig } from './optimization.js';

// Removed hardcoded level names - now using numeric indices directly

// Original Tableau 10 color palette - level-based assignment
// Colors cycle based on node level (0=Blue, 1=Orange, 2=Red, etc.)
export const TABLEAU_COLORS = [
  '#1f77b4', // Blue
  '#ff7f0e', // Orange
  '#d62728', // Red
  '#2ca02c', // Green (Teal-ish)
  '#17becf', // Teal
  '#bcbd22', // Yellow
  '#9467bd', // Purple
  '#e377c2', // Pink
  '#8c564b', // Brown
  '#7f7f7f'  // Gray
];

// Function to get color based on node level
export function getNodeColor(node) {
  // Use numeric level directly, default to 0 if not set
  const level = typeof node.level === 'number' ? node.level : 0;
  return TABLEAU_COLORS[level % TABLEAU_COLORS.length];
}

// Legacy settings export - now uses centralized optimization config
export const settings = getRenderingConfig();

// Additional layout constants
export const LAYOUT = {
  verticalPadPx: 100,
};


