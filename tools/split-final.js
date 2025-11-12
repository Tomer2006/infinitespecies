// Final optimized tree splitter - creates truly balanced chunks
// Recursively splits large branches until all chunks are under target size

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = './full data/tree_deduped.json';
const OUTPUT_DIR = './data lazy';
const TARGET_CHUNK_MB = 10; // Target size for each chunk
const TARGET_CHUNK_BYTES = TARGET_CHUNK_MB * 1024 * 1024;

console.log('🚀 Starting optimized tree splitting...');
console.log(`📁 Input: ${INPUT_FILE}`);
console.log(`📂 Output: ${OUTPUT_DIR}`);
console.log(`📦 Target chunk size: ${TARGET_CHUNK_MB}MB\n`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read and parse
console.log('📖 Reading file...');
const startTime = Date.now();
const fileContent = fs.readFileSync(INPUT_FILE, 'utf8');
console.log(`✅ Read in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

console.log('🔄 Parsing JSON...');
const parseStart = Date.now();
const data = JSON.parse(fileContent);
console.log(`✅ Parsed in ${((Date.now() - parseStart) / 1000).toFixed(2)}s\n`);

// Convert nested map to structured tree
function convertToChildren(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const children = [];
  for (const [key, val] of Object.entries(obj)) {
    const node = { name: String(key) };
    if (val && typeof val === 'object' && Object.keys(val).length > 0) {
      node.children = convertToChildren(val);
    }
    children.push(node);
  }
  return children;
}

// Normalize root
let root;
if (data.name || data.children) {
  root = data;
} else if (Array.isArray(data)) {
  root = { name: 'Life', children: data };
} else {
  const keys = Object.keys(data);
  if (keys.length === 1) {
    root = { name: keys[0], children: convertToChildren(data[keys[0]]) };
  } else {
    root = { name: 'Life', children: convertToChildren(data) };
  }
}

console.log(`🌳 Root: "${root.name}", children: ${root.children?.length || 0}\n`);

// Get size of a node
function getSize(node) {
  return Buffer.byteLength(JSON.stringify(node), 'utf8');
}

// Recursively split a node into chunks
function splitNode(node, path = []) {
  const nodePath = [...path, node.name];
  const nodeSize = getSize(node);
  
  // If node is small enough, return it as a chunk
  if (nodeSize <= TARGET_CHUNK_BYTES) {
    return [{
      data: node,
      size: nodeSize,
      path: nodePath.join(' > ')
    }];
  }
  
  // If no children, we can't split further - return as-is
  if (!node.children || node.children.length === 0) {
    console.log(`⚠️  Large leaf node: ${nodePath.join(' > ')} (${(nodeSize / 1024 / 1024).toFixed(2)}MB)`);
    return [{
      data: node,
      size: nodeSize,
      path: nodePath.join(' > ')
    }];
  }
  
  console.log(`🔨 Splitting: ${nodePath.join(' > ')} (${(nodeSize / 1024 / 1024).toFixed(2)}MB, ${node.children.length} children)`);
  
  // Split children into chunks
  const chunks = [];
  let currentBatch = [];
  let currentSize = 0;
  
  for (const child of node.children) {
    const childSize = getSize(child);
    
    // If child is too large, add stub to current batch and recursively split it
    if (childSize > TARGET_CHUNK_BYTES) {
      // Create a stub version of the large child for the parent chunk
      const stubChild = {
        name: child.name,
        _stub: true,
        _leaves: 1  // Will be updated when loaded
      };

      // Check if adding stub would exceed limit
      if (currentSize + 1000 > TARGET_CHUNK_BYTES && currentBatch.length > 0) { // Small size for stub
        chunks.push({
          data: { name: node.name, children: currentBatch },
          size: currentSize,
          path: nodePath.join(' > ')
        });
        currentBatch = [];
        currentSize = 0;
      }

      // Add stub to current batch
      currentBatch.push(stubChild);
      currentSize += 1000; // Small size for stub

      // Recursively split the large child
      const childChunks = splitNode(child, nodePath);
      chunks.push(...childChunks);
    } else {
      // Check if adding this child would exceed limit
      if (currentSize + childSize > TARGET_CHUNK_BYTES && currentBatch.length > 0) {
        chunks.push({
          data: { name: node.name, children: currentBatch },
          size: currentSize,
          path: nodePath.join(' > ')
        });
        currentBatch = [];
        currentSize = 0;
      }
      
      currentBatch.push(child);
      currentSize += childSize;
    }
  }
  
  // Add remaining batch
  if (currentBatch.length > 0) {
    chunks.push({
      data: { name: node.name, children: currentBatch },
      size: currentSize,
      path: nodePath.join(' > ')
    });
  }
  
  return chunks;
}

// Split the tree
console.log('✂️ Splitting tree into chunks...\n');
const chunks = splitNode(root);

console.log(`\n✅ Created ${chunks.length} chunks\n`);

// Write chunks
console.log('💾 Writing chunk files...');
const chunkFiles = [];

for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];
  const filename = `tree_lazy_chunk_${String(i + 1).padStart(3, '0')}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(chunk.data), 'utf8');
  
  const sizeMB = (chunk.size / 1024 / 1024).toFixed(2);
  console.log(`  ✓ ${filename}: ${sizeMB}MB - ${chunk.path}`);
  
  chunkFiles.push({
    filename,
    size_bytes: chunk.size,
    size_mb: parseFloat(sizeMB),
    path: chunk.path
  });
}

// Create manifest
const manifest = {
  version: '1.0',
  type: 'lazy_loading_optimized',
  created: new Date().toISOString(),
  source_file: INPUT_FILE,
  target_chunk_mb: TARGET_CHUNK_MB,
  total_files: chunks.length,
  total_size_bytes: chunks.reduce((sum, c) => sum + c.size, 0),
  root_name: root.name,
  files: chunkFiles
};

const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`\n📋 Manifest: ${manifestPath}`);

// Create skeleton (first 2 levels only, with stubs for nodes that have chunks)
// Build a set of paths that have chunks
const chunkPaths = new Set(chunks.map(c => c.path));

// Helper to check if a node is significant (has chunks or has many children)
function isSignificantNode(node, nodePathStr, depth) {
  // If it has a chunk, it's significant
  if (chunkPaths.has(nodePathStr)) return true;
  
  // At depth 1 (under Life), only show major branches
  if (depth === 1) {
    // Major known branches
    const majorBranches = ['cellular organisms', 'Bacteria', 'Eukaryota', 'Archaea', 'Viruses'];
    if (majorBranches.some(branch => node.name.toLowerCase().includes(branch.toLowerCase()))) return true;
    // Or if it has many children (indicating it's a major branch)
    const childCount = node.children?.length || 0;
    if (childCount > 100) return true;
    return false;
  }
  
  // For other depths, check if it has many children (major branch)
  const childCount = node.children?.length || 0;
  if (childCount > 10) return true;
  
  return false;
}

function createSkeleton(node, depth = 0, maxDepth = 2, parentPath = []) {
  const nodePath = [...parentPath, node.name];
  const nodePathStr = nodePath.join(' > ');
  
  // At root level (depth 0), only include significant children
  if (depth === 0) {
    const skeleton = { name: node.name };
    if (node.children && node.children.length > 0) {
      // Filter to only significant children
      const significantChildren = node.children.filter(child => {
        const childPath = [node.name, child.name].join(' > ');
        return isSignificantNode(child, childPath, depth);
      });
      
      // If no significant children, include all (fallback)
      const childrenToInclude = significantChildren.length > 0 ? significantChildren : node.children.slice(0, 10);
      
      skeleton.children = childrenToInclude.map(child => createSkeleton(child, depth + 1, maxDepth, nodePath));
    }
    return skeleton;
  }
  
  // If this node has a corresponding chunk, mark it as a stub
  if (depth >= maxDepth && chunkPaths.has(nodePathStr)) {
    return {
      name: node.name,
      _stub: true,
      _childCount: node.children?.length || 0
    };
  }
  
  // If at max depth but no chunk, include the node normally (it's in a parent chunk)
  if (depth >= maxDepth) {
    const skeleton = { name: node.name };
    // Don't include children at max depth if no chunk exists
    return skeleton;
  }
  
  // At depth 1 (under major branches), also filter to significant children
  if (depth === 1) {
    const skeleton = { name: node.name };
    if (node.children && node.children.length > 0) {
      // Filter to only significant children
      const significantChildren = node.children.filter(child => {
        const childPathStr = [...nodePath, child.name].join(' > ');
        return isSignificantNode(child, childPathStr, depth + 1);
      });
      
      // If no significant children found, include all (fallback)
      const childrenToInclude = significantChildren.length > 0 ? significantChildren : node.children;
      skeleton.children = childrenToInclude.map(child => createSkeleton(child, depth + 1, maxDepth, nodePath));
    }
    return skeleton;
  }
  
  // Otherwise, recurse into children
  const skeleton = { name: node.name };
  if (node.children && node.children.length > 0) {
    skeleton.children = node.children.map(child => createSkeleton(child, depth + 1, maxDepth, nodePath));
  }
  return skeleton;
}

// No longer generating skeleton file - structure is generated on-the-fly from manifest
console.log(`✅ Skeleton generation skipped - will be generated from manifest at runtime`);

// Summary
const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
const avgSize = (totalSize / chunks.length / 1024 / 1024).toFixed(2);
const maxSize = Math.max(...chunks.map(c => c.size)) / 1024 / 1024;

console.log('\n' + '='.repeat(60));
console.log('🎉 SPLITTING COMPLETE!');
console.log('='.repeat(60));
console.log(`📊 Total chunks: ${chunks.length}`);
console.log(`📊 Total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
console.log(`📊 Average chunk: ${avgSize}MB`);
console.log(`📊 Largest chunk: ${maxSize.toFixed(2)}MB`);
console.log(`📂 Output: ${OUTPUT_DIR}`);
console.log(`⏱️  Time: ${totalTime}s`);
console.log('='.repeat(60));
