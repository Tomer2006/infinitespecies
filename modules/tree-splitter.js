// Tree splitter utility for dynamic loading
// Breaks large taxonomy trees into manageable chunks with stubs for lazy loading

const DEFAULT_CHUNK_SIZE = 5000; // nodes per chunk
const DEFAULT_DEPTH_THRESHOLD = 3; // split after this depth

/**
 * Splits a large tree into chunks for dynamic loading
 * @param {Object} tree - Root tree object
 * @param {Object} options - Splitting options
 * @returns {Object} - Split result with manifest and chunks
 */
export function splitTree(tree, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const depthThreshold = options.depthThreshold || DEFAULT_DEPTH_THRESHOLD;
  
  const chunks = [];
  const manifest = {
    version: '1.0',
    splitAt: new Date().toISOString(),
    chunkSize,
    depthThreshold,
    chunks: []
  };

  let chunkId = 0;
  const visited = new Set();

  function countNodes(node) {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += countNodes(child);
      }
    }
    return count;
  }

  function createStub(node, chunkPath) {
    return {
      name: node.name,
      level: node.level,
      _isStub: true,
      _chunkPath: chunkPath,
      _leafCount: node._leaves || countNodes(node)
    };
  }

  function extractChunk(node, path, depth = 0) {
    const nodeCount = countNodes(node);
    const nodeId = `${path}/${node.name}`.replace(/^\/+/, '');
    
    // If node is small enough or we haven't reached depth threshold, include inline
    if (nodeCount <= chunkSize || depth < depthThreshold) {
      const result = { ...node };
      if (result.children) {
        result.children = result.children.map(child => 
          extractChunk(child, nodeId, depth + 1)
        );
      }
      return result;
    }

    // Create chunk for this subtree
    const chunkPath = `chunk_${String(chunkId++).padStart(5, '0')}.json`;
    const chunkData = { ...node };
    
    // Process children recursively for the chunk
    if (chunkData.children) {
      chunkData.children = chunkData.children.map(child =>
        extractChunk(child, nodeId, 0) // Reset depth for new chunk
      );
    }

    chunks.push({
      path: chunkPath,
      nodeId,
      nodeCount,
      data: chunkData
    });

    manifest.chunks.push({
      path: chunkPath,
      nodeId,
      nodeCount,
      parentPath: path || 'root'
    });

    // Return stub for main tree
    return createStub(node, chunkPath);
  }

  // Start splitting from root
  const rootChunk = extractChunk(tree, '', 0);
  
  manifest.totalNodes = countNodes(tree);
  manifest.totalChunks = chunks.length;
  manifest.rootChunk = 'root.json';

  return {
    manifest,
    rootChunk: rootChunk,
    chunks
  };
}

/**
 * Writes split tree to files (for build-time splitting)
 * @param {Object} splitResult - Result from splitTree()
 * @param {string} outputDir - Directory to write files
 */
export async function writeSplitTree(splitResult, outputDir = './data-split') {
  const { manifest, rootChunk, chunks } = splitResult;
  
  // In a real implementation, you'd use Node.js fs module
  // This is a browser-compatible version that returns the file contents
  const files = [];
  
  // Root chunk
  files.push({
    path: `${outputDir}/root.json`,
    content: JSON.stringify(rootChunk, null, 2)
  });
  
  // Individual chunks
  for (const chunk of chunks) {
    files.push({
      path: `${outputDir}/${chunk.path}`,
      content: JSON.stringify(chunk.data, null, 2)
    });
  }
  
  // Manifest
  files.push({
    path: `${outputDir}/manifest.json`,
    content: JSON.stringify(manifest, null, 2)
  });
  
  return files;
}

/**
 * Creates a manifest for existing data structure
 * @param {Object} tree - Tree to analyze
 * @returns {Object} - Manifest describing the tree structure
 */
export function createManifest(tree) {
  const manifest = {
    version: '1.0',
    type: 'dynamic',
    createdAt: new Date().toISOString(),
    totalNodes: 0,
    maxDepth: 0,
    chunkPaths: new Map()
  };

  function analyze(node, path = '', depth = 0) {
    manifest.totalNodes++;
    manifest.maxDepth = Math.max(manifest.maxDepth, depth);
    
    const nodePath = path ? `${path}/${node.name}` : node.name;
    
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        analyze(child, nodePath, depth + 1);
      }
    }
  }

  analyze(tree);
  return manifest;
}
