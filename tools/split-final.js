// Final optimized tree splitter - creates truly balanced chunks
// Recursively splits large branches until all chunks are under target size

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = './tree big fie data/tree_deduped.json';
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
