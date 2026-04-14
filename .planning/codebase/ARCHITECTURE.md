# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Static single-file SVG visualization with no backend, no module bundler, no build step.

**Key Characteristics:**
- Pure HTML5 with embedded CSS and vanilla JavaScript
- Each visualization is a standalone `.html` file that loads data via `fetch()` at page load
- No TypeScript, no transpilation, no minification required
- Two independent but nearly identical pages serving different geographic granularities
- Significant code duplication (approximately 80% shared logic between the two HTML files)

## Layers

**Data Input:**
- Purpose: Raw election data from CIK opendata
- Location: `/export/` and `/spreadsheet/` (not shipped with the app; re-aggregated by out-of-repo Python scripts)
- Contains: Machine vote logs (CSV), polling station protocols, preferential votes, digital signatures (PKCS#7)
- Depends on: Nothing (source of truth)
- Used by: Python aggregation pipeline

**Python Aggregation Layer:**
- Purpose: Transform CIK raw data into application-ready JSON artefacts
- Location: Out of repository
- Contains: Custom aggregation scripts that roll up polling station votes to oblast and municipality levels
- Depends on: `/export/` and `/spreadsheet/` raw data
- Used by: Browser via `fetch()`

**JSON Data Artefacts:**
- Purpose: Pre-computed results and geometry for browser consumption
- Location: Root directory (`/results.json`, `/results_municipalities.json`, `/bg.json`, `/bg-municipalities.json`, `/data_by_oblast.json`)
- Contains: Party vote shares by oblast/municipality, GeoJSON polygons with oblast/municipality boundaries
- Depends on: Python aggregation pipeline
- Used by: Browser IIFE in both HTML files

**Browser Layer (DOM + SVG Rendering):**
- Purpose: Render interactive choropleth map and handle user interactions
- Location: `<script>` block at bottom of each HTML file
- Contains: Geometry projection, SVG path generation, colour shading, tooltip/legend UI, event handlers
- Depends on: JSON artefacts loaded via `fetch()`
- Used by: User interactions (hover, click)

## Data Flow

**On Page Load:**

1. Browser requests `/map.html` or `/map_municipalities.html`
2. HTML renders with embedded CSS and skeleton (empty `<div id="map-container">`)
3. IIFE async function executes, fetching two JSON files in parallel:
   - Geometry: `bg.json` (28 oblasts, ISO codes `BG01`–`BG28`) or `bg-municipalities.json` (265 municipalities, NUTS4 codes like `BLG01`)
   - Results: `results.json` (vote shares by oblast) or `results_municipalities.json` (vote shares by municipality)
4. Geometry is indexed into lookup tables: `OBLAST_PATHS` (SVG `d` strings), `OBLAST_NAMES` (English names), `OBLAST_CENTROIDS` (computed label positions)
5. Parties are indexed by key: `PARTIES` and `PARTY_ORDER` (sorted by national %)
6. SVG is built in two passes:
   - Pass 1: Render fills (each polygon path with computed fill colour)
   - Pass 2: Render labels (oblast/municipality names + vote percentage)
7. Legend items are created as buttons from `PARTY_ORDER`
8. Interactive state machine is armed: legend clicks toggle `currentView` between `'winner'` and a party key

**On User Interaction (Legend Click):**

1. Click handler receives party key
2. If clicked party is already active: `currentView = 'winner'` (reset to winner view)
3. If new party: `currentView = key` (switch to party view)
4. Legend UI updates: active button highlighted
5. Map redraws: fills and labels recomputed with new colour scale

**Tooltip on Hover:**

1. Mouse enter on polygon calls `showTooltip(event, id, data)`
2. Tooltip HTML built from `data[party]` percentages, sorted descending
3. Active party marked with bullet (●)
4. Tooltip positioned near cursor, adjusted to stay in viewport
5. Mouse leave hides tooltip

## State Management

**Global State Variables:**
- `PARTIES`: Object mapping party key → `{color, color2, name}`
- `PARTY_ORDER`: Array of party keys sorted by national vote %
- `OBLAST_NAMES`: Object mapping `BG01`–`BG28` (or NUTS4 codes) → English/bilingual names
- `OBLAST_PATHS`: Object mapping ID → SVG `d` string (polygon)
- `OBLAST_CENTROIDS`: Object mapping ID → `{cx, cy}` (for label placement)
- `lastCountyData`: Copy of results used for map redraws
- `currentView`: String, either `'winner'` or a party key

**No persistent storage.** All state exists in memory. Page reload resets to initial state.

## Key Abstractions

**Projection (`makeProjection`):**
- Purpose: Map geographic coordinates (lon/lat) to SVG canvas coordinates
- Signature: `(bbox, width, height) → (lon, lat) → [x, y]`
- Pattern: Mercator-like with latitude correction (parallel of origin at midpoint)
- Location: `map.html:184`, `map_municipalities.html` (identical)
- Used by: `featurePath()` to convert GeoJSON polygon rings into SVG `d` strings

**Colour Scale (`partyShade`):**
- Purpose: Compute a proportional shade of party colour based on vote %
- Signature: `(pct, maxPct, baseHex) → rgbString or NO_DATA_COLOR`
- Pattern: Linear interpolation from white (0%) to base colour (maxPct)
- Location: `map.html:233`, `map_municipalities.html` (identical)
- Used by: `buildMap()` to fill polygons in party-view mode

**Luminance Detection (`isLightFill`):**
- Purpose: Determine if text should be light or dark based on fill colour
- Signature: `(fill) → boolean`
- Pattern: Calculate perceived luminance using standard RGB formula; threshold at 0.62
- Location: `map.html:232`, `map_municipalities.html` (identical)
- Used by: Label rendering to choose `.light` class (white text with dark stroke)

**Feature Path (`featurePath`):**
- Purpose: Convert GeoJSON Polygon/MultiPolygon to SVG `d` path string
- Signature: `(feature, projectionFn) → pathString`
- Pattern: Handle both simple (Polygon) and complex (MultiPolygon) geometries
- Location: `map.html:193`, `map_municipalities.html` (identical)

**Feature Centroid (`featureCentroid`):**
- Purpose: Calculate center point of polygon for label placement
- Signature: `(feature, projectionFn) → {cx, cy}`
- Pattern: Area-weighted centroid of largest polygon ring (accounts for visual center)
- Location: `map.html:212`, `map_municipalities.html` (identical)
- Special case: Sofia City (BG23) has manually adjusted centroid offset (hardcoded in `map.html:460`)

**Winner Detection (`getWinner`):**
- Purpose: Find the party with highest vote % in a region
- Signature: `(regionData) → {party, pct} or null`
- Pattern: Single-pass max search over numeric values; ignores non-numeric fields
- Location: `map.html:249`, `map_municipalities.html` (identical)
- Used by: `buildMap()` to determine fill in winner-view mode

**Split-Colour Pattern (Coalition):**
- Purpose: Display two parties sharing a coalition entry
- Signature: SVG `<pattern>` with diagonal stripes (45° rotation)
- Pattern: Fields `color` and `color2` on party object trigger pattern creation
- Location: `map.html:264`, `map_municipalities.html` (identical)
- Example: PP-DB has `color2: "#3399FF"` (blue stripe + yellow stripe)
- Rendering: Path `fill` set to `url(#split-${partyKey})` instead of solid colour

## Entry Points

**`/map.html`:**
- Triggers: User navigates to page or bookmarks directly
- Responsibilities:
  - Render 28 oblast-level choropleth
  - Load `/bg.json` (oblast polygons, ISO codes `BG01`–`BG28`, English names)
  - Load `/results.json` (vote shares aggregated by oblast)
  - Provide party drill-down legend (click to shade map by party)
  - Show tooltip with full party results on hover
- Shared logic: ~95% identical to `map_municipalities.html`

**`/map_municipalities.html`:**
- Triggers: User navigates to page or bookmarks directly
- Responsibilities:
  - Render 265 municipality-level choropleth
  - Load `/bg-municipalities.json` (municipality polygons, NUTS4 codes like `BLG01`, bilingual names)
  - Load `/results_municipalities.json` (vote shares aggregated by municipality, includes `name_en` field)
  - Provide party drill-down legend
  - Show tooltip with full party results on hover
- Key difference: Municipality names rendered as `name_en` (from JSON) instead of hardcoded

**IIFE (Immediately Invoked Function Expression):**
- Location: Bottom of each HTML file (`<script>` block, lines 158–476 in `map.html`)
- Pattern: `(async function(){ ... })()`
- Execution: Runs immediately after DOM is ready
- Loads data, indexes geometry, builds legend and map, arms event handlers

## Error Handling

**Strategy:** Minimal error handling; relies on data availability.

**Patterns:**
- If `fetch()` fails, Promise rejection is unhandled (page will not display map)
- If JSON structure is invalid, code will throw during indexing
- If a polygon has no data, `NO_DATA_COLOR` (#E2E8F0) is used as fallback
- Tooltip gracefully shows "No data" if region has no vote data

## Cross-Cutting Concerns

**Logging:** None. No console logs in production code.

**Validation:** Defensive checks for data presence (e.g., `typeof data[party] === 'number'`), but no formal schema validation.

**Authentication:** None. No login required.

**Accessibility:** ARIA labels on legend buttons (`aria-label`, `aria-pressed`), semantic `<button>` elements, focus-visible styles, reduced-motion media query.

---

*Architecture analysis: 2026-04-13*
