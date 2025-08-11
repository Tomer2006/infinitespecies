# Data Processing Tools

## split_tree.py

Splits large taxonomy JSON files into multiple smaller files to work around GitHub's 50MB file size limit and browser memory constraints.

### Usage

```bash
# Basic usage - split tree.json into ~15MB chunks
python split_tree.py tree.json

# Specify output directory and chunk size
python split_tree.py tree.json --output data --size 10

# Help
python split_tree.py --help
```

### Arguments

- `input_file`: Path to the large JSON file to split
- `-o, --output`: Output directory (default: `data`)
- `-s, --size`: Maximum size per file in MB (default: 15)
- `-v, --verbose`: Verbose output

### Output

Creates a directory structure like:
```
data/
├── manifest.json           # File list and metadata
├── tree_part_000_root.json # Root node and some children
├── tree_part_001_*.json    # Additional chunks
└── tree_part_002_*.json
```

### Algorithm

1. **Size estimation**: Uses JSON serialization to estimate file sizes
2. **Smart splitting**: Tries to keep related nodes together while respecting size limits
3. **Recursive splitting**: Large subtrees are split further if needed
4. **Manifest generation**: Creates metadata for the loader to reconstruct the tree

### Performance Tips

- **10-15MB chunks**: Optimal for most hosting services
- **Keep under 50MB**: Required for GitHub
- **Fewer files**: Better for CDN/caching, but larger downloads
- **More files**: Better parallelism, but more HTTP requests

The app's loader automatically detects and merges split files transparently.
