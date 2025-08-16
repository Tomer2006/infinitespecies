## BioZoom - Taxonomy Explorer

Interactive circle-packing visualization for exploring biological taxonomy data, powered by D3.js. Navigate from high-level domains down to individual species with smooth zooming, search capabilities, and integrated web resources.

### 🌐 Live Demo
- **Production**: [biozoom.netlify.app](https://biozoom.netlify.app/)
- Features real NCBI taxonomy data with millions of organisms

### ✨ Key Features
- **🔍 Zoomable Interface**: Smooth circle-packing visualization from Life down to Species level
- **🚀 Large Dataset Support**: Handles millions of taxonomy nodes via intelligent data splitting
- **🔎 Smart Search**: Multi-result dropdown with visual highlighting and quick navigation  
- **🌐 External Integration**: Quick access to Google, Wikipedia, GBIF, NCBI, CoL, and iNaturalist
- **📱 Responsive Design**: Works on desktop and mobile devices
- **🔗 Deep Linking**: Share exact views via URL - every navigation state is preserved
- **⚡ Performance Optimized**: Lazy loading and efficient rendering for massive datasets

### 🚀 Quick Start
**Option 1 - Direct File Access:**
```bash
# Open index.html directly in browser, then use "Load JSON" for custom data
```

**Option 2 - Local Server (Recommended):**
```bash
# Python 3
python -m http.server 8080

# Node.js  
npx http-server -p 8080

# Then visit: http://localhost:8080/
```

### Controls
- **Left Click**: Zoom into a group
- **Right Click**: Zoom to parent
- **Mouse Wheel**: Smooth zoom
- **Middle Drag**: Pan
- **Enter**: Search; pick a result to jump
- **S**: Web search hovered/current node
- **R**: Reset to root
- **F**: Fit hovered/current node in view
- **P**: Pin/unpin image preview
- **? / F1**: Toggle help

### UI overview
- **Top bar**:
  - `Load JSON`: paste or upload a JSON file
  
  - Provider select + `Web Search`: open selected provider for hovered/current node
  - Search field: find by name (supports partial matches)
  - `Surprise Me`: jump to a random deepest leaf
  - `Fit`: fit hovered/current node into view
  - `Copy Link`: copy a deep link to the current view (URL hash)
  - `Reset`: back to root
- **Breadcrumbs**: click any crumb to navigate up (also updates the URL hash for deep linking)

### 📊 Data Loading & Management

**Automatic Loading Priority:**
1. URL parameter: `?data=https://example.com/taxonomy.json`
2. **Split files**: `data/manifest.json` (recommended for large datasets)
3. Local files: `tree.json`, `taxonomy.json`, `data.json`
4. Manual upload via "Load JSON" button

#### 📋 Supported Data Formats

**1. Structured Nodes (Recommended):**
```json
{
  "name": "Life", 
  "level": 0,
  "children": [
    {
      "name": "Eukaryota", 
      "level": 1,
      "children": [...]
    }
  ]
}
```

**2. Nested Object Format (Auto-converted):**
```json
{
  "Life": {
    "Eukaryota": {
      "Animalia": {
        "Chordata": {
          "Mammalia": {
            "Homo sapiens": {}
          }
        }
      }
    }
  }
}
```

**Notes:**
- **Level inference**: If `level` is missing, it's automatically calculated by depth (0=Life, 1=Domain, 2=Kingdom, etc.)
- **Flexible structure**: Leaves can be empty objects `{}` or nodes without `children` array
- **Unicode support**: Full support for scientific names and international characters

#### 🗂️ Custom Data Import
- **Manual upload**: Click "Load JSON" → paste content or select `.json` file → "Parse & Load"
- **URL loading**: `index.html?data=https%3A%2F%2Fexample.com%2Ftaxonomy.json`
- **Real-time validation**: Immediate feedback on JSON structure and format issues

#### 🚀 Large Dataset Handling (Production-Ready)

This application is optimized for **massive taxonomy datasets** (millions of nodes). The current deployment uses **75 split files** totaling several hundred MB of NCBI taxonomy data.

**Current Split Configuration:**
- **75 files** ranging from 0.01MB to 15.32MB each
- **Intelligent splitting** by taxonomic depth and size
- **Parallel loading** with progress tracking
- **Seamless merging** - appears as single dataset to user

**Technical Details:**
- **Max file size**: 5-15MB per chunk (optimal for web delivery)
- **Path-based splitting**: Files split along natural taxonomy boundaries
- **Lazy loading ready**: Architecture supports on-demand subtree loading
- **CDN optimized**: Perfect for Netlify, GitHub Pages, or similar platforms

**Benefits:**
- ✅ **No browser memory limits**: Handles datasets that crash single-file approaches
- ✅ **Fast initial load**: Progressive loading with visual feedback  
- ✅ **Git-friendly**: No large files that break repository limits
- ✅ **Bandwidth efficient**: Only loads needed data chunks

### 🔧 Technical Architecture

**Core Visualization Engine:**
- **D3.js Pack Layout**: Hierarchical circle packing with size proportional to descendant count
- **Smart Label Rendering**: Dynamic label placement with collision avoidance and size-based priority
- **Smooth Camera System**: Hardware-accelerated pan/zoom with easing and momentum
- **Efficient Hit Testing**: Fast mouse interaction with spatial indexing

**Performance Optimizations:**
- **Subtree Pruning**: Hierarchical traversal skips entire subtrees when nodes are too small on screen
- **Viewport Culling**: Whole circles culled when off-screen
- **Level-of-Detail**: Labels only render when circles are large enough
- **Canvas-Based Rendering**: Direct 2D canvas with opaque context to reduce compositing
- **DPR Clamp**: Caps devicePixelRatio for stability on HiDPI screens
- **Work Caps**: Hard caps on max nodes per frame and max labels per frame

### 📁 Project Structure

```
biozoom/
├── index.html              # Main application entry point
├── styles.css              # Global styles and theme
├── app-modular.js          # Application bootstrap (ES modules)
├── data/                   # Dataset files (75 split JSON files)
│   ├── manifest.json       # Split file metadata and loading order  
│   └── tree_part_*.json    # Taxonomy data chunks (0.01MB - 15MB each)
└── modules/                # Modular JavaScript architecture
    ├── constants.js        # Configuration, color palettes, thresholds
    ├── state.js           # Central state management and node indexing
    ├── data.js            # Data loading, parsing, and transformation
    ├── canvas.js          # Canvas setup, sizing, and rendering context
    ├── layout.js          # D3 pack layout and coordinate calculations
    ├── camera.js          # Pan/zoom camera system with animations
    ├── render.js          # Main rendering engine (circles, labels, highlights)
    ├── picking.js         # Mouse interaction and hit detection
    ├── navigation.js      # Breadcrumbs, navigation, and view management
    ├── search.js          # Local search with highlighting and filtering
    ├── deeplink.js        # URL state management and sharing
    ├── providers.js       # External service integration (Wikipedia, NCBI, etc.)
    ├── preview.js         # Image previews and thumbnails
    ├── tooltip.js         # Interactive tooltips and hover effects
    ├── loading.js         # Progress tracking and loading states
    ├── events.js          # Input handling (mouse, keyboard, touch)
    ├── images.js          # Image loading and caching
    ├── help.js            # Help system and user guidance
    └── dom.js             # DOM element references and utilities
```

**Key Design Principles:**
- **🧩 Modular Architecture**: Each feature is a self-contained ES module
- **🎯 Separation of Concerns**: Clear boundaries between data, rendering, and interaction
- **⚡ Performance First**: Optimized for large datasets and smooth interactions
- **📱 Progressive Enhancement**: Works on all devices with graceful degradation

### 🔗 Deep Linking & Sharing

The application automatically tracks your navigation state in the URL for seamless sharing:

- **URL Format**: `#/Life/Eukaryota/Animalia/Chordata/Mammalia/...`
- **Share anywhere**: Use "Copy Link" button to get a shareable URL
- **Bookmark-friendly**: Every view is a unique, restorable URL
- **Path validation**: Automatically handles invalid or outdated paths

**Examples:**
- `#/` - Root view (Life)
- `#/Life/cellular%20organisms/Eukaryota` - Navigate to Eukaryotes
- `#/Life/cellular%20organisms/Eukaryota/Opisthokonta/Metazoa` - Jump to Animals

### 🛠️ Troubleshooting

**Common Issues:**

| Problem | Solution |
|---------|----------|
| **CORS/Fetch Errors** | Run a local server (see Quick Start). File:// protocol blocks network requests |
| **Performance Issues** | Zoom in closer - labels only render when circles are sufficiently large |
| **JSON Parse Errors** | Use "Load JSON" modal - it shows detailed error messages with line numbers |
| **Missing External Links** | Check browser pop-up blocker - external search opens in new tabs |
| **Mobile Performance** | Try smaller datasets or use WiFi - mobile browsers have memory limits |

**Performance Tips:**
- **Large datasets**: Zoom to specific areas rather than viewing the entire tree
- **Smooth navigation**: Use breadcrumbs for fast level-jumping
- **Search efficiency**: Use partial matches - search is real-time and case-insensitive

### 🎯 Use Cases

**Research & Education:**
- **Taxonomy Exploration**: Navigate NCBI's complete tree of life
- **Educational Tool**: Visual learning aid for biological classification  
- **Research Reference**: Quick access to external databases (GBIF, NCBI, etc.)

**Data Visualization:**
- **Custom Hierarchies**: Import your own nested data structures
- **Corporate Org Charts**: Visualize company structures or project hierarchies
- **Geographic Data**: Country/state/city hierarchical exploration

### 🤝 Contributing

BioZoom follows modern web development practices:

- **ES Modules**: Clean, modular architecture
- **Vanilla JavaScript**: No heavy frameworks - just D3.js for visualization
- **Progressive Enhancement**: Works without JavaScript for basic functionality
- **Accessibility**: Keyboard navigation and screen reader support

### 📄 License

MIT License - feel free to use, modify, and distribute.

---

**Built with ❤️ for the scientific community**
