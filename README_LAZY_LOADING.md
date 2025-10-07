# Taxonomy Explorer - Lazy Loading Architecture

This document explains how to use the new lazy loading feature for handling large taxonomy datasets efficiently.

## Overview

The lazy loading system allows Taxonomy Explorer to handle datasets of virtually any size by only loading the data that's currently needed for display. Instead of loading entire 300MB+ JSON files at once, it loads a lightweight manifest first, then fetches branch data on-demand.

## How It Works

### Data Structure

Lazy loading uses a manifest file (`manifest.json`) that contains:
- The root structure of the taxonomy
- References to separate chunk files for major branches
- Metadata about the dataset

Example `manifest.json`:
```json
{
  "name": "Life",
  "level": 0,
  "children": [
    {
      "name": "Animalia",
      "lazy": true,
      "id": "animalia_chunk.json"
    },
    {
      "name": "Plantae",
      "lazy": true,
      "id": "plantae_chunk.json"
    }
  ],
  "version": "lazy-1.0"
}
```

Each chunk file contains the actual subtree data:
```json
{
  "name": "Animalia",
  "level": 1,
  "children": [
    {
      "name": "Chordata",
      "children": [...]
    }
  ]
}
```

### Automatic Loading

The system automatically loads branch data when:
- You zoom in close enough to see the details (based on screen size)
- You click on a node that hasn't been loaded yet

## Converting Your Dataset

Use the provided Python script to convert your nested JSON tree:

```bash
python tools/convert_to_lazy.py your_data.json output_directory/
```

Options:
- `--min-children N`: Minimum children count to split into separate file (default: 10)
- `--max-depth D`: Maximum depth to split (default: 3)

Example:
```bash
# Convert a 300MB tree with aggressive splitting
python tools/convert_to_lazy.py taxonomy_300mb.json data/ --min-children 5 --max-depth 4
```

## Using Lazy Loading

### Automatic Mode (Recommended)
1. Place your `manifest.json` and chunk files in a `data/` directory
2. Start the application - it will automatically detect and use lazy loading
3. The landing page has a checkbox to enable/disable lazy loading

### Manual Mode Selection
You can force eager loading (old behavior) by unchecking "Enable lazy loading" on the landing page.

### URL Parameter
You can also specify loading mode via URL:
```
https://your-app.com/?data=data/manifest.json&mode=lazy
https://your-app.com/?data=data/manifest.json&mode=eager
```

## Benefits

- **Fast Initial Load**: Only loads essential structure first
- **Low Memory Usage**: Only keeps viewed branches in memory
- **Scalable**: Handles datasets of any size
- **Backward Compatible**: Still works with single JSON files
- **Automatic**: No user interaction required for loading

## Technical Details

### State Management
- `state.dataBaseUrl`: Stores the base path for chunk files
- `state.loadMode`: 'auto', 'lazy', or 'eager'
- `state.subtreeCache`: Caches loaded branches to avoid re-fetching
- `state.autoLoadThreshold`: Screen radius threshold for automatic loading

### Performance Tuning
- Automatic loading triggers when nodes reach 50px screen radius
- Maximum 2 concurrent chunk loads to prevent network congestion
- Intelligent caching prevents redundant requests

### Fallback Behavior
- If no manifest is found, falls back to single-file loading
- If lazy mode is requested but only split-files manifest exists, uses eager loading
- Network errors are handled gracefully with retry logic

## Troubleshooting

### Common Issues
1. **Chunk files not loading**: Check that `dataBaseUrl` is set correctly and chunk files exist
2. **Memory still high**: Ensure you're using lazy mode and not forcing eager loading
3. **Slow initial load**: The manifest itself might be too large - try increasing `--min-children`

### Debug Information
Check browser console for messages like:
- "Loading lazy manifest..."
- "Loading subtree from [URL]..."
- "Auto-load failed for node: [name]"
