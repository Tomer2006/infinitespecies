// Re-export all data loading functions from separate modules
// This maintains backward compatibility while splitting the code

// Common/shared functions (from data-lazy.js)
export { mapToChildren, normalizeTree, indexTreeProgressive, loadFromJSONText, setDataRoot } from './data-lazy.js';

// Eager loading functions
export { loadEager } from './data-eager.js';

// Lazy loading functions - viewport-based automatic loading
export { isStubNode, loadLazy, loadChunk, getNodePath, autoLoadVisibleChunks, onViewportChange, startAutoLoading } from './data-lazy.js';


