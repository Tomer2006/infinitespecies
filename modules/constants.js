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

// Original Tableau 10 palette. We intentionally don't fix the domain so
// the scale will assign colors in order and loop when the range is exceeded.
export const TABLEAU10 = [
  '#4E79A7', // Blue
  '#F28E2B', // Orange
  '#E15759', // Red
  '#76B7B2', // Teal
  '#59A14F', // Green
  '#EDC948', // Yellow
  '#B07AA1', // Purple
  '#FF9DA7', // Pink
  '#9C755F', // Brown
  '#BAB0AC'  // Gray
];

export const PALETTE = d3.scaleOrdinal(TABLEAU10);

export const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100
};


