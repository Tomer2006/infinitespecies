# UI conventions

The homepage, explorer, reading pages, and dialogs share one visual system.

- Define colors, the type scale, radii, and spacing in `src/styles/variables.css`.
- Use `src/styles/consistency.css` for shared control presentation and states.
- Keep positioning and responsive layout in the stylesheet of the surface it
  belongs to: `ui.css` (header, search, breadcrumbs), `overlays.css` (species
  card, map controls, group browser, loading screen, dialogs, toasts),
  `landing.css`, and `discovery.css` (reading pages). Each file ends with its
  own media queries; there is no global responsive stylesheet.
- The map keeps its size while exploring. Only the header reserves space;
  the breadcrumb trail, species card, and controls float over the map on
  translucent panels (`--bg-glass` with `--glass-blur`).
- Where the species card would cover the selected circle (phones and narrow
  windows) it opens as a compact peek and expands on request.
- Use slate surfaces, light text, and mint accents. Reserve warning and error
  colors for those states. The taxonomy map's selectable color palettes remain
  independent of the interface palette.
- Use the shared sans-serif stack for interface text and the monospace stack
  for code and numerical diagnostics.
- Primary actions use mint with dark text. Secondary controls use bordered
  slate surfaces; navigation actions may use transparent backgrounds.
- Interactive controls have a minimum 44px height. Icon buttons are 44px square.
- Keyboard focus uses a visible mint outline. Disabled controls reduce opacity
  and never move. Honor reduced-motion preferences.
- Dialog content scrolls within its container; keep headers and close buttons
  reachable. Do not hide scrollbars or disable content scrolling.
- New guide pages use `src/app/[...slug]/page.tsx` and `ReadingShell`, so
  development and production render the same React markup.
- Use Tailwind utilities for common layout and states. Shared component classes
  use `@apply`; retain CSS for canvas geometry, animations, and dynamic variables.
- Tailwind theme aliases (`bg-canvas`, `text-content`, `text-accent`) map to the
  existing design tokens in `src/styles/index.css`.

Validate changes with `npm run build`, `npm run check:pages`, and `npm test`.
Browser inspection at desktop and mobile sizes is still needed for visual QA.
