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

// Tableau 10 (Original) categorical palette, ordered per request:
// Blue → Orange → Red → Teal → Green → Yellow → Purple → Pink → Brown → Gray
export const PALETTE = d3
  .scaleOrdinal()
  .domain(LEVELS)
  .range([
    '#4E79A7', // Blue
    '#F28E2B', // Orange
    '#E15759', // Red
    '#76B7B2', // Teal
    '#59A14F', // Green
    '#EDC948', // Yellow
    '#B07AA1', // Purple
    '#FF9DA7', // Pink (Rose)
    '#9C755F', // Brown
    '#BAB0AC'  // Gray (cycles if more levels)
  ]);

export const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100
};


