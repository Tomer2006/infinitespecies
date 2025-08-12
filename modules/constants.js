// Constants and tunables

export const LEVELS = [
  'Life',
  'Domain',
  'Kingdom',
  'Phylum',
  'Class',
  'Order',
  'Family',
  'Genus',
  'Species'
];

// Original Tableau 10 colors in specified order with infinite looping
const TABLEAU_10_COLORS = [
  '#1f77b4', // Blue
  '#ff7f0e', // Orange
  '#d62728', // Red
  '#17becf', // Teal
  '#2ca02c', // Green
  '#ffff00', // Yellow (using pure yellow as requested)
  '#9467bd', // Purple
  '#e377c2', // Pink
  '#8c564b', // Brown
  '#7f7f7f'  // Gray
];

// Custom palette function that loops through Tableau colors infinitely based on level depth
export const PALETTE = function(level) {
  // Find level index, default to 0 if not found
  let levelIndex = LEVELS.indexOf(level);
  if (levelIndex === -1) {
    // For unknown levels, hash the level name to get consistent color
    levelIndex = level.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  }
  
  // Loop through Tableau colors
  return TABLEAU_10_COLORS[levelIndex % TABLEAU_10_COLORS.length];
};

export const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100
};
