#!/usr/bin/env node
/**
 * Bake D3 circle-packing layout for NCBI tree
 *
 * This script pre-calculates the D3 pack layout for the taxonomy tree,
 * flattens it into an array, and splits it into multiple files.
 *
 * Usage:
 *   node tools/bake-layout-ncbi.js
 *
 * Input:
 *   data/tree_ncbi.json (from ncbi-to-tree.js)
 *
 * Outputs:
 *   public/data/manifest.json
 *   public/data/tree_part_001.json ... tree_part_005.json
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hierarchy as d3hierarchy, pack as d3pack } from 'd3-hierarchy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = resolve(__dirname, '../data');
const OUTPUT_DIR = resolve(__dirname, '../public/data');

const LAYOUT_SIZE = 4000;
const LAYOUT_PADDING = 0;
const NUM_PARTS = 5;

async function main() {
  console.time('bake-layout-ncbi');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  // Load tree data
  const inputPath = resolve(DATA_DIR, 'tree_ncbi.json');
  console.log(`Loading ${inputPath}...`);
  
  if (!existsSync(inputPath)) {
    console.error(`Error: ${inputPath} not found!`);
    console.error('Run ncbi-to-tree.js first.');
    process.exitCode = 1;
    return;
  }

  const raw = await readFile(inputPath, 'utf8');
  console.log('Parsing JSON...');
  const tree = JSON.parse(raw);

  // Compute layout
  console.log('Computing D3 pack layout...');
  console.log('(This may take several minutes for large datasets)');
  const startTime = performance.now();

  const pack = d3pack()
    .size([LAYOUT_SIZE, LAYOUT_SIZE])
    .padding(LAYOUT_PADDING);

  const root = d3hierarchy(tree)
    .sum(d => {
      const children = d.children;
      return (Array.isArray(children) && children.length > 0) ? 0 : 1;
    })
    .sort((a, b) => b.value - a.value);

  pack(root);

  const duration = performance.now() - startTime;
  console.log(`Layout computed in ${(duration / 1000).toFixed(2)}s`);

  // Flatten tree
  console.log('Flattening tree...');
  const nodes = [];
  const cx = LAYOUT_SIZE / 2;
  const cy = LAYOUT_SIZE / 2;

  let nextId = 1;
  const idMap = new Map();

  // First pass: assign IDs
  root.each(d => {
    idMap.set(d, nextId++);
  });

  // Second pass: flatten with parent references
  root.each(d => {
    const id = idMap.get(d);
    const parentId = d.parent ? idMap.get(d.parent) : null;

    nodes.push({
      id,
      parent_id: parentId,
      name: d.data.name,
      level: d.depth,
      x: Math.round((d.x - cx) * 100) / 100,
      y: Math.round((d.y - cy) * 100) / 100,
      r: Math.round(d.r * 100) / 100
    });
  });

  console.log(`Total nodes: ${nodes.length.toLocaleString()}`);

  // Split into parts
  console.log(`Splitting into ${NUM_PARTS} parts...`);
  const partSize = Math.ceil(nodes.length / NUM_PARTS);
  const files = [];

  for (let i = 0; i < NUM_PARTS; i++) {
    const start = i * partSize;
    const end = Math.min(start + partSize, nodes.length);
    const part = nodes.slice(start, end);

    const partNum = String(i + 1).padStart(3, '0');
    const filename = `tree_part_${partNum}.json`;
    const filePath = resolve(OUTPUT_DIR, filename);

    await writeFile(filePath, JSON.stringify(part));

    const stats = await readFile(filePath);
    files.push({
      filename,
      nodes_count: part.length,
      size_bytes: stats.length
    });

    console.log(`  Wrote ${filename} (${part.length.toLocaleString()} nodes, ${(stats.length / 1024 / 1024).toFixed(2)} MB)`);
  }

  // Write manifest
  const manifest = {
    version: '1.0',
    description: 'Pre-baked D3 circle-packing layout for taxonomy tree',
    layout_size: LAYOUT_SIZE,
    layout_padding: LAYOUT_PADDING,
    total_nodes: nodes.length,
    total_files: files.length,
    files,
    created_at: new Date().toISOString()
  };

  const manifestPath = resolve(OUTPUT_DIR, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Wrote manifest.json`);

  console.timeEnd('bake-layout-ncbi');
  console.log('Done!');
}

main().catch(err => {
  console.error('Failed to bake layout:', err);
  process.exitCode = 1;
});
