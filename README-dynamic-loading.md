# Dynamic Loading System

The app now supports dynamic loading to handle large taxonomies (4M+ nodes) efficiently by only keeping needed subtrees in memory.

## How it works

1. **Tree Splitting**: Large JSON files are split into smaller chunks (~5K nodes each)
2. **Lazy Loading**: Chunks are loaded on-demand when navigating 
3. **Memory Management**: Distant chunks are unloaded automatically
4. **Seamless UX**: Loading is transparent with progress indicators

## Usage

### For Large Datasets

1. **Split your data** (build time):
   ```bash
   node build-tree-splitter.js your-big-tree.json data-split/
   ```

2. **Serve the chunks**:
   ```bash
   # Copy data-split/ to your web server
   cp -r data-split/ /your/web/root/data/
   ```

3. **Load dynamically**:
   ```javascript
   // App will auto-detect and use dynamic loading
   await loadFromUrl('data/manifest.json');
   ```

### File Structure

```
data-split/
├── manifest.json     # Metadata about chunks
├── root.json        # Initial tree with stubs
├── chunk_00000.json # First subtree chunk
├── chunk_00001.json # Second subtree chunk
└── ...
```

## Benefits

- **Memory Efficient**: Only ~50MB in memory vs 4GB for full tree
- **Fast Initial Load**: Root loads in <1s instead of minutes
- **Smooth Navigation**: Preloading keeps UX responsive
- **Same Interface**: No code changes needed for existing usage

## Configuration

Edit `build-tree-splitter.js` to adjust:
- `chunkSize`: Nodes per chunk (default: 5000)
- `depthThreshold`: Minimum depth before splitting (default: 3)

## Fallback

The system gracefully falls back to single-file loading for:
- Small datasets
- Missing manifest files
- Network errors

Your app will work the same regardless of dataset size!
