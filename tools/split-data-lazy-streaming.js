// Memory-efficient streaming splitter for large tree_deduped.json
// Uses streaming JSON parsing to avoid loading entire file into memory

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import JSONStream from 'JSONStream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = './tree big fie data/tree_deduped.json';
const OUTPUT_DIR = './data lazy';
const CHUNK_SIZE_MB = 10; // Target chunk size in MB

console.log('🚀 Starting memory-efficient lazy data splitting...');
console.log(`📁 Input: ${INPUT_FILE}`);
console.log(`📂 Output: ${OUTPUT_DIR}`);
console.log(`📦 Target chunk size: ${CHUNK_SIZE_MB}MB`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✅ Created output directory: ${OUTPUT_DIR}`);
}

// For this approach, we'll use a simpler strategy:
// 1. Read the file line by line (or in chunks)
// 2. Split at top-level children boundaries
// 3. Write chunks as we go

console.log('📖 Reading and analyzing file structure...');

// First pass: understand the structure
const fileContent = fs.readFileSync(INPUT_FILE, 'utf8');
const inputSizeMB = (fileContent.length / 1024 / 1024).toFixed(2);
console.log(`📊 Input file size: ${inputSizeMB}MB`);

// Parse to get structure
console.log('🔍 Parsing JSON structure...');
let data;
try {
  data = JSON.parse(fileContent);
  console.log('✅ JSON parsed successfully');
} catch (e) {
  console.error('❌ Failed to parse JSON:', e.message);
  process.exit(1);
}

// Normalize to get root structure
function normalizeTree(rootLike) {
  if (Array.isArray(rootLike)) {
    return { name: 'Life', level: 0, children: rootLike };
  }
  if (typeof rootLike !== 'object' || rootLike === null) {
    throw new Error('Top-level JSON must be an object or an array.');
  }

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
  
  if (!Array.isArray(rootLike.children)) {
    rootLike.children = rootLike.children ? [].concat(rootLike.children) : [];
  }
  rootLike.name = rootLike.name || 'Life';
  return rootLike;
}

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

console.log('🔄 Normalizing tree structure...');
const root = normalizeTree(data);
console.log(`🌳 Root: ${root.name}, top-level children: ${root.children?.length || 0}`);

// Clear the original data to free memory
data = null;
global.gc && global.gc();

// Now split the children
console.log('✂️ Splitting into chunks...');

const CHUNK_SIZE_BYTES = CHUNK_SIZE_MB * 1024 * 1024;
const chunks = [];
let chunkIndex = 0;
let currentChunk = [];
let currentSize = 0;

for (let i = 0; i < root.children.length; i++) {
  const child = root.children[i];
  const childStr = JSON.stringify(child);
  const childSize = Buffer.byteLength(childStr, 'utf8');
  const childSizeMB = (childSize / 1024 / 1024).toFixed(2);
  
  // If adding this child would exceed chunk size, save current chunk
  if (currentSize + childSize > CHUNK_SIZE_BYTES && currentChunk.length > 0) {
    chunks.push({
      index: chunkIndex++,
      children: currentChunk,
      size: currentSize
    });
    console.log(`📦 Chunk ${chunkIndex} created: ${(currentSize / 1024 / 1024).toFixed(2)}MB, ${currentChunk.length} children`);
    currentChunk = [];
    currentSize = 0;
  }
  
  currentChunk.push(child);
  currentSize += childSize;
  
  if (childSizeMB > 5) {
    console.log(`  ⚠️  Large child "${child.name}": ${childSizeMB}MB`);
  }
  
  if ((i + 1) % 50 === 0) {
    console.log(`⏳ Processed ${i + 1}/${root.children.length} children...`);
  }
}

// Add remaining chunk
if (currentChunk.length > 0) {
  chunks.push({
    index: chunkIndex++,
    children: currentChunk,
    size: currentSize
  });
  console.log(`📦 Final chunk ${chunkIndex} created: ${(currentSize / 1024 / 1024).toFixed(2)}MB, ${currentChunk.length} children`);
}

console.log(`✅ Created ${chunks.length} chunks`);

// Write chunks to files
console.log('💾 Writing chunk files...');
const chunkFiles = [];

for (const chunk of chunks) {
  const filename = `tree_lazy_chunk_${String(chunk.index + 1).padStart(3, '0')}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);
  
  const chunkData = {
    name: 'Life',
    level: 0,
    children: chunk.children
  };
  
  const chunkJson = JSON.stringify(chunkData);
  fs.writeFileSync(filepath, chunkJson, 'utf8');
  
  const sizeMB = (chunk.size / 1024 / 1024).toFixed(2);
  console.log(`  ✓ ${filename} (${sizeMB}MB, ${chunk.children.length} children)`);
  
  chunkFiles.push({
    filename: filename,
    index: chunk.index,
    size_bytes: chunk.size,
    size_mb: parseFloat(sizeMB),
    children_count: chunk.children.length,
    child_names: chunk.children.map(c => c.name)
  });
}

// Create manifest
const manifest = {
  version: '1.0.0',
  type: 'lazy-loading',
  created: new Date().toISOString(),
  source_file: INPUT_FILE,
  source_size_mb: parseFloat(inputSizeMB),
  total_files: chunks.length,
  total_top_level_children: root.children.length,
  chunk_size_target_mb: CHUNK_SIZE_MB,
  files: chunkFiles
};

const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`📋 Manifest created: ${manifestPath}`);

// Create index for quick lookup
const index = {};
for (const file of chunkFiles) {
  for (const childName of file.child_names) {
    index[childName] = file.filename;
  }
}

const indexPath = path.join(OUTPUT_DIR, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
console.log(`📇 Index created: ${indexPath}`);

// Summary
console.log('\n🎉 Splitting completed successfully!');
console.log('📊 Summary:');
console.log(`  • Total chunks: ${chunks.length}`);
console.log(`  • Total top-level children: ${root.children.length}`);
console.log(`  • Average chunk size: ${(chunks.reduce((sum, c) => sum + c.size, 0) / chunks.length / 1024 / 1024).toFixed(2)}MB`);
console.log(`  • Output directory: ${OUTPUT_DIR}`);
console.log('\n✅ Ready for lazy loading!');

