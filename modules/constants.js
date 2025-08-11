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

// Original Tableau 10 palette in requested order:
// Blue, Orange, Red, Teal, Green, Yellow, Purple, Pink, Brown, Gray
export const TABLEAU10 = [
  '#4e79a7', // Blue
  '#f28e2b', // Orange
  '#e15759', // Red
  '#76b7b2', // Teal
  '#59a14f', // Green
  '#edc948', // Yellow
  '#b07aa1', // Purple
  '#ff9da7', // Pink
  '#9c755f', // Brown
  '#bab0ac'  // Gray
];

// Keep a name-based palette for any legacy usage
export const PALETTE = d3.scaleOrdinal().domain(LEVELS).range(TABLEAU10);

export function getLevelColorByDepth(depth) {
  const idx = Math.max(0, depth | 0) % TABLEAU10.length;
  return TABLEAU10[idx];
}

export const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100
};


