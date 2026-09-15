import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Removes duplicate leaf nodes from a nested tree structure until no duplicates remain.
 * 
 * When multiple leaf nodes have the same name (case-insensitive), ALL of them are removed
 * (not just keeping one). For example, if there are 2 leaf nodes named "X" and "x",
 * both will be removed because the comparison is case-insensitive.
 * 
 * Usage: node tools/remove-duplicate-leaf-nodes-from-tree.js [input.json] [output.json]
 */

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  const inputPath = resolve(process.cwd(), inputArg ?? 'data/tree_deduped.json');
  const defaultOutput = inputArg
    ? `${inputArg.replace(/\.json$/i, '')}_no_spans.json`
    : 'data/tree_deduped_no_spans.json';
  const outputPath = resolve(process.cwd(), outputArg ?? defaultOutput);

  console.time('remove-span-leaves');

  const raw = await readFile(inputPath, 'utf8');
  const root = JSON.parse(raw);

  let removed = 0;
  let passes = 0;

  // Removing leaves can turn their parents into new leaves. Repeat the count/prune
  // cycle until those newly exposed leaves contain no duplicate names either.
  while (true) {
    const leafCounts = new Map();
    const stack = [root];

    while (stack.length) {
      const node = stack.pop();
      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length === 0) {
        if (typeof node.name === 'string' && node.name.trim() !== '') {
          const key = node.name.toLowerCase();
          leafCounts.set(key, (leafCounts.get(key) ?? 0) + 1);
        }
        continue;
      }
      for (const child of children) {
        stack.push(child);
      }
    }

    let removedThisPass = 0;

    function prune(node) {
      const children = Array.isArray(node.children) ? node.children : [];
      if (children.length === 0) {
        const key = typeof node.name === 'string' ? node.name.toLowerCase() : '';
        if ((leafCounts.get(key) ?? 0) > 1) {
          removedThisPass++;
          return false;
        }
        return true;
      }

      node.children = children.filter(child => prune(child));
      return true;
    }

    prune(root);
    passes++;
    removed += removedThisPass;
    console.log(`Pass ${passes}: removed ${removedThisPass.toLocaleString()} duplicate leaf nodes.`);

    if (removedThisPass === 0) {
      break;
    }
  }

  await writeFile(outputPath, JSON.stringify(root));
  console.timeEnd('remove-span-leaves');
  console.log(`Removed ${removed.toLocaleString()} duplicate leaf nodes.`);
  console.log(`Tree stabilized after ${passes.toLocaleString()} passes.`);
  console.log(`Wrote cleaned tree to ${outputPath}`);
}

main().catch(err => {
  console.error('Failed to remove span leaves:', err);
  process.exitCode = 1;
});
