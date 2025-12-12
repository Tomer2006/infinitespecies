/**
 * Data loading API module
 *
 * Unified interface for all data loading functionality. Re-exports functions
 * from specialized modules (eager, lazy, common) to maintain backward
 * compatibility while keeping the codebase modular.
 */

// Common/shared functions
export { mapToChildren, normalizeTree, indexTreeProgressive, loadFromJSONText, setDataRoot } from './data-common.js';

// Eager loading functions
export { loadEager } from './data-eager.js';


