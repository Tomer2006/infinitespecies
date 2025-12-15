#!/usr/bin/env node
/**
 * Split a large taxonomy tree.json into a set of sharded JSON files for static hosting.
 *
 * Usage:
 *   node tools/split-tree.js --input tree.json --out data --max-bytes 300000 --max-children 2000
 *
 * Strategy:
 * - Emit manifest.json with a root stub { name, level, _leaves, _shard }
 * - Emit subtree files for paths. Each file contains a rooted node with immediate children.
 * - If a child subtree would make the file exceed max-bytes or exceed max-children,
 *   write the child as a stub with `_shard` pointing to its own file, and do not inline its children.
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { input: 'data/tree_deduped.json', out: 'data', maxBytes: 25000000, maxChildren: 1000000 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--input') out.input = args[++i];
    else if (a === '--out') out.out = args[++i];
    else if (a === '--max-bytes') out.maxBytes = parseInt(args[++i], 10);
    else if (a === '--max-children') out.maxChildren = parseInt(args[++i], 10);
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function pathFor(parts) {
  return parts.map(x => encodeURIComponent(String(x).replace(/\//g, '%2F'))).join('/');
}

function filenameFor(rootDir, parts) {
  return path.join(rootDir, pathFor(parts) + '.json');
}

function shallowCloneNode(n) {
  const { name, level, _leaves } = n;
  return { name, level, _leaves };
}

function shardNode(node, parts, cfg, writeFileCb) {
  const outNode = shallowCloneNode(node);
  outNode.children = [];
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const childParts = parts.concat([child.name]);
      // Estimate serialized sizes if inlined
      const childShallow = shallowCloneNode(child);
      childShallow.children = (child.children || []).map(grand => shallowCloneNode(grand));
      let projected = 2 + JSON.stringify(outNode).length + JSON.stringify(childShallow).length; // rough
      const tooBig = projected > cfg.maxBytes || outNode.children.length >= cfg.maxChildren;
      if (tooBig && child.children && child.children.length) {
        // Make stub with shard reference
        const stub = shallowCloneNode(child);
        stub._shard = 'data/' + pathFor(childParts) + '.json';
        outNode.children.push(stub);
        // Recurse to write child's own shard file
        shardNode(child, childParts, cfg, writeFileCb);
      } else {
        // Inline only one level of children as stubs to keep file small
        const inlined = shallowCloneNode(child);
        inlined.children = (child.children || []).map(gr => {
          const s = shallowCloneNode(gr);
          if (gr.children && gr.children.length) s._shard = 'data/' + pathFor(childParts.concat([gr.name])) + '.json';
          return s;
        });
        outNode.children.push(inlined);
        // Write deeper levels as their own shards if present
        if (child.children) {
          for (const gr of child.children) {
            if (gr.children && gr.children.length) shardNode(gr, childParts.concat([gr.name]), cfg, writeFileCb);
          }
        }
      }
    }
  }
  const filename = filenameFor(cfg.out, parts);
  ensureDir(path.dirname(filename));
  writeFileCb(filename, JSON.stringify(outNode));
}

function main() {
  const cfg = parseArgs();
  const text = fs.readFileSync(cfg.input, 'utf8');
  const root = JSON.parse(text);
  if (!root || typeof root !== 'object') throw new Error('Invalid root JSON');

  const writes = [];
  const writeFileCb = (f, s) => writes.push({ f, s });

  // Assume _leaves already present; otherwise compute simplistic counts
  function computeLeaves(n) {
    if (!n.children || n.children.length === 0) {
      n._leaves = n._leaves || 1;
      return n._leaves;
    }
    let t = 0;
    for (const c of n.children) t += computeLeaves(c);
    n._leaves = n._leaves || t;
    return n._leaves;
  }
  computeLeaves(root);

  shardNode(root, [root.name || 'Life'], cfg, writeFileCb);

  ensureDir(cfg.out);
  // Write files after to avoid partial tree on crash
  for (const w of writes) fs.writeFileSync(w.f, w.s);

  // Manifest with root shard stub
  const manifest = {
    root: { name: root.name || 'Life', level: root.level || 'Life', _leaves: root._leaves, _shard: 'data/' + pathFor([root.name || 'Life']) + '.json' }
  };
  fs.writeFileSync(path.join(cfg.out, 'manifest.json'), JSON.stringify(manifest));
  console.log(`Wrote ${writes.length} shard files to ${cfg.out}`);
}

if (require.main === module) {
  main();
}


