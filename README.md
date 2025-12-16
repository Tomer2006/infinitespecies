# 🌿 infinitespecies

Welcome to **infinitespecies**! 🧬 An interactive circle-packing visualization for exploring biological taxonomy data, powered by D3.js. Navigate from high-level domains down to individual species with smooth zooming, search capabilities, and integrated web resources. 🎯

## 📋 Table of Contents

- [🌐 Live Demo](#-live-demo)
- [✨ Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
- [🎮 Controls](#-controls)
- [🖥️ UI Overview](#️-ui-overview)
- [📊 Data Loading & Management](#-data-loading--management)
- [🔧 Technical Architecture](#-technical-architecture)
- [🔗 Deep Linking & Sharing](#-deep-linking--sharing)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [🎯 Use Cases](#-use-cases)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🌐 Live Demo
- **🌐 Live Site**: Visit [https://infinitespecies.netlify.app/](https://infinitespecies.netlify.app/) 🚀
- **💻 Local Development**: Run `python -m http.server 8000` and visit `http://localhost:8000`
- Features interactive taxonomy visualization with custom data loading 📊

## ✨ Key Features

- 🌍 **Landing Page**: Choose between starting exploration or loading custom data (configurable UI options)
- 🔍 **Zoomable Interface**: Smooth circle-packing visualization with mouse and keyboard controls
- 🔎 **Smart Search**: Real-time search with multi-result dropdown and navigation
- 🖼️ **Image Previews**: Wikipedia thumbnails for hovered organisms
- 🧭 **Informative Tooltips**: Shows name, level, descendants, children, and ID
- 🌐 **External Integration**: Quick access to Google, Wikipedia, GBIF, NCBI, CoL, and iNaturalist
- 🔗 **Deep Linking**: Share exact views via URL hash - every navigation state is preserved
- 📊 **Custom Data Support**: Load your own JSON taxonomy data
- ⚙️ **Configurable UI**: Customize which buttons appear on the landing page

### 🚀 Quick Start

**Quick Start:** 🖥️
```bash
# Start a local web server
python -m http.server 8000

# Then visit: http://localhost:8000/ 🌐
```

**Windows (PowerShell) note:** 💡
- If you see "The token '&&' is not a valid statement" error, run commands on separate lines:
  - First: `cd C:\Users\<you>\Documents\infinitespecies` 📂
  - Then: `python -m http.server 8000` ▶️

### 🎮 Controls

- **🖱️ Left Click**: Zoom into a group 🔍
- **🖱️ Right Click**: Zoom to parent ⬆️
- **🖱️ Mouse Wheel**: Smooth zoom 🔄
- **🖱️ Middle Drag**: Pan 📍
- **⌨️ S**: Web search for hovered/current organism
- **⌨️ R**: Reset to root view
- **⌨️ F**: Fit current node in view
- **⌨️ ?**: Toggle help overlay

### 🖥️ UI Overview

- **🌍 Landing Page**: Choose between "Start Exploration" (loads default data), "Load Custom Data", or test data options (configurable)
- **📋 Top bar** (after starting):
  - `🏠 Menu`: Return to landing page
  - `📤 Load JSON`: paste or upload custom JSON taxonomy data
  - `🔗 Provider select + 🌐 Web Search`: open selected provider for hovered/current node
  - `🔍 Search field`: find by name (supports partial matches)
  - `🎲 Surprise Me`: jump to a random deepest leaf
  - `👁️ Fit`: fit hovered/current node into view
  - `📋 Copy Link`: copy a deep link to the current view (URL hash)
  - `🔄 Reset`: back to root
- **🍞 Breadcrumbs**: click any crumb to navigate up (also updates the URL hash for deep linking)
- **💬 Tooltip**: shows organism name, level, descendants count, children count, and ID

### ⚙️ Configuration

Customize the landing page UI by editing `modules/settings.js`:

```javascript
startPage: {
  showLazyLoadButton: false,      // Show/hide lazy loading button
  showEagerLoadButton: true,      // Show/hide eager loading button
  showTestDataButton: false,      // Show/hide test data buttons
  defaultLoadMode: 'eager'        // Default loading mode ('lazy' or 'eager')
}
```

This allows you to tailor the user experience for different deployment scenarios.

### 📊 Data Loading & Management

**Automatic Loading Priority:** 📋
1. 🌐 **URL parameter**: `?data=https://example.com/taxonomy.json`
2. 📦 **Split files**: `data/manifest.json` (recommended for large datasets)
3. 💾 **Local files**: `tree.json`, `taxonomy.json`, `data.json`
4. 👆 **Manual upload** via "Load JSON" button

#### 📋 Supported Data Formats

**1. 🏗️ Structured Nodes (Recommended):** ⭐
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

**2. 🔄 Nested Object Format (Auto-converted):** ♻️
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

**📝 Notes:**
- 🧮 **Level inference**: If `level` is missing, it's automatically calculated by depth (0=Life, 1=Domain, 2=Kingdom, etc.)
- 🔧 **Flexible structure**: Leaves can be empty objects `{}` or nodes without `children` array
- 🌍 **Unicode support**: Full support for scientific names and international characters

#### 🗂️ Custom Data Import

- 📤 **Manual upload**: Click "Load JSON" → paste content or select `.json` file → "Parse & Load"
- 🌐 **URL loading**: `index.html?data=https%3A%2F%2Fexample.com%2Ftaxonomy.json`
- ✅ **Real-time validation**: Immediate feedback on JSON structure and format issues

#### 🚀 Large Dataset Handling

This application supports **large taxonomy datasets** 📊 through intelligent data splitting and progressive loading. The current demo uses **5 split files** 📦 totaling ~110MB of taxonomy data. 🧬

**Current Split Configuration:** ⚙️
- 📄 **5 files** ranging from 15-25MB each
- 🧠 **Taxonomic splitting** by data size and structure
- ⚡ **Parallel loading** with progress tracking
- 🔗 **Seamless merging** - appears as single dataset to user

**Technical Details:** 🔧
- 📏 **Chunk size**: 15-25MB per file (optimal for web delivery)
- 📊 **Progressive indexing**: Background processing with memory management
- 💾 **Efficient memory usage**: Optimized data structures and cleanup
- ☁️ **Web-ready**: Suitable for static hosting platforms

### 🔧 Technical Architecture

**Core Visualization Engine:** ⚙️
- 📊 **D3.js Pack Layout**: Hierarchical circle packing with size proportional to descendant count
- 🏷️ **Smart Label Rendering**: Dynamic label placement with collision avoidance and size-based priority
- 🎥 **Smooth Camera System**: Hardware-accelerated pan/zoom with easing and momentum
- 🎯 **Efficient Hit Testing**: Fast mouse interaction with spatial indexing

**Performance Optimizations:** ⚡
- 🌳 **Subtree Pruning**: Hierarchical traversal skips entire subtrees when nodes are too small on screen
- 👁️ **Viewport Culling**: Whole circles culled when off-screen
- 📏 **Level-of-Detail**: Three-tier LOD system (detail/medium/simple/skip) based on screen size
- 🎨 **Canvas-Based Rendering**: Direct 2D canvas with optimized state management
- 🔒 **DPR Clamp**: Caps devicePixelRatio for stability on HiDPI screens
- ⏱️ **Work Caps**: Hard caps on max nodes per frame (9000) and max labels per frame (180)
- 💬 **Zero-Redraw UI**: Tooltip and big preview are DOM-only and don't trigger canvas re-renders
- 🧠 **Memory Management**: Progressive cleanup and text cache optimization

### 📁 Project Structure

```
infinitespecies/
├── 🌐 index.html              # Main application entry point with landing page
├── 🎨 styles.css              # Global styles and dark theme
├── 🚀 app-modular.js          # Application bootstrap (ES modules)
├── 📊 data/                   # Dataset files (split JSON files)
│   ├── 📋 manifest.json       # Split file metadata and loading order
│   └── 🌳 tree_deduped_part_*.json  # Taxonomy data chunks (~15-25MB each)
└── 🧩 modules/                # Modular JavaScript architecture
    ├── ⚙️ constants.js        # Configuration and color palettes
    ├── 🗃️ state.js            # Central state management and node indexing
    ├── 📥 data.js             # Data loading, parsing, and transformation
    ├── 🎨 canvas.js           # Canvas setup, sizing, and rendering context
    ├── 📐 layout.js           # D3 pack layout and coordinate calculations
    ├── 📷 camera.js           # Pan/zoom camera system with animations
    ├── 🖼️ render.js           # Main rendering engine (circles, labels, LOD)
    ├── 👆 picking.js          # Mouse interaction and hit detection
    ├── 🧭 navigation.js       # Breadcrumbs, navigation, and view management
    ├── 🔍 search.js           # Local search with result list and pulse indicator
    ├── 🔗 deeplink.js         # URL state management and sharing
    ├── 🌐 providers.js        # External service integration (Wikipedia, NCBI, etc.)
    ├── 🖼️ preview.js          # Image previews and thumbnails
    ├── 💬 tooltip.js          # Interactive tooltips and hover effects
    ├── ⏳ loading.js          # Progress tracking and loading states
    ├── ⌨️ events.js           # Input handling (mouse, keyboard, touch)
    ├── 📊 metrics.js          # Runtime performance monitoring
    ├── ⚙️ settings.js         # Performance settings, UI config, and memory management
    ├── 📝 logger.js           # Structured logging system
    └── 🌐 dom.js              # DOM element references and utilities
```

**Key Design Principles:** 🏗️
- 🧩 **Modular Architecture**: Each feature is a self-contained ES module
- 🎯 **Separation of Concerns**: Clear boundaries between data, rendering, and interaction
- ⚡ **Performance First**: Optimized for large datasets with LOD and memory management
- 🌑 **Dark UI Theme**: Consistent dark mode interface for better user experience
- 📱 **Progressive Enhancement**: Works on all devices with graceful degradation

### 🔗 Deep Linking & Sharing

The application automatically tracks your navigation state in the URL for seamless sharing: 🌐

- 🔗 **URL Format**: `#/Life/Eukaryota/Animalia/Chordata/Mammalia/...`
- 📤 **Share anywhere**: Use "Copy Link" button to get a shareable URL
- 🔖 **Bookmark-friendly**: Every view is a unique, restorable URL
- ✅ **Path validation**: Automatically handles invalid or outdated paths

**Examples:** 📋
- `#/` - Root view (Life) 🌍
- `#/Life/cellular%20organisms/Eukaryota` - Navigate to Eukaryotes 🦠
- `#/Life/cellular%20organisms/Eukaryota/Opisthokonta/Metazoa` - Jump to Animals 🐘


### 🎯 Use Cases

**Research & Education:** 🔬
- 🌳 **Taxonomy Exploration**: Navigate NCBI's complete tree of life
- 📚 **Educational Tool**: Visual learning aid for biological classification
- 🔬 **Research Reference**: Quick access to external databases (GBIF, NCBI, etc.)

**Data Visualization:** 📊
- 🗂️ **Custom Hierarchies**: Import your own nested data structures
- 🏢 **Corporate Org Charts**: Visualize company structures or project hierarchies
- 🌍 **Geographic Data**: Country/state/city hierarchical exploration

### 🤝 Contributing

infinitespecies follows modern web development practices: 💻

- 📦 **ES Modules**: Clean, modular architecture without build tools
- 🟨 **Vanilla JavaScript**: No heavy frameworks - just D3.js for visualization
- 📊 **Performance Monitoring**: Built-in FPS and memory metrics
- ♿ **Accessibility**: Keyboard navigation and semantic HTML
- 🎨 **Dark Theme**: Consistent dark UI design throughout
