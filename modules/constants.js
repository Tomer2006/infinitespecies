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

// High-contrast, colorblind-friendly palette (optimized for dark background)
// Derived from ColorBrewer/Tableau tones
export const PALETTE = d3
  .scaleOrdinal()
  .domain(LEVELS)
  .range([
    '#e41a1c', // red
    '#377eb8', // blue
    '#4daf4a', // green
    '#984ea3', // purple
    '#ff7f00', // orange
    '#ffff33', // yellow
    '#a65628', // brown
    '#f781bf', // pink
    '#17becf'  // cyan
  ]);

export const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100
};


