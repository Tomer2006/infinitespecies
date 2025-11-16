/*
 * ===================================================================
 * biozoom - Lazy Loading Data Splitter
 * ===================================================================
 *
 * Description:
 * This Node.js script reads a single, massive JSON taxonomy tree
 * (like 'tree_deduped.json') and splits it into a directory
 * structure suitable for lazy loading on the frontend.
 *
 * It creates:
 * 1. A 'root.json' skeleton: Contains the top levels of the tree.
 * 2. A 'chunks/' directory: Contains all deeper nodes in separate
 * JSON files (chunks).
 *
 * Nodes in the skeleton that have children in a chunk file are
 * converted to "stubs" with two properties:
 * - "_stub": true
 * - "_chunkFile": "chunks/chunk_123.json"
 *
 * This allows the frontend to load a tiny skeleton first and then
 * fetch data chunks on-demand as the user explores.
 *
 *
 * How to Run:
 * 1. Make sure your large JSON file is at `INPUT_FILE` (e.g., 'data/tree_deduped.json').
 * 2. Run this script from your project root: `node split-final.js`
 * 3. It will generate the 'data-lazy/' directory (defined in `OUTPUT_DIR`).
 *
 */

import {
  mkdir,
  writeFile,
  readFile,
  rm
} from 'node:fs/promises';

import {
  existsSync
} from 'node:fs';

import {
  resolve,
  dirname
} from 'node:path';

import {
  fileURLToPath
} from 'node:url';

// --- Configuration ---

// Input: Your massive 100MB+ JSON file
const INPUT_FILE = 'full data/tree_deduped.json';

// Output: The directory where the lazy-loadable files will be saved
const OUTPUT_DIR = 'data-lazy';

// The subdirectory within OUTPUT_DIR to store data chunks
const CHUNK_SUBDIR = 'chunks';

// This controls how deep the initial 'root.json' skeleton goes.
// A node at this depth (or deeper) that has children will
// have its children split into a chunk.
// A value of 3-5 is usually good for a large tree.
const CHUNK_DEPTH_THRESHOLD = 4;

// --- End Configuration ---

const __filename = fileURLToPath(
  import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..'); // Go up one level to project root

const inPath = resolve(projectRoot, INPUT_FILE);
const outPath = resolve(projectRoot, OUTPUT_DIR);
const chunkPath = resolve(outPath, CHUNK_SUBDIR);

let chunkIdCounter = 0;
const chunkQueue = [];

/**
 * Converts a nested object structure to an array of children nodes.
 * @param {object} obj - The nested object to convert
 * @returns {array} Array of nodes with name and children properties
 */
function mapToChildren(obj) {
  const out = [];
  if (!obj || typeof obj !== 'object') return out;
  for (const [key, val] of Object.entries(obj)) {
    const node = { name: String(key) };
    if (val && typeof val === 'object' && Object.keys(val).length) {
      node.children = mapToChildren(val);
    } else {
      node.children = [];
    }
    out.push(node);
  }
  return out;
}

/**
 * Normalizes a tree structure to the expected format.
 * Handles nested object structures (like { Life: { child1: {...} } })
 * and converts them to { name: 'Life', children: [...] } format.
 * @param {object} rootLike - The root object to normalize
 * @returns {object} Normalized tree with name and children properties
 */
function normalizeTree(rootLike) {
  if (Array.isArray(rootLike)) return { name: 'Life', level: 0, children: rootLike };
  if (typeof rootLike !== 'object' || rootLike === null)
    throw new Error('Top-level JSON must be an object or an array.');

  const hasStructuredProps =
    Object.prototype.hasOwnProperty.call(rootLike, 'name') ||
    Object.prototype.hasOwnProperty.call(rootLike, 'children');
  if (!hasStructuredProps) {
    const keys = Object.keys(rootLike);
    if (keys.length === 1) {
      const rootName = keys[0];
      return { name: 'Life', level: 0, children: mapToChildren(rootLike[rootName]) };
    }
    return { name: 'Life', level: 0, children: mapToChildren(rootLike) };
  }
  if (!Array.isArray(rootLike.children)) rootLike.children = rootLike.children ? [].concat(rootLike.children) : [];
  rootLike.name = 'Life';
  return rootLike;
}

/**
 * Creates a "stub" node. This is a placeholder that tells the
 * frontend that more data exists and where to load it from.
 * @param {string} chunkFileName - The name of the file (e.g., "chunks/chunk_123.json")
 * @returns {object} A stub node
 */
function createStub(chunkFileName) {
  return {
    _stub: true,
    _chunkFile: chunkFileName,
  };
}

/**
 * Recursively processes a node in the tree.
 *
 * If the node is deep enough (>= CHUNK_DEPTH_THRESHOLD) and has children,
 * it splits those children into a new chunk file, saves that chunk to
 * a queue, and replaces the node's `children` array with a "stub" object.
 *
 * @param {object} node - The current node to process
 * @param {number} depth - The current depth in the tree
 */
function processNode(node, depth) {
  // Check if this node's children should be split into a chunk
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  if (hasChildren && depth >= CHUNK_DEPTH_THRESHOLD) {
    // This node's children will be split off.
    const chunkId = chunkIdCounter++;
    const chunkFileName = `${CHUNK_SUBDIR}/chunk_${chunkId}.json`;

    // The children array will be saved to its own file.
    // We must process the children *before* saving them.
    const childrenToChunk = node.children;
    for (const child of childrenToChunk) {
      processNode(child, depth + 1); // Recurse
    }

    // Add this new chunk to the write queue
    chunkQueue.push({
      filePath: resolve(outPath, chunkFileName),
      data: childrenToChunk, // The array of children
    });

    // Replace the node's children with a stub
    // The 'name' and 'level' are kept, but 'children' is replaced.
    // We create a *new* object to avoid modifying the original node
    // while we are still iterating it.
    const stub = createStub(chunkFileName);
    node.children = [stub]; // Note: The stub *is* the children array now
    // Actually, the API expects the stub to BE the node.
    // Let's rethink. The stub *replaces* the children.
    delete node.children;
    node._stub = true;
    node._chunkFile = chunkFileName;

  } else if (hasChildren) {
    // This node is not deep enough. Continue recursing.
    for (const child of node.children) {
      processNode(child, depth + 1);
    }
  }
}

/**
 * Main function to run the splitting process
 */
async function runSplitter() {
  console.log(`Starting lazy loading data splitter...`);
  console.log(`Reading input file: ${inPath}`);
  console.time('Total Split Time');

  // 1. Read the massive JSON file
  let root;
  try {
    const fileContent = await readFile(inPath, 'utf8');
    console.log('File read, parsing JSON...');
    console.time('JSON Parse');
    const rawRoot = JSON.parse(fileContent);
    console.timeEnd('JSON Parse');
    
    // Normalize the tree structure (converts nested objects to name/children format)
    console.log('Normalizing tree structure...');
    console.time('Normalize');
    root = normalizeTree(rawRoot);
    console.timeEnd('Normalize');
  } catch (err) {
    console.error(`Failed to read or parse input file: ${err.message}`);
    process.exit(1);
  }

  // 2. Prepare output directories
  console.log(`Cleaning and creating output directory: ${outPath}`);
  try {
    if (existsSync(outPath)) {
      await rm(outPath, {
        recursive: true,
        force: true
      });
    }
    await mkdir(outPath, {
      recursive: true
    });
    await mkdir(chunkPath, {
      recursive: true
    });
  } catch (err) {
    console.error(`Failed to create output directories: ${err.message}`);
    process.exit(1);
  }

  // 3. Process the tree
  // This synchronously builds the new 'root' object in memory
  // and populates the 'chunkQueue' with all the chunks
  // that need to be written to disk.
  console.log(`Processing tree (Chunk Threshold Depth: ${CHUNK_DEPTH_THRESHOLD})...`);
  console.time('Tree Processing');
  processNode(root, 0); // Start processing from the root (depth 0)
  console.timeEnd('Tree Processing');
  console.log(`Found ${chunkQueue.length.toLocaleString()} chunks to write.`);

  // 4. Write the 'root.json' skeleton
  const rootSkeletonPath = resolve(outPath, 'root.json');
  console.log(`Writing skeleton: ${rootSkeletonPath}`);
  try {
    await writeFile(rootSkeletonPath, JSON.stringify(root));
  } catch (err) {
    console.error(`Failed to write root skeleton: ${err.message}`);
    process.exit(1);
  }

  // 5. Write all the chunks
  console.log(`Writing ${chunkQueue.length.toLocaleString()} chunks...`);
  console.time('Chunk Writing');
  const writePromises = chunkQueue.map((chunk) => {
    return writeFile(chunk.filePath, JSON.stringify(chunk.data));
  });

  try {
    await Promise.all(writePromises);
    console.timeEnd('Chunk Writing');
  } catch (err) {
    console.error(`Failed to write chunks: ${err.message}`);
    process.exit(1);
  }

  console.log('\n--- Success! ---');
  console.log(`Created ${chunkQueue.length.toLocaleString()} chunks.`);
  console.log(`Skeleton and chunks saved to: ${outPath}`);
  console.timeEnd('Total Split Time');
}

// Run the script
runSplitter().catch((err) => {
  console.error('An unexpected error occurred:', err);
  process.exit(1);
});
