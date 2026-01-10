import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Capitalizes the first letter of each word in node names.
 * Example: "homo sapiens" → "Homo Sapiens"
 * 
 * Usage: node tools/capitalize-names.js [input.json] [output.json]
 */

function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;
  
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  const inputPath = resolve(process.cwd(), inputArg ?? 'data/tree.json');
  const defaultOutput = inputArg
    ? `${inputArg.replace(/\.json$/i, '')}_capitalized.json`
    : 'data/tree_capitalized.json';
  const outputPath = resolve(process.cwd(), outputArg ?? defaultOutput);

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.time('capitalize-names');

  const raw = await readFile(inputPath, 'utf8');
  const data = JSON.parse(raw);

  let count = 0;

  // Check if it's an array (flat format) or object (nested format)
  if (Array.isArray(data)) {
    // Flat format
    for (const node of data) {
      if (node.name) {
        const original = node.name;
        node.name = toTitleCase(node.name);
        if (original !== node.name) count++;
      }
    }
  } else {
    // Nested format - traverse recursively
    function processNode(node) {
      if (node.name) {
        const original = node.name;
        node.name = toTitleCase(node.name);
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
  
  console.timeEnd('capitalize-names');
  console.log(`Capitalized ${count.toLocaleString()} names.`);
  console.log(`Wrote to ${outputPath}`);
}

main().catch(err => {
  console.error('Failed to capitalize names:', err);
  process.exitCode = 1;
});
