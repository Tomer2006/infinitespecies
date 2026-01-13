# 🌿 InfiniteSpecies

Welcome to **InfiniteSpecies**! 🧬 An interactive circle-packing visualization for exploring biological taxonomy data, powered by React and D3.js. Navigate from high-level domains down to individual species with smooth zooming, search capabilities, and integrated web resources. 🎯

## 📋 Table of Contents

- [🌐 Live App](#-live-app)
- [✨ Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
- [🎮 Controls](#-controls)
- [🖥️ UI Overview](#️-ui-overview)
- [📊 Data Loading](#-data-loading)
- [🔧 Technical Architecture](#-technical-architecture)
- [🔗 Deep Linking & Sharing](#-deep-linking--sharing)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [🎯 Use Cases](#-use-cases)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🌐 Live App
- **🌐 Live Site**: Visit [https://infinitespecies.com/](https://infinitespecies.com/) 🚀
- **💻 Local Development**: Run `npm run dev` and visit `http://localhost:3000`

## ✨ Key Features

- 🌍 **Landing Page**: Beautiful animated landing with quick access to exploration and help
- 🔍 **Interactive Tree Navigation**: Click nodes to filter view to specific subtrees without camera movement
- 🔎 **Smart Search**: Real-time search with multi-result dropdown and navigation
- 🖼️ **Image Previews**: Wikipedia thumbnails for hovered organisms
- 🧭 **Informative Tooltips**: Shows name, formatted leaf count (e.g., "1,000,000 leaves"), and level
- 🌐 **External Integration**: Quick access to Google, Wikipedia, GBIF, NCBI, CoL, and iNaturalist
- 🔗 **Deep Linking**: Share exact views via URL hash - every navigation state is preserved
- 📱 **Mobile Detection**: Graceful handling for mobile devices with informative blocker

### 🚀 Quick Start

**Prerequisites:** 📋
- Node.js 18+ and npm

**Installation:** 🖥️
```bash
# Clone the repository
git clone https://github.com/Tomer2006/infinitespecies.git
cd infinitespecies

# Install dependencies
npm install

# Start development server
npm run dev

# Then visit: http://localhost:5173/ 🌐
```

**Build for Production:** 📦
```bash
# Create optimized build
npm run build

# Preview production build
npm run preview
```

### 🎮 Controls

- **🖱️ Left Click**: Update tree view to show only clicked subtree (no camera movement) 🌳
- **🖱️ Right Click**: Navigate to parent node ⬆️
- **🖱️ Mouse Wheel**: Smooth zoom 🔄
- **🖱️ Middle Drag**: Pan the view 📍
- **⌨️ S**: Web search for hovered/current organism
- **⌨️ R**: Reset to root view
- **⌨️ F**: Fit current node in view
- **⌨️ ?** or **F1**: Toggle help overlay
- **⌨️ Escape**: Close modals

### 🖥️ UI Overview

- **🌍 Landing Page**: Animated entry point with "Start Exploration", Help, and About options
- **📋 Top bar** (after starting):
  - `🏠 Menu`: Return to landing page
  - `🔗 Provider select + 🌐 Web Search`: open selected provider for hovered/current node
  - `🔍 Search field`: find by name (supports partial matches)
  - `📋 Copy Link`: copy a deep link to the current view (URL hash)
  - `🔄 Reset`: back to root
- **🍞 Breadcrumbs**: click any crumb to navigate up (also updates the URL hash for deep linking)
- **💬 Tooltip**: shows organism name, formatted leaf count (e.g., "1,000,000 leaves"), and level

### 📊 Data Loading

The application loads pre-baked taxonomy data from `public/data/manifest.json` with split files for optimal performance. The default dataset uses the **OpenTree of Life** taxonomy, but the application also supports NCBI taxonomy and custom JSON data formats.

#### 🚀 Large Dataset Handling

This application supports **large taxonomy datasets** 📊 through intelligent data splitting and progressive loading. The current demo uses **5 split files** 📦 totaling ~456MB of pre-baked layout data with **4.5 million nodes** from the OpenTree of Life taxonomy. 🧬

**Current Split Configuration:** ⚙️
- 📄 **5 files** (~90MB each)
- ⚡ **Parallel loading** with progress tracking
- 🔗 **Seamless merging** - appears as single dataset to user

**Technical Details:** 🔧
- 📊 **Pre-baked layouts**: D3 circle-packing calculated offline for instant rendering
- 💾 **Efficient memory usage**: Optimized data structures and cleanup
- ☁️ **Web-ready**: Suitable for static hosting platforms (Netlify, Vercel)

### 🔧 Technical Architecture

**Tech Stack:** 🛠️
- ⚛️ **React 18**: Modern component-based UI architecture
- 📘 **TypeScript**: Type-safe development experience
- ⚡ **Vite**: Lightning-fast development and optimized builds
- 🎬 **Framer Motion**: Smooth animations and transitions
- 📊 **D3.js**: Hierarchical circle packing visualization

**Project Structure:** 📁
```
src/
├── components/          # React UI components
│   ├── AboutModal.tsx   # About information modal
│   ├── Breadcrumbs.tsx  # Navigation breadcrumbs
│   ├── HelpModal.tsx    # Help/keyboard shortcuts modal
│   ├── LandingPage.tsx  # Animated landing page
│   ├── LoadingOverlay.tsx # Progress loading overlay
│   ├── MobileBlocker.tsx  # Mobile device warning
│   ├── Stage.tsx        # Main canvas container
│   ├── Toast.tsx        # Toast notifications
│   └── Topbar.tsx       # Top navigation bar
├── hooks/
│   └── useToast.ts      # Toast notification hook
├── modules/             # Core visualization engine (JS)
│   ├── camera.js        # Pan/zoom camera system
│   ├── canvas.js        # Canvas management
│   ├── data.js          # Data loading orchestration
│   ├── deeplink.js      # URL hash navigation
│   ├── navigation.js    # Node navigation
│   ├── render.js        # Circle packing renderer
│   ├── search.js        # Search functionality
│   └── ...              # Additional modules
├── styles/
│   └── index.css        # Global styles
├── App.tsx              # Main application component
└── main.tsx             # React entry point
```

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

**Key Design Principles:** 🏗️
- 🧩 **Hybrid Architecture**: React UI components + optimized JS visualization modules
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
- 🌳 **Taxonomy Exploration**: Navigate the OpenTree of Life's complete taxonomy (4.5+ million nodes)
- 📚 **Educational Tool**: Visual learning aid for biological classification
- 🔬 **Research Reference**: Quick access to external databases (GBIF, NCBI, Wikipedia, iNaturalist, etc.)
- 🔄 **Multiple Data Sources**: Supports OpenTree of Life, NCBI taxonomy, and custom JSON data



InfiniteSpecies follows modern web development practices: 💻

- ⚛️ **React 18**: Component-based UI with hooks
- 📘 **TypeScript**: Type-safe components and interfaces
- ⚡ **Vite**: Fast HMR and optimized builds
- 📊 **D3.js**: Circle packing visualization
- 🎬 **Framer Motion**: Smooth animations
- ♿ **Accessibility**: Keyboard navigation and semantic HTML
- 🎨 **Dark Theme**: Consistent dark UI design throughout

**Development Commands:** 🖥️
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```
