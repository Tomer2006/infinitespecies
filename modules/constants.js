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

export const PALETTE = d3
  .scaleOrdinal()
  .domain(LEVELS)
  .range([
    '#7aa2ff',
    '#6df0c9',
    '#ffc857',
    '#b892ff',
    '#ff8777',
    '#77d1ff',
    '#ffd670',
    '#84fab0',
    '#b8f2e6'
  ]);

export const settings = {
  renderDistance: 1.0,
  minPxRadius: 4,
  labelMinPxRadius: 22,
  labelMinFontPx: 12,
  verticalPadPx: 100,
  // Layout budget to keep FPS high on huge datasets
  maxNodesPerLayout: 5000,
  maxChildrenPerNode: 500
};


