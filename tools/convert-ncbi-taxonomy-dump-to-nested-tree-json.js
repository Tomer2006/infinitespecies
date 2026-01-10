#!/usr/bin/env node
/**
 * Convert NCBI Taxonomy dump files to a nested tree structure.
 * 
 * Prerequisites:
 *   1. Download taxdump.tar.gz from ftp://ftp.ncbi.nlm.nih.gov/pub/taxonomy/
 *   2. Extract to get nodes.dmp and names.dmp
 *   3. Place them in data/ncbi/ folder
 * 
 * Usage:
 *   node tools/ncbi-to-tree.js
 * 
 * Input files (in data/ncbi/):
 *   - nodes.dmp: tax_id | parent_tax_id | rank | ...
 *   - names.dmp: tax_id | name_txt | unique_name | name_class
 * 
 * Output:
 *   - data/tree_ncbi.json: Nested tree structure ready for bake-layout.js
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
const NCBI_DIR = resolve(DATA_DIR, 'ncbi');

/**
 * Parse nodes.dmp file
 * Format: tax_id | parent_tax_id | rank | embl_code | division_id | ...
 */
async function parseNodes(filePath) {
  console.log('Parsing nodes.dmp...');
  const nodes = new Map();
  
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    const parts = line.split('\t|\t');
    if (parts.length < 3) continue;
    
    const taxId = parseInt(parts[0].trim(), 10);
    const parentTaxId = parseInt(parts[1].trim(), 10);
    const rank = parts[2].trim();
    
    nodes.set(taxId, {
      taxId,
      parentTaxId,
      rank,
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
 * Parse names.dmp file - extract scientific names
 * Format: tax_id | name_txt | unique_name | name_class
 */
async function parseNames(filePath) {
  console.log('Parsing names.dmp (scientific names only)...');
  const names = new Map();
  
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    const parts = line.split('\t|\t');
    if (parts.length < 4) continue;
    
    const taxId = parseInt(parts[0].trim(), 10);
    const nameTxt = parts[1].trim();
    const nameClass = parts[3].replace(/\t?\|$/, '').trim();
    
    // Only use scientific names
    if (nameClass === 'scientific name') {
      names.set(taxId, nameTxt);
    }
    
    count++;
    if (count % 1000000 === 0) {
      console.log(`  Processed ${count.toLocaleString()} name entries...`);
    }
  }
  
  console.log(`  Found ${names.size.toLocaleString()} scientific names`);
  return names;
}

/**
 * Build parent-child relationships
 */
function buildRelationships(nodes) {
  console.log('Building parent-child relationships...');
  
  for (const [taxId, node] of nodes) {
    if (node.parentTaxId !== taxId) { // Root has parent = itself
      const parent = nodes.get(node.parentTaxId);
      if (parent) {
        parent.children.push(taxId);
      }
    }
  }
}

/**
 * Find root node (tax_id where parent = self, usually tax_id 1)
 */
function findRoot(nodes) {
  for (const [taxId, node] of nodes) {
    if (node.parentTaxId === taxId) {
      return taxId;
    }
  }
  return 1; // Default to tax_id 1
}

/**
 * Convert to nested tree structure recursively
 */
function buildNestedTree(nodes, names, taxId, depth = 0, maxDepth = 100) {
  const node = nodes.get(taxId);
  if (!node) return null;
  
  const name = names.get(taxId) || `Unknown_${taxId}`;
  
  const treeNode = {
    name,
    level: depth
  };
  
  if (node.children.length > 0 && depth < maxDepth) {
    treeNode.children = [];
    for (const childTaxId of node.children) {
      const childNode = buildNestedTree(nodes, names, childTaxId, depth + 1, maxDepth);
      if (childNode) {
        treeNode.children.push(childNode);
      }
    }
    // Sort children by name for consistent ordering
    treeNode.children.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return treeNode;
}

/**
 * Build tree iteratively to avoid stack overflow for deep trees
 */
function buildNestedTreeIterative(nodes, names, rootTaxId) {
  console.log('Building nested tree structure...');
  
  const rootNode = nodes.get(rootTaxId);
  const rootName = names.get(rootTaxId) || 'Life';
  
  const root = {
    name: rootName,
    level: 0,
    children: []
  };
  
  // BFS to build tree
  const queue = [{ taxId: rootTaxId, treeNode: root }];
  let processed = 0;
  
  while (queue.length > 0) {
    const { taxId, treeNode } = queue.shift();
    const node = nodes.get(taxId);
    
    if (!node) continue;
    
    for (const childTaxId of node.children) {
      const childName = names.get(childTaxId) || `Unknown_${childTaxId}`;
      const childTreeNode = {
        name: childName,
        level: treeNode.level + 1
      };
      
      const childNode = nodes.get(childTaxId);
      if (childNode && childNode.children.length > 0) {
        childTreeNode.children = [];
        queue.push({ taxId: childTaxId, treeNode: childTreeNode });
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
  console.time('ncbi-to-tree');
  
  // Check for required files
  const nodesPath = resolve(NCBI_DIR, 'nodes.dmp');
  const namesPath = resolve(NCBI_DIR, 'names.dmp');
  
  if (!existsSync(nodesPath)) {
    console.error(`Error: ${nodesPath} not found!`);
    console.error('\nPlease download and extract NCBI taxonomy dump:');
    console.error('1. Download: ftp://ftp.ncbi.nlm.nih.gov/pub/taxonomy/taxdump.tar.gz');
    console.error('2. Extract: tar -xzf taxdump.tar.gz');
    console.error('3. Move nodes.dmp and names.dmp to data/ncbi/');
    process.exitCode = 1;
    return;
  }
  
  if (!existsSync(namesPath)) {
    console.error(`Error: ${namesPath} not found!`);
    process.exitCode = 1;
    return;
  }
  
  // Parse dump files
  const nodes = await parseNodes(nodesPath);
  const names = await parseNames(namesPath);
  
  // Build relationships
  buildRelationships(nodes);
  
  // Find root and build tree
  const rootTaxId = findRoot(nodes);
  console.log(`Root tax_id: ${rootTaxId} (${names.get(rootTaxId)})`);
  
  const tree = buildNestedTreeIterative(nodes, names, rootTaxId);
  
  // Count nodes
  const totalNodes = countNodes(tree);
  console.log(`Total nodes in tree: ${totalNodes.toLocaleString()}`);
  
  // Save tree
  const outputPath = resolve(DATA_DIR, 'tree_ncbi.json');
  console.log(`Saving to ${outputPath}...`);
  await writeFile(outputPath, JSON.stringify(tree));
  
  console.timeEnd('ncbi-to-tree');
  console.log('\nNext steps:');
  console.log('1. Run: node tools/bake-layout.js');
  console.log('   (You may need to update bake-layout.js to read tree_ncbi.json)');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exitCode = 1;
});
