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

// Original Tableau 10 color palette - assigned by hierarchy level
export const TABLEAU_10 = [
  '#4e79a7', // Blue (level 0)
  '#f28e2c', // Orange (level 1)
  '#e15759', // Red (level 2)
  '#76b7b2', // Teal (level 3)
  '#59a14f', // Green (level 4)
  '#edc949', // Yellow (level 5)
  '#af7aa1', // Purple (level 6)
  '#ff9d9a', // Pink (level 7)
  '#9c755f', // Brown (level 8)
  '#bab0ab'  // Gray (level 9, then loops back to Blue)
];

// Function to get color based on node level (loops through palette)
export function getColorForLevel(level) {
  return TABLEAU_10[level % TABLEAU_10.length];
}

// Keep PALETTE for backward compatibility but use level-based coloring
export const PALETTE = TABLEAU_10;

export const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100
};


