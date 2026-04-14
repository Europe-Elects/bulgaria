# Coding Conventions

**Analysis Date:** 2026-04-13

## Naming Patterns

**Files:**
- Parallel filenames for parallel concepts: `map.html` / `map_municipalities.html`
- Corresponding data files: `results.json` / `results_municipalities.json`
- kebab-case for geometry files: `bg.json` (oblasts), `bg-municipalities.json` (municipalities)
- Semantic clarity over brevity

**Functions:**
- camelCase for all function declarations and callbacks
- Descriptive names: `getWinner()`, `hasData()`, `makeProjection()`, `buildMap()`, `showTooltip()`
- Geometry helpers grouped under comments: `/* --- geometry helpers ---`
- Color/party logic functions: `hexToRgb()`, `parseRgb()`, `isLightFill()`, `partyShade()`, `partyMaxPct()`
- DOM interaction helpers: `cssId()` (sanitizes class names for SVG)

**Variables:**
- camelCase for all identifiers
- SCREAMING_SNAKE_CASE for constants: `NO_DATA_COLOR`, `SVG_W`, `SVG_H`
- Global state vars prefixed for clarity: `PARTIES` (key → {color, name, color2}), `PARTY_ORDER` (display sequence), `OBLAST_NAMES`, `OBLAST_PATHS`, `OBLAST_CENTROIDS`
- Semantic locals: `countyData`, `lastCountyData`, `currentView` (tracks active party in filter)
- Short accumulator names in loops acceptable: `a`, `cx`, `cy`, `mnx`, `mxx` (in geometry calculations only)

**Types (implicit, no TypeScript):**
- Objects keyed by geography ID: `BG01`…`BG28` (oblasts), NUTS4 codes (municipalities)
- Party data objects: `{key, name, color, color2, national_pct, national_votes}`
- Geometry features from GeoJSON: stored as processed `OBLAST_PATHS` (SVG d strings) and `OBLAST_CENTROIDS` ({cx, cy})
- Data objects: `{party_key: percentage_float, ...}`
- Metadata keys prefixed in municipalitiy data: `name`, `name_en` (Bulgarian + English names)

**Identifier Conventions - Geographic Codes:**
- ISO 3166-2:BG oblast codes: `BG01`…`BG28` for oblasts (oblasti)
- NUTS4 codes for municipalities (for `features.properties.nuts4` in GeoJSON)
- Party symbolic names (NOT numeric CIK codes): `GERB-SDS`, `PP-DB`, `Vazrazhdane`, `DPS-NN`, `BSP-UL`, `ITN`, `APS`, `MECh`, `Velichie`
- EU group affiliation inline in party display name: `"GERB-SDS (EPP)"`, `"PP-DB (RE | EPP)"` (in the `name` field, not a separate attribute)

## Code Style

**Formatting:**
- 2-space indentation (no tabs)
- No explicit formatter (not Prettier, Biome, or ESLint config present)
- Embedded inline in HTML `<style>` and `<script>` blocks
- CSS follows layout-first approach: reset (`*`), layout (flex, grid), typography, interactive states, media queries

**Linting:**
- None detected — no `.eslintrc`, `eslint.config.js`, or linting config
- Consider lightweight validation (JSON schema for data artefacts) once a CI pipeline is introduced

**Semicolons:**
- Present but inconsistent — most function declarations omit them, but statements use them

## Import Organization

**Not applicable** — no module system. Single-file HTML with inline `<script>` blocks.

**Data Fetching Pattern:**
```javascript
(async function(){
  const [geo, data] = await Promise.all([
    fetch('bg.json').then(r=>r.json()),
    fetch('results.json?' + Date.now()).then(r=>r.json()),
  ]);
  // processing...
})();
```
- Cache-busting query parameter: `'results.json?' + Date.now()` prevents stale data during polling
- Parallel fetches via `Promise.all()`

## Error Handling

**Approach:** Minimal — failures handled implicitly.

**Patterns:**
- Failed fetches silently fail (no `.catch()` on async IIFE in oblast map)
- PLAN.md mentions `setInterval()` with `catch(e){}` wrapper for live scraper, but not yet implemented in static HTML
- Validation: `typeof v === 'number' && v > 0` guards against null/undefined data
- Missing geometry: falls back to geography ID if `OBLAST_NAMES[id]` is undefined: `const name = OBLAST_NAMES[id] || id;`
- Metadata keys explicitly excluded from data iteration via `META_KEYS` Set in municipalities map (lines 252, 257, 264):
  ```javascript
  const META_KEYS = new Set(['name', 'name_en']);
  if (META_KEYS.has(p)) continue;  // skip non-vote columns
  ```

## Logging

**Framework:** None — no logging infrastructure.

**Approach:**
- Console is available but not used
- Debug state could be emitted via `console.log()` without ceremony if needed
- No structured logging

## Comments

**When to Comment:**
- Section headers: `/* --- geometry helpers ---`, `/* --- color helpers ---`, `/* --- draw ---`, `/* --- tooltip ---`, `/* --- legend ---`, `/* --- load ---`
- Inline for non-obvious geometry: `// area-weighted centroid of a ring in projected coords`, `// use largest ring of largest polygon`
- Data structure intent: `let PARTIES = {};  // key -> {color, name}`
- Hard-coded fixes: `// Sofia Province's polygon has no hole for Sofia City, so its centroid lands on top of BG22. Anchor BG23's label just east of BG22's centroid.` (lines 458–464)

**JSDoc:** None used. No formal function documentation.

## Function Design

**Size:** Compact, 5–50 lines typical.

**Parameters:**
- Geometry functions accept raw coords or features: `bbox(features)`, `featurePath(f, proj)`, `featureCentroid(f, proj)`
- Data handlers accept geography ID + data object: `showTooltip(e, id, data)`
- Single-responsibility: `partyShade()` only colorizes; `isLightFill()` only tests luminance

**Return Values:**
- Objects: `{cx, cy}` for centroids, `{party, pct}` for winners, `{r, g, b}` for RGB
- Nulls: `getWinner()` returns null if no valid data; `hasData()` returns boolean
- Strings: SVG path data `d` strings from `featurePath()`

## Module Design

**Exports:** Not applicable — single-file project.

**Global State:**
- Initialized at top of `<script>`: `const NO_DATA_COLOR = '#E2E8F0';`, then populated by async load: `let PARTIES = {}; // filled in after data loads`
- Current UI state: `let currentView = 'winner';` — toggles between winner-takes-all and per-party shading

**Separation of Concerns:**
- Geometry (coords, projections, paths): first half
- Color (RGB parsing, luminance, gradients): middle
- Data logic (getWinner, hasData): early middle
- DOM building (buildMap, buildLegend, tooltip): later half
- Load/init (async IIFE): very end

**Color Palette - Data-Driven:**
- Party colors defined entirely in `results.json` (and `results_municipalities.json`):
  ```json
  {"key":"GERB-SDS","color":"#3399FF","color2":null}
  ```
- No color definitions in code — CSS or JS constants only define non-party colors (e.g., `NO_DATA_COLOR`, `#0F172A` for text)
- Coalition parties (PP-DB) carry both `color` and `color2` for striped SVG patterns

**SVG Pattern for Coalitions:**
- Diagonal-stripe `<pattern>` generated for parties with `color2`:
  ```javascript
  const pat = document.createElementNS(ns, 'pattern');
  pat.setAttribute('patternTransform', 'rotate(45)');
  ```
- Applied via `url(#split-${cssId(party)})` fill
- Allows visual distinction of coalitions on the map

**Winner-vs-Party Toggle Pattern:**
- Default view: `currentView = 'winner'`
- Click a legend button: `currentView = (currentView === key) ? 'winner' : key`
- Re-render entire map on toggle (no incremental updates)

## Accessibility

**Patterns Already Applied:**
- Legend buttons: `aria-pressed="true"/"false"` (line 398)
- Legend container: `role="group"` + `aria-label="Party drill-down selector"` (lines 390–391)
- CTA hint: `role="note"` (line 147)
- Icon in CTA: `aria-hidden="true"` (line 151)
- Prefers-reduced-motion: honored on `.cta-arrow` animation and `.county` transitions (lines 115–132)
- WCAG AA contrast: all text on backgrounds meet 4.5:1 for body, 3:1 for larger text

**Label Luminance Detection:**
- `isLightFill()` computes perceived brightness to choose dark/light label color:
  ```javascript
  const lum=(0.299*c.r+0.587*c.g+0.114*c.b)/255; return lum > 0.62;
  ```
- Applies `.light` class with white text + black stroke for readability on light fills

## CSS Custom Properties

**Sparse Use** — no CSS variables defined. Color palette is hardcoded hex literals:
- `#F8FAFC` (background)
- `#E2E8F0` (borders, no-data)
- `#0F172A` (dark text)
- `#64748B` (muted gray)
- `#22C55E` (live indicator green)
- Tailwind-inspired palette naming (`slate-*` conceptually) but inline hex values only

---

*Convention analysis: 2026-04-13*
