#!/usr/bin/env node
// Build-time utility to split large taxonomy trees for dynamic loading
// Usage: node build-tree-splitter.js input.json output-dir

const fs = require('fs');
const path = require('path');

// Import our splitter (in a real setup, you'd transpile or use ES modules properly)
function splitTree(tree, options = {}) {
  const chunkSize = options.chunkSize || 5000;
  const depthThreshold = options.depthThreshold || 3;
  
  const chunks = [];
  const manifest = {
    version: '1.0',
    type: 'dynamic',
    splitAt: new Date().toISOString(),
    chunkSize,
    depthThreshold,
    chunks: []
  };

  let chunkId = 0;

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
    
    if (nodeCount <= chunkSize || depth < depthThreshold) {
      const result = { ...node };
      if (result.children) {
        result.children = result.children.map(child => 
          extractChunk(child, nodeId, depth + 1)
        );
      }
      return result;
    }

    const chunkPath = `chunk_${String(chunkId++).padStart(5, '0')}.json`;
    const chunkData = { ...node };
    
    if (chunkData.children) {
      chunkData.children = chunkData.children.map(child =>
        extractChunk(child, nodeId, 0)
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

    return createStub(node, chunkPath);
  }

  const rootChunk = extractChunk(tree, '', 0);
  
  manifest.totalNodes = countNodes(tree);
  manifest.totalChunks = chunks.length;

  return { manifest, rootChunk, chunks };
}

function main() {
  const [inputFile, outputDir = './data-split'] = process.argv.slice(2);
  
  if (!inputFile) {
    console.error('Usage: node build-tree-splitter.js input.json [output-dir]');
    process.exit(1);
  }

  console.log(`Reading ${inputFile}...`);
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  
  console.log('Splitting tree...');
  const result = splitTree(data, {
    chunkSize: 5000,
    depthThreshold: 3
  });

  console.log(`Creating output directory: ${outputDir}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Writing manifest...');
  fs.writeFileSync(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(result.manifest, null, 2)
  );

  console.log('Writing root chunk...');
  fs.writeFileSync(
    path.join(outputDir, 'root.json'),
    JSON.stringify(result.rootChunk, null, 2)
  );

  console.log(`Writing ${result.chunks.length} chunks...`);
  for (const chunk of result.chunks) {
    fs.writeFileSync(
      path.join(outputDir, chunk.path),
      JSON.stringify(chunk.data, null, 2)
    );
  }

  console.log(`✅ Split complete!`);
  console.log(`📊 Original: ${result.manifest.totalNodes.toLocaleString()} nodes`);
  console.log(`📦 Output: ${result.chunks.length + 1} files`);
  console.log(`💾 Root chunk: ${JSON.stringify(result.rootChunk).length} bytes`);
  console.log(`📁 Directory: ${outputDir}`);
  
  console.log('\n🚀 To serve dynamically:');
  console.log(`   1. Copy ${outputDir}/* to your web server`);
  console.log(`   2. Load with: loadFromUrl('${outputDir}/manifest.json')`);
}

if (require.main === module) {
  main();
}

module.exports = { splitTree };
