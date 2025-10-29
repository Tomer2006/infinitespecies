// Re-export all data loading functions from separate modules
// This maintains backward compatibility while splitting the code

// Common/shared functions (from data-lazy.js)
export { mapToChildren, normalizeTree, indexTreeProgressive, loadFromJSONText, setDataRoot } from './data-lazy.js';

// Eager loading functions
export { loadEager, loadFromUrl } from './data-eager.js';

// Lazy loading functions
export { isStubNode, loadLazy, loadChunk, findChunkForPath, getNodePath, loadNodeData } from './data-lazy.js';


