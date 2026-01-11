#!/usr/bin/env node
/**
 * Convert OpenTreeofLife taxonomy.tsv file to a nested tree structure.
 * 
 * Prerequisites:
 *   1. Download taxonomy.tsv from https://tree.opentreeoflife.org/about/taxonomy-version
 *   2. Place it in data/opentree/ folder
 * 
 * Usage:
 *   node tools/convert-opentree-taxonomy-tsv-to-nested-tree-json.js
 * 
 * Input files (in data/opentree/):
 *   - taxonomy.tsv: ott_id | parent_id | name | rank | sources | unique_name | flags
 * 
 * Output:
 *   - data/tree_opentree.json: Nested tree structure ready for bake-layout.js
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = resolve(__dirname, '../data');
const OPENTREE_DIR = resolve(DATA_DIR, 'opentree');

/**
 * Parse taxonomy.tsv file
 * Format: ott_id | parent_id | name | rank | sources | unique_name | flags
 */
async function parseTaxonomy(filePath) {
  console.log('Parsing taxonomy.tsv...');
  const nodes = new Map();
  
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let isFirstLine = true;
  
  for await (const line of rl) {
    // Skip header line if present
    if (isFirstLine && (line.startsWith('ott_id') || line.startsWith('#') || line.trim() === '')) {
      isFirstLine = false;
      continue;
    }
    isFirstLine = false;
    
    // OpenTreeofLife uses tab-delimited format (not tab-stroke-tab like NCBI)
    // Try tab-stroke-tab first (some versions might use it), then fall back to regular tabs
    let parts = line.split('\t|\t');
    if (parts.length < 4) {
      parts = line.split('\t');
    }
    if (parts.length < 4) continue;
    
    const ottId = parts[0].trim();
    const parentId = parts[1].trim();
    const name = parts[2].trim();
    const rank = parts[3].trim();
    
    // Skip if ott_id is not valid
    if (!ottId || ottId === '' || isNaN(parseInt(ottId, 10))) continue;
    
    const ottIdNum = parseInt(ottId, 10);
    const parentIdNum = parentId && parentId !== '' ? parseInt(parentId, 10) : null;
    
    nodes.set(ottIdNum, {
      ottId: ottIdNum,
      parentId: parentIdNum,
      name: name || `Unknown_${ottId}`,
      rank: rank || 'no rank',
      children: []
    });
    
    count++;
    if (count % 500000 === 0) {
      console.log(`  Parsed ${count.toLocaleString()} nodes...`);
    }
  }
  
  console.log(`  Total: ${count.toLocaleString()} nodes`);
  return nodes;
}

/**
 * Build parent-child relationships
 */
function buildRelationships(nodes) {
  console.log('Building parent-child relationships...');
  
  for (const [ottId, node] of nodes) {
    if (node.parentId !== null && node.parentId !== ottId) {
      const parent = nodes.get(node.parentId);
      if (parent) {
        parent.children.push(ottId);
      }
    }
  }
}

/**
 * Find root node (ott_id where parent_id is null or empty)
 */
function findRoot(nodes) {
  for (const [ottId, node] of nodes) {
    if (node.parentId === null || node.parentId === ottId) {
      return ottId;
    }
  }
  // Fallback: find the node with no parent references
  const allParentIds = new Set();
  for (const [ottId, node] of nodes) {
    if (node.parentId !== null) {
      allParentIds.add(node.parentId);
    }
  }
  for (const [ottId, node] of nodes) {
    if (!allParentIds.has(ottId)) {
      return ottId;
    }
  }
  return null;
}

/**
 * Build tree iteratively to avoid stack overflow for deep trees
 */
function buildNestedTreeIterative(nodes, rootOttId) {
  console.log('Building nested tree structure...');
  
  const rootNode = nodes.get(rootOttId);
  if (!rootNode) {
    throw new Error(`Root node ${rootOttId} not found!`);
  }
  
  const root = {
    name: rootNode.name,
    level: 0,
    children: []
  };
  
  // BFS to build tree
  const queue = [{ ottId: rootOttId, treeNode: root }];
  let processed = 0;
  
  while (queue.length > 0) {
    const { ottId, treeNode } = queue.shift();
    const node = nodes.get(ottId);
    
    if (!node) continue;
    
    for (const childOttId of node.children) {
      const childNode = nodes.get(childOttId);
      if (!childNode) continue;
      
      const childName = childNode.name || `Unknown_${childOttId}`;
      const childTreeNode = {
        name: childName,
        level: treeNode.level + 1
      };
      
      if (childNode.children.length > 0) {
        childTreeNode.children = [];
        queue.push({ ottId: childOttId, treeNode: childTreeNode });
      }
      
      if (!treeNode.children) treeNode.children = [];
      treeNode.children.push(childTreeNode);
    }
    
    // Sort children by name
    if (treeNode.children && treeNode.children.length > 0) {
      treeNode.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    processed++;
    if (processed % 500000 === 0) {
      console.log(`  Processed ${processed.toLocaleString()} nodes, queue size: ${queue.length.toLocaleString()}`);
    }
  }
  
  console.log(`  Total processed: ${processed.toLocaleString()} nodes`);
  return root;
}

/**
 * Count total nodes in tree
 */
function countNodes(node) {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

async function main() {
  console.time('opentree-to-tree');
  
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(OPENTREE_DIR)) {
    await mkdir(OPENTREE_DIR, { recursive: true });
  }
  
  // Check for required file
  const taxonomyPath = resolve(OPENTREE_DIR, 'taxonomy.tsv');
  
  if (!existsSync(taxonomyPath)) {
    console.error(`Error: ${taxonomyPath} not found!`);
    console.error('\nPlease download OpenTreeofLife taxonomy.tsv:');
    console.error('1. Visit: https://tree.opentreeoflife.org/about/taxonomy-version');
    console.error('2. Download taxonomy.tsv file');
    console.error('3. Place taxonomy.tsv in data/opentree/');
    process.exitCode = 1;
    return;
  }
  
  // Parse taxonomy file
  const nodes = await parseTaxonomy(taxonomyPath);
  
  // Build relationships
  buildRelationships(nodes);
  
  // Find root and build tree
  const rootOttId = findRoot(nodes);
  if (!rootOttId) {
    console.error('Error: Could not find root node!');
    process.exitCode = 1;
    return;
  }
  
  const rootNode = nodes.get(rootOttId);
  console.log(`Root ott_id: ${rootOttId} (${rootNode.name})`);
  
  const tree = buildNestedTreeIterative(nodes, rootOttId);
  
  // Count nodes
  const totalNodes = countNodes(tree);
  console.log(`Total nodes in tree: ${totalNodes.toLocaleString()}`);
  
  // Save tree
  const outputPath = resolve(DATA_DIR, 'tree_opentree.json');
  console.log(`Saving to ${outputPath}...`);
  await writeFile(outputPath, JSON.stringify(tree));
  
  console.timeEnd('opentree-to-tree');
  console.log('\nNext steps:');
  console.log('1. Run: node tools/compute-d3-circle-packing-layout-from-ncbi-tree.js');
  console.log('   (Update it to read tree_opentree.json or create a new script)');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exitCode = 1;
});
