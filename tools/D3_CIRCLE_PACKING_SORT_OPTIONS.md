# D3 Circle Packing Sort Order Options

This document describes different ways to order nodes in D3 circle packing layouts and their trade-offs.

## Current Implementation

Your current code uses:
```javascript
.sort((a, b) => b.value - a.value)  // Descending by value (largest first)
```

With `.sum()` assigning:
- `1` to leaf nodes (nodes with no children)
- `0` to internal nodes (nodes with children)

## Sorting Strategies

### 1. **By Value (Descending) - CURRENT** ✅ Recommended for most cases
```javascript
.sort((a, b) => b.value - a.value)
```
**Best for:** General taxonomy visualization
- **Pros:** Largest groups appear first, better space utilization, intuitive hierarchy
- **Cons:** May cluster similar-sized groups together
- **Use case:** When you want to emphasize groups with more descendants

### 2. **By Value (Ascending)**
```javascript
.sort((a, b) => a.value - b.value)
```
**Best for:** Emphasizing smaller groups
- **Pros:** Smaller groups get priority placement
- **Cons:** Less efficient space usage, larger groups may be pushed to edges
- **Use case:** When you want to highlight rare or small taxonomic groups

### 3. **By Name (Alphabetical)**
```javascript
.sort((a, b) => {
  const nameA = a.data.name || '';
  const nameB = b.data.name || '';
  return nameA.localeCompare(nameB);
})
```
**Best for:** Predictable, searchable layouts
- **Pros:** Consistent ordering, easy to find specific taxa, stable across runs
- **Cons:** Doesn't reflect size/importance, may create visual clusters of unrelated groups
- **Use case:** When users need to find specific organisms by name

### 4. **By Depth (Shallow First)**
```javascript
.sort((a, b) => a.depth - b.depth)
```
**Best for:** Emphasizing higher taxonomic levels
- **Pros:** Higher-level groups (kingdoms, phyla) appear first
- **Cons:** May not reflect actual group sizes
- **Use case:** Educational contexts where taxonomic hierarchy is important

### 5. **By Depth (Deep First)**
```javascript
.sort((a, b) => b.depth - a.depth)
```
**Best for:** Emphasizing species-level detail
- **Pros:** Species appear first, more detail visible
- **Cons:** Higher levels may be less prominent
- **Use case:** When focusing on species-level exploration

### 6. **By Descendant Count (Total Leaves)**
```javascript
// First, compute total descendants for each node
function countDescendants(d) {
  if (!d.children || d.children.length === 0) return 1;
  return d.children.reduce((sum, child) => sum + countDescendants(child), 0);
}

// Then sort by descendant count
.sort((a, b) => {
  const countA = countDescendants(a);
  const countB = countDescendants(b);
  return countB - countA; // Descending
})
```
**Best for:** Reflecting actual taxonomic diversity
- **Pros:** Most accurate representation of group importance
- **Cons:** Requires pre-computation, more complex
- **Use case:** When you want circles sized by actual number of species

### 7. **By Number of Children (Direct Children Only)**
```javascript
.sort((a, b) => {
  const childrenA = (a.children || []).length;
  const childrenB = (b.children || []).length;
  return childrenB - childrenA; // Descending
})
```
**Best for:** Emphasizing branching structure
- **Pros:** Groups with more immediate subdivisions are prioritized
- **Cons:** Doesn't account for total diversity
- **Use case:** When studying taxonomic branching patterns

### 8. **Multi-Criteria Sort (Recommended for Taxonomy)**
```javascript
.sort((a, b) => {
  // Primary: by value (descendant count)
  if (b.value !== a.value) {
    return b.value - a.value;
  }
  // Secondary: by name (alphabetical) for stability
  const nameA = a.data.name || '';
  const nameB = b.data.name || '';
  return nameA.localeCompare(nameB);
})
```
**Best for:** Balanced, stable layouts
- **Pros:** Combines size-based ordering with predictable tie-breaking
- **Cons:** Slightly more complex
- **Use case:** Production systems needing consistent, predictable layouts

### 9. **Random Order**
```javascript
.sort(() => Math.random() - 0.5)
```
**Best for:** Testing, exploration
- **Pros:** Can reveal unexpected patterns
- **Cons:** Unpredictable, not reproducible
- **Use case:** Not recommended for production

### 10. **By Custom Property (e.g., Taxonomic Rank)**
```javascript
// If your data has a 'rank' property with numeric priority
const rankOrder = {
  'species': 1,
  'genus': 2,
  'family': 3,
  'order': 4,
  'class': 5,
  'phylum': 6,
  'kingdom': 7,
  'domain': 8
};

.sort((a, b) => {
  const rankA = rankOrder[a.data.rank] || 99;
  const rankB = rankOrder[b.data.rank] || 99;
  return rankA - rankB; // Lower rank number = higher priority
})
```
**Best for:** Taxonomic rank-based visualization
- **Pros:** Respects taxonomic hierarchy
- **Cons:** Requires rank data in your tree
- **Use case:** When taxonomic rank is important

## Recommendations

### For Taxonomy Trees (Your Use Case):
**Best: Option 1 (Current) or Option 8 (Multi-criteria)**

1. **Option 1 (Current)** - Simple and effective:
   ```javascript
   .sort((a, b) => b.value - a.value)
   ```
   ✅ Good space utilization
   ✅ Intuitive (larger groups = larger circles)
   ✅ Fast computation

2. **Option 8 (Multi-criteria)** - More stable:
   ```javascript
   .sort((a, b) => {
     if (b.value !== a.value) return b.value - a.value;
     return (a.data.name || '').localeCompare(b.data.name || '');
   })
   ```
   ✅ Same benefits as Option 1
   ✅ Plus: Deterministic ordering (same input = same output)
   ✅ Better for version control and reproducibility

### Alternative: Option 6 (By Descendant Count)
If you want circles sized by actual number of species (not just leaves), you'd need to:
1. Pre-compute total descendants for each node
2. Use that count in `.sum()` instead of just 1/0
3. Sort by that value

## Implementation Notes

### Current `.sum()` Strategy:
```javascript
.sum(d => {
  const children = d.children;
  return (Array.isArray(children) && children.length > 0) ? 0 : 1;
})
```
This gives each leaf node a value of 1, and internal nodes get the sum of their children.

### Alternative `.sum()` Strategies:

**Count all descendants:**
```javascript
.sum(d => {
  // Count total descendants (leaves)
  function countLeaves(node) {
    if (!node.children || node.children.length === 0) return 1;
    return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
  }
  return countLeaves(d);
})
```

**Weight by depth:**
```javascript
.sum(d => {
  // Deeper nodes get less weight
  const depth = d.depth || 0;
  const baseValue = (!d.children || d.children.length === 0) ? 1 : 0;
  return baseValue * Math.pow(0.9, depth); // Exponential decay
})
```

## Performance Considerations

- **Simple sorts** (by value, name): O(n log n) - Fast
- **Complex sorts** (descendant counting): O(n²) in worst case - Slower for large trees
- **Multi-criteria sorts**: O(n log n) - Fast, but slightly slower than single criteria

For 4.5 million nodes, stick with simple sorts (Options 1-5) for best performance.

## Testing Different Orders

To test different sort orders, modify the `.sort()` call in your layout computation script:

```javascript
// In compute-d3-circle-packing-layout-from-opentree-tree.js
const root = d3hierarchy(tree)
  .sum(d => {
    const children = d.children;
    return (Array.isArray(children) && children.length > 0) ? 0 : 1;
  })
  .sort((a, b) => {
    // Try different sort functions here
    return b.value - a.value; // Current
    // return a.data.name.localeCompare(b.data.name); // Alphabetical
    // return a.depth - b.depth; // By depth
  });
```

Then re-run the layout computation script to see the visual difference.
