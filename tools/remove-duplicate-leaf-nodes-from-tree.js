import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

  const leafCounts = new Map();

  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length === 0) {
      if (typeof node.name === 'string' && node.name.trim() !== '') {
        const key = node.name;
        leafCounts.set(key, (leafCounts.get(key) ?? 0) + 1);
      }
      continue;
    }
    for (const child of children) {
      stack.push(child);
    }
  }

  let removed = 0;

  function prune(node) {
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length === 0) {
      const occurrences = leafCounts.get(node.name) ?? 0;
      if (occurrences > 1) {
        removed++;
        return false;
      }
      return true;
    }

    node.children = children.filter(child => prune(child));
    return true;
  }

  prune(root);

  await writeFile(outputPath, JSON.stringify(root));
  console.timeEnd('remove-span-leaves');
  console.log(`Removed ${removed.toLocaleString()} duplicate leaf nodes.`);
  console.log(`Wrote cleaned tree to ${outputPath}`);
}

main().catch(err => {
  console.error('Failed to remove span leaves:', err);
  process.exitCode = 1;
});
