// Constants and tunables

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

export const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100,
  // Performance knobs
  strokeMinPxRadius: 12,      // skip stroking tiny circles
  maxLabels: 300,             // cap labels per frame
  labelGridCellPx: 24,        // spatial bin for label overlap checks
  // Layout value damping (1.0 = original; 0.6–0.8 smooths size differences)
  valueExponent: 0.7
};


