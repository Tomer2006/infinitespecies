# InfiniteSpecies

**InfiniteSpecies** is a high-performance, interactive visualization of the biological Tree of Life. It uses a hybrid React + HTML5 Canvas engine to render millions of organisms in a zoomable circle-packing layout, allowing users to navigate from high-level domains down to individual species.

Live on [https://infinitespecies.com](https://infinitespecies.com)

## Key Features

**Deep Zoom Exploration:** Navigate through millions of nodes with smooth, hardware-accelerated zooming and panning.

**Hybrid Rendering Engine:** Uses D3.js for layout math and HTML5 Canvas for rendering to achieve 60 FPS performance on large datasets.

**Search:** Everyday names in English and Hebrew, scientific names, and typo-tolerant backend lookup. A built-in common-name vocabulary provides instant aliases; GBIF can resolve additional names when the local search has no results. Only names found in the loaded taxonomy are shown.

**Integrated Knowledge:** Information cards show available Wikipedia images and summaries, source links, and Wikidata ranks. Cards can be pinned, collapsed, or closed; missing enrichment does not prevent exploration.

**Deep Linking:** Share the selected organism or group. Opening the link loads and focuses that destination automatically. Human and bird shortcuts and a random destination are available on the homepage.

**Mobile Ready:** Fully responsive with touch gestures for pinch-zoom and panning.

## Controls


| Action       | Desktop                           | Mobile/Touch          |
| ------------ | --------------------------------- | --------------------- |
| **Zoom In**  | Scroll Up / Left Click (on group) | Pinch Out             |
| **Zoom Out** | Scroll Down / Right Click         | Pinch In / Back button |
| **Pan View** | Middle Click Drag / Drag          | Drag                  |
| **Fit Node** | `F` Key                           | Tap a circle            |
| **Search**   | `S` Key                           | Button in UI          |
| **All life** | `R` Key                           | All life button       |


See the full control list in the app by pressing `?` or `F1`.

## Development

Use Node.js 22.22.2+ on the Node 22 release line (or 24.15+ / 26+) for the app and tests.

```sh
npm ci
npm run backend
# In another terminal:
npm run dev
```

Open http://127.0.0.1:3000. Next.js forwards `/api` to the taxonomy service on
port 8787. Set `TAXONOMY_API_URL` in `.env.local` for a remote service. The
static files in `public/data` remain the fallback when the service is unavailable.

```sh
npm test
npm run build
npm run check:pages
npm start
```

`npm start` serves the production Next.js frontend. `npm run backend` starts the
separate taxonomy service. Netlify builds `.next`; Railway runs the taxonomy
service using `railway.json`. On other Next.js hosts, set `TAXONOMY_API_URL` to
the backend's `/api` URL. The old `VITE_DATA_API_URL` setting is retired.

## Architecture

**Next.js App Router:** Next.js renders the React homepage and five reading pages, including canonical metadata and a real 404. Routes live in `src/app`; guide content lives in `build/discovery-pages.js`. The interactive canvas stays in a client component. Run `npm run check:pages` after a build to verify the production server, HTML, styles, redirects, and data fallback.

**Accessible navigation:** Visible zoom, parent, reset, and random controls sit beside a keyboard-operable group browser. The backend serves direct children in pages of 50 through `/api/tree/children/:id?offset=0`; deploy the updated frontend and backend together.

See [the launch checklist](docs/launch.md) for deployment, Google Search Console, first-user recruitment, and hosting configuration.

**Data Pipeline (`/tools`)**: Raw OpenTree taxonomy dumps are processed, baked into a D3 packing layout offline, and split into sharded JSON chunks.

Run `npm run compact-data` after generating baked files. This replaces repeated JSON object keys and explicit sequential IDs with the `compact-rows-v1` format used by both the backend and eager fallback.

**Core Engine (`/src/modules`)**: A strict TypeScript engine handles the render loop, spatial indexing (`picking.ts`), and camera physics (`camera.ts`) outside React's render cycle. React owns the UI, DOM lifecycle, and browser event bindings.

**UI Layer (`/src/components`)**: React 19 handles the HUD, modals, and search state. Next.js handles page routes; taxonomy selection stays in the URL hash. Tailwind CSS 4 compiles shared component utilities through `@tailwindcss/postcss`, with design tokens and canvas-specific CSS in `src/styles`.

## Data Sources

The visualization is compatible with:

**Open Tree of Life:** The default dataset.

## License

Proprietary "All Rights Reserved"

Copyright (c) 2026 InfiniteSpecies

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use is strictly prohibited. See [LICENSE](LICENSE) for full terms.

---

Built with love using React, D3, and Biology
