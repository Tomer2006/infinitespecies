// Balanced tree splitter - splits large branches recursively
// Ensures no chunk exceeds the target size

import fs from 'fs';
import path from 'path';

const INPUT_FILE = './tree big fie data/tree_deduped.json';
const OUTPUT_DIR = './data lazy';
const MAX_CHUNK_SIZE_MB = 10; // Maximum size per chunk
const MAX_CHUNK_SIZE_BYTES = MAX_CHUNK_SIZE_MB * 1024 * 1024;

console.log('🚀 Starting balanced tree splitting...');
console.log(`📁 Input: ${INPUT_FILE}`);
console.log(`📂 Output: ${OUTPUT_DIR}`);
console.log(`📦 Max chunk size: ${MAX_CHUNK_SIZE_MB}MB`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('\n📖 Reading file...');
const startTime = Date.now();
const fileContent = fs.readFileSync(INPUT_FILE, 'utf8');
console.log(`✅ Read in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

console.log('🔄 Parsing JSON...');
const parseStart = Date.now();
const treeData = JSON.parse(fileContent);
console.log(`✅ Parsed in ${((Date.now() - parseStart) / 1000).toFixed(2)}s`);

// Convert to structured format
function mapToChildren(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const out = [];
  for (const [key, val] of Object.entries(obj)) {
    const node = { name: String(key) };
    if (val && typeof val === 'object' && Object.keys(val).length) {
      node.children = mapToChildren(val);
    }
    out.push(node);
  }
  return out;
}

console.log('\n🔍 Converting structure...');
let rootChildren = [];
if (treeData.Life) {
  rootChildren = mapToChildren(treeData.Life);
} else if (Array.isArray(treeData)) {
  rootChildren = treeData;
} else {
  rootChildren = mapToChildren(treeData);
}

console.log(`📊 Root has ${rootChildren.length} top-level children`);

// Get size of a node
function getNodeSize(node) {
  return Buffer.byteLength(JSON.stringify(node), 'utf8');
}

// Split a node's children into chunks
function splitChildren(children, path = []) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;
  
  for (const child of children) {
    const childSize = getNodeSize(child);
    const childPath = [...path, child.name];
    
    // If this single child is too large, split it recursively
    if (childSize > MAX_CHUNK_SIZE_BYTES) {
      // Save current chunk if not empty
      if (currentChunk.length > 0) {
        chunks.push({ children: currentChunk, size: currentSize, path });
        currentChunk = [];
        currentSize = 0;
      }
      
      // Split the large child
      console.log(`  🔨 Splitting large branch: ${childPath.join(' > ')} (${(childSize / 1024 / 1024).toFixed(2)}MB)`);
      
      if (child.children && child.children.length > 0) {
        const subChunks = splitChildren(child.children, childPath);
        chunks.push(...subChunks);
      } else {
        // Leaf node that's too large - keep it as is
        chunks.push({ children: [child], size: childSize, path: childPath });
      }
      continue;
    }
    
    // If adding this child would exceed limit, start new chunk
    if (currentSize + childSize > MAX_CHUNK_SIZE_BYTES && currentChunk.length > 0) {
      chunks.push({ children: currentChunk, size: currentSize, path });
      currentChunk = [];
      currentSize = 0;
    }
    
    currentChunk.push(child);
    currentSize += childSize;
  }
  
  // Add remaining chunk
  if (currentChunk.length > 0) {
    chunks.push({ children: currentChunk, size: currentSize, path });
  }
  
  return chunks;
}

console.log('\n✂️ Splitting into balanced chunks...');
const chunks = splitChildren(rootChildren, ['Life']);

console.log(`\n📦 Created ${chunks.length} balanced chunks`);

// Write chunks
console.log('\n💾 Writing chunk files...');
const files = [];

for (let i = 0; i < chunks.length; i++) {
  const filename = `tree_lazy_chunk_${String(i + 1).padStart(3, '0')}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  const chunkData = {
    path: chunks[i].path,
    children: chunks[i].children
  };
  
  const json = JSON.stringify(chunkData);
  fs.writeFileSync(filepath, json, 'utf8');
  
  const size = Buffer.byteLength(json, 'utf8');
  files.push({
    filename: filename,
    path: chunks[i].path.join(' > '),
    size: size,
    children_count: chunks[i].children.length
  });
  
  console.log(`✅ ${filename}: ${(size / 1024 / 1024).toFixed(2)}MB, ${chunks[i].children.length} items, path: ${chunks[i].path.slice(-2).join(' > ')}`);
}

// Create manifest
console.log('\n📋 Creating manifest...');
const manifest = {
  version: '1.0',
  type: 'lazy_loading_balanced',
  created: new Date().toISOString(),
  source_file: INPUT_FILE,
  total_files: files.length,
  total_size_bytes: files.reduce((sum, f) => sum + f.size, 0),
  max_chunk_size_mb: MAX_CHUNK_SIZE_MB,
  root_name: 'Life',
  files: files
};

const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`✅ Manifest created`);

// Summary
console.log('\n' + '='.repeat(60));
console.log('🎉 BALANCED SPLITTING COMPLETE!');
console.log('='.repeat(60));
console.log(`📊 Total chunks: ${chunks.length}`);
console.log(`📊 Total size: ${(manifest.total_size_bytes / 1024 / 1024).toFixed(2)}MB`);
console.log(`📊 Avg chunk size: ${(manifest.total_size_bytes / chunks.length / 1024 / 1024).toFixed(2)}MB`);
console.log(`📊 Largest chunk: ${(Math.max(...files.map(f => f.size)) / 1024 / 1024).toFixed(2)}MB`);
console.log(`📂 Output: ${OUTPUT_DIR}`);
console.log(`⏱️  Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
console.log('='.repeat(60));
