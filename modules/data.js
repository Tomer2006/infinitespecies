// Re-export all data loading functions from separate modules
// This maintains backward compatibility while splitting the code

// Common/shared functions
export { mapToChildren, normalizeTree, indexTreeProgressive, loadFromJSONText, setDataRoot } from './data-common.js';

// Eager loading functions
export { loadEager } from './data-eager.js';

// Lazy loading functions - viewport-based automatic loading
export { isStubNode, loadLazy, loadChunk, autoLoadVisibleChunks, onViewportChange, startAutoLoading } from './data-lazy.js';


