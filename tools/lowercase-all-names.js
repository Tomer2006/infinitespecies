import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Converts all node names to lowercase.
 * This should be run before capitalization to ensure consistent starting point.
 * 
 * Usage: node tools/lowercase-all-names.js [input.json] [output.json]
 */

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  const inputPath = resolve(process.cwd(), inputArg ?? 'data/tree.json');
  const defaultOutput = inputArg
    ? `${inputArg.replace(/\.json$/i, '')}_lowercase.json`
    : 'data/tree_lowercase.json';
  const outputPath = resolve(process.cwd(), outputArg ?? defaultOutput);

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.time('lowercase-names');

  const raw = await readFile(inputPath, 'utf8');
  const data = JSON.parse(raw);

  let count = 0;

  // Check if it's an array (flat format) or object (nested format)
  if (Array.isArray(data)) {
    // Flat format
    for (const node of data) {
      if (node.name && typeof node.name === 'string') {
        const original = node.name;
        // Convert to lowercase, but preserve structure like parentheses
        node.name = node.name.toLowerCase();
        if (original !== node.name) count++;
      }
    }
  } else {
    // Nested format - traverse recursively
    function processNode(node) {
      if (node.name && typeof node.name === 'string') {
        const original = node.name;
        // Convert to lowercase, but preserve structure like parentheses
        node.name = node.name.toLowerCase();
        if (original !== node.name) count++;
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          processNode(child);
        }
      }
    }
    processNode(data);
  }

  await writeFile(outputPath, JSON.stringify(data));
  
  console.timeEnd('lowercase-names');
  console.log(`Lowercased ${count.toLocaleString()} names.`);
  console.log(`Wrote to ${outputPath}`);
}

main().catch(err => {
  console.error('Failed to lowercase names:', err);
  process.exitCode = 1;
});
