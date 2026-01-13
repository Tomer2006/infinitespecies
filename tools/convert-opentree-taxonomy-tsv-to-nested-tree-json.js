#!/usr/bin/env node
/**
 * Convert OpenTreeofLife taxonomy.tsv file to a nested tree structure.
 * 
 * Prerequisites:
 *   1. Download taxonomy.tsv from https://tree.opentreeoflife.org/about/taxonomy-version
 *   2. (Optional) Download synonyms.tsv from the same page for common names
 *   3. Place both files in data/opentree/ folder
 * 
 * Usage:
 *   node tools/convert-opentree-taxonomy-tsv-to-nested-tree-json.js
 * 
 * Input files (in data/opentree/):
 *   - taxonomy.tsv: ott_id | parent_id | name | rank | sources | unique_name | flags
 *   - synonyms.tsv (optional): ott_id | synonym | source (contains common names)
 * 
 * Output:
 *   - data/tree_opentree.json: Nested tree structure ready for bake-layout.js
 *   - Each node includes ottId field for matching with synonyms
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
    ottId: rootOttId,
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
        ottId: childOttId,
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
 * Check if a synonym is likely a common name based on source and pattern
 */
function isCommonName(synonym, source) {
  if (!synonym || synonym.length === 0) return false;
  
  const name = synonym.trim();
  
  // Sources that are typically scientific only - exclude these
  const scientificOnlySources = [
    'NCBI', 'NCBI Taxonomy', 'NCBI:txid', 'NCBI Taxonomy Browser',
    'Catalogue of Life', 'COL', 'ITIS', 'Integrated Taxonomic Information System'
  ];
  
  // If source is known to be scientific-only, skip it
  if (source && scientificOnlySources.some(s => source.toUpperCase().includes(s.toUpperCase()))) {
    return false;
  }
  
  // For all other sources (including GBIF, iNaturalist, Wikipedia, etc.),
  // use pattern matching to filter out scientific names
  // This is more permissive - we accept anything that doesn't look scientific
  return !isScientificNamePattern(name);
}

/**
 * Check if a name matches scientific name patterns
 */
function isScientificNamePattern(name) {
  if (!name || name.length === 0) return false;
  
  const words = name.trim().split(/\s+/);
  
  // Single word - could be either, but if it's capitalized and looks Latin, it's likely scientific
  if (words.length === 1) {
    const word = words[0];
    // If it's all lowercase or has unusual capitalization, likely common name
    if (word === word.toLowerCase() || word === word.toUpperCase()) {
      return false; // Likely common name
    }
    // If it starts with capital and looks like Latin (ends with common scientific suffixes)
    if (/^[A-Z][a-z]+(us|um|a|is|es|ae|i|ii|iii)$/i.test(word)) {
      return true; // Likely scientific genus
    }
    return false; // Default to common name for single words
  }
  
  // Check if it looks like binomial (genus species) - most reliable indicator
  if (words.length === 2) {
    const first = words[0];
    const second = words[1];
    // Scientific binomial: first word capitalized, second word lowercase
    if (first[0] === first[0].toUpperCase() && 
        first.slice(1) === first.slice(1).toLowerCase() &&
        second === second.toLowerCase()) {
      return true; // Likely scientific binomial
    }
  }
  
  // Three words - likely trinomial (subspecies) - scientific
  if (words.length === 3) {
    const first = words[0];
    const second = words[1];
    const third = words[2];
    if (first[0] === first[0].toUpperCase() && 
        first.slice(1) === first.slice(1).toLowerCase() &&
        second === second.toLowerCase() &&
        third === third.toLowerCase()) {
      return true; // Likely scientific trinomial
    }
  }
  
  // More than 3 words or doesn't match scientific patterns - likely common name
  return false;
}

/**
 * Parse synonyms.tsv and extract common names
 * Actual format: name | uid | type | uniqname | sourceinfo
 * Where: name = synonym, uid = OTT ID, sourceinfo = source
 */
async function parseSynonyms(filePath) {
  console.log('Parsing synonyms.tsv for common names...');
  const commonNames = new Map(); // ottId -> commonName
  
  if (!existsSync(filePath)) {
    console.log('  synonyms.tsv not found - skipping common names');
    return commonNames;
  }
  
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let count = 0;
  let commonNameCount = 0;
  let isFirstLine = true;
  
  for await (const line of rl) {
    // Skip header line
    if (isFirstLine && (line.startsWith('name') || line.startsWith('#') || line.trim() === '')) {
      isFirstLine = false;
      continue;
    }
    isFirstLine = false;
    
    // Parse tab-separated values with pipe separators (tab|tab format)
    // Format: name | uid | type | uniqname | sourceinfo
    let parts = line.split('\t|\t');
    if (parts.length < 2) {
      // Fall back to regular tabs
      parts = line.split('\t');
    }
    if (parts.length < 2) continue;
    
    const synonym = parts[0].trim();
    const ottId = parts[1].trim();
    const source = parts.length >= 5 ? parts[4].trim() : '';
    
    if (!ottId || ottId === '' || isNaN(parseInt(ottId, 10))) continue;
    if (!synonym || synonym.length === 0) continue;
    
    const ottIdNum = parseInt(ottId, 10);
    
    // Check if this looks like a common name (pass source for better detection)
    if (isCommonName(synonym, source)) {
      // Track if this is a new OTT ID we're adding
      const isNew = !commonNames.has(ottIdNum);
      
      // Only store if we don't have a common name for this OTT ID yet
      // or if this one is shorter (prefer shorter common names)
      if (isNew || (commonNames.get(ottIdNum).length > synonym.length)) {
        commonNames.set(ottIdNum, synonym);
        // Only increment count when we add a new OTT ID (not when replacing)
        if (isNew) {
          commonNameCount++;
        }
      }
    }
    
    count++;
    if (count % 500000 === 0) {
      console.log(`  Parsed ${count.toLocaleString()} synonyms, found ${commonNameCount.toLocaleString()} common names...`);
    }
  }
  
  console.log(`  Total synonyms: ${count.toLocaleString()}, common names: ${commonNameCount.toLocaleString()}`);
  return commonNames;
}

/**
 * Add common names to tree nodes and combine with scientific names
 * Format: "Common Name (Scientific Name)" or just "Scientific Name" if no common name
 * Returns the count of nodes that were actually modified
 */
function addCommonNamesToTree(node, commonNames) {
  if (!node) return 0;
  
  let modified = 0;
  
  // Combine common name with scientific name if available
  if (node.ottId && commonNames.has(node.ottId)) {
    const commonName = commonNames.get(node.ottId);
    const scientificName = node.name; // Original scientific name
    // Format: "Common Name (Scientific Name)"
    node.name = `${commonName} (${scientificName})`;
    modified = 1;
  }
  
  // Recursively process children
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      modified += addCommonNamesToTree(child, commonNames);
    }
  }
  
  return modified;
}

/**
 * Count nodes with common names (names that contain parentheses)
 */
function countNodesWithCommonNames(node) {
  // Check if name contains parentheses, indicating it has a common name combined
  let count = (node.name && node.name.includes('(') && node.name.includes(')')) ? 1 : 0;
  if (node.children) {
    for (const child of node.children) {
      count += countNodesWithCommonNames(child);
    }
  }
  return count;
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
  
  // Parse synonyms and add common names
  const synonymsPath = resolve(OPENTREE_DIR, 'synonyms.tsv');
  const commonNames = await parseSynonyms(synonymsPath);
  if (commonNames.size > 0) {
    console.log(`\nFound ${commonNames.size.toLocaleString()} unique OTT IDs with common names`);
    console.log('Adding common names to tree...');
    
    // Count how many OTT IDs from common names actually exist in the tree
    const treeOttIds = new Set();
    function collectOttIds(node) {
      if (node && node.ottId) {
        treeOttIds.add(node.ottId);
      }
      if (node && node.children) {
        for (const child of node.children) {
          collectOttIds(child);
        }
      }
    }
    collectOttIds(tree);
    const matchingOttIds = Array.from(commonNames.keys()).filter(id => treeOttIds.has(id));
    console.log(`  ${matchingOttIds.length.toLocaleString()} common names match OTT IDs in tree (out of ${treeOttIds.size.toLocaleString()} tree nodes)`);
    
    const nodesModified = addCommonNamesToTree(tree, commonNames);
    console.log(`  Added common names to ${nodesModified.toLocaleString()} nodes`);
  }
  
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
