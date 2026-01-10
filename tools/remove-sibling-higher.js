import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Removes "sibling_higher" nodes from flat JSON format (with id/parent_id).
 * Children of sibling_higher nodes are re-parented to the sibling_higher's parent.
 * 
 * Usage: node tools/remove-sibling-higher.js [input.json] [output.json]
 */

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  const inputPath = resolve(process.cwd(), inputArg ?? 'data/tree.json');
  const defaultOutput = inputArg
    ? `${inputArg.replace(/\.json$/i, '')}_no_sibling_higher.json`
    : 'data/tree_no_sibling_higher.json';
  const outputPath = resolve(process.cwd(), outputArg ?? defaultOutput);

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.time('remove-sibling-higher');

  const raw = await readFile(inputPath, 'utf8');
  const data = JSON.parse(raw);

  // Check if it's an array (flat format) or object (nested format)
  if (Array.isArray(data)) {
    // Flat format with id/parent_id
    processFlat(data);
  } else if (data.children) {
    // Nested format
    processNested(data);
  } else {
    console.log('Unknown data format');
    return;
  }

  await writeFile(outputPath, JSON.stringify(data));
  console.timeEnd('remove-sibling-higher');
  console.log(`Wrote cleaned tree to ${outputPath}`);
}

function processFlat(nodes) {
  // Build a map of id -> node for quick lookup
  const nodeMap = new Map();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Find all sibling_higher nodes
  const siblingHigherIds = new Set();
  const siblingHigherParents = new Map(); // sibling_higher id -> its parent_id
  
  for (const node of nodes) {
    if (node.name === 'sibling_higher') {
      siblingHigherIds.add(node.id);
      siblingHigherParents.set(node.id, node.parent_id);
    }
  }

  console.log(`Found ${siblingHigherIds.size} "sibling_higher" nodes.`);

  // Re-parent children of sibling_higher nodes
  let reParentedCount = 0;
  for (const node of nodes) {
    if (siblingHigherIds.has(node.parent_id)) {
      // This node's parent is a sibling_higher - re-parent to grandparent
      const grandparentId = siblingHigherParents.get(node.parent_id);
      node.parent_id = grandparentId;
      reParentedCount++;
    }
  }

  console.log(`Re-parented ${reParentedCount} children to grandparent level.`);

  // Remove sibling_higher nodes from the array
  let i = nodes.length;
  while (i--) {
    if (siblingHigherIds.has(nodes[i].id)) {
      nodes.splice(i, 1);
    }
  }

  console.log(`Removed ${siblingHigherIds.size} "sibling_higher" nodes from array.`);
}

function processNested(root) {
  let removedCount = 0;
  let promotedCount = 0;

  function processNode(node) {
    if (!node.children || !Array.isArray(node.children) || node.children.length === 0) {
      return;
    }

    // First, recursively process all children (depth-first)
    for (const child of node.children) {
      processNode(child);
    }

    // Now handle sibling_higher nodes at this level
    const newChildren = [];
    
    for (const child of node.children) {
      if (child.name === 'sibling_higher') {
        removedCount++;
        if (child.children && Array.isArray(child.children)) {
          for (const grandchild of child.children) {
            newChildren.push(grandchild);
            promotedCount++;
          }
        }
      } else {
        newChildren.push(child);
      }
    }

    node.children = newChildren;
  }

  processNode(root);
  
  console.log(`Removed ${removedCount} "sibling_higher" nodes.`);
  console.log(`Promoted ${promotedCount} children to parent level.`);
}

main().catch(err => {
  console.error('Failed to remove sibling_higher nodes:', err);
  process.exitCode = 1;
});
