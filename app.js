// Taxonomy Explorer - Single File Version with Tableau 10 Colors

// Original Tableau 10 colors in specified order
const TABLEAU_10_COLORS = [
  '#1f77b4', // Blue
  '#ff7f0e', // Orange  
  '#d62728', // Red
  '#17becf', // Teal
  '#2ca02c', // Green
  '#ffff00', // Yellow
  '#9467bd', // Purple
  '#e377c2', // Pink
  '#8c564b', // Brown
  '#7f7f7f'  // Gray
];

const LEVELS = [
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

// Color palette function that loops infinitely through Tableau colors
const PALETTE = function(level) {
  let levelIndex = LEVELS.indexOf(level);
  if (levelIndex === -1) {
    // For unknown levels, hash the level name to get consistent color
    levelIndex = level.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  }
  return TABLEAU_10_COLORS[levelIndex % TABLEAU_10_COLORS.length];
};

// Put the rest of your app code here...
console.log('Taxonomy Explorer loaded with Tableau 10 colors');
