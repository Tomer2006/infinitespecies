// Resolves a "Life/Bacteria/…" name path to a node. Shared by the browser
// (in-memory tree) and the taxonomy server (id arrays), hence the accessors.
//
// Thousands of taxon names contain "/" themselves ("Cyanobacteria/Melainabacteria
// Group"), so the path cannot simply be split on the separator: each step matches
// a whole child name against the start of what is left, backtracking if needed.
export function resolveNamePath(path, root, nameOf, childrenOf) {
  if (root == null) return null;
  const rest = String(path || '').replace(/^\/+/, '');
  if (!rest) return root;

  // Paths made by getNodePath() start with the root's own name; hand-written
  // ones may start at its children.
  const rootName = String(nameOf(root));
  if (rest === rootName) return root;
  if (rootName && rest.startsWith(`${rootName}/`)) {
    const found = descend(root, rest.slice(rootName.length + 1));
    if (found != null) return found;
  }
  return descend(root, rest);

  function descend(node, remaining) {
    if (!remaining) return node;
    const children = childrenOf(node);
    for (const child of children) {
      if (String(nameOf(child)) === remaining) return child;
    }
    for (const child of children) {
      const name = String(nameOf(child));
      if (!name || remaining.length <= name.length) continue;
      if (remaining[name.length] !== '/' || !remaining.startsWith(name)) continue;
      const found = descend(child, remaining.slice(name.length + 1));
      if (found != null) return found;
    }
    return null;
  }
}
