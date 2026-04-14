# Codebase Concerns

**Analysis Date:** 2026-04-13

## Tech Debt

**Code duplication across map visualizations (HIGH):**
- Issue: `map.html` and `map_municipalities.html` share ~80% identical JavaScript code — geometry helpers, color calculations, winner logic, tooltip rendering, legend management, and SVG construction are duplicated across both files.
- Files: `map.html` (lines 174–415), `map_municipalities.html` (lines 174–441)
- Impact: Changes to one map require manual updates to both. Bug fixes need to be duplicated. Future maps (МИР choropleths, swing maps, bonus viz) will multiply this duplication 5–10×.
- Fix approach: Extract shared logic into a reusable JavaScript module (`src/map-renderer.js` or similar). Both HTML files would then import and instantiate the same core functions with different data sources and config. Requires no-build solution (ES6 modules loaded via `<script type="module">` or bundled to single static files).

**No build system, no module bundling (MEDIUM):**
- Issue: All scripts are inlined. No minification, no tree-shaking, no asset versioning. Acceptable for the current 2 maps (~40 KB each), but with 10+ planned visualizations (turnout, swing, bonus maps, seat allocation), combined JS will become unwieldy and slow to load.
- Files: `map.html`, `map_municipalities.html`
- Impact: Each new viz adds ~15–20 KB of code that must be downloaded. No ability to share common utilities. Asset cache-busting happens via `fetch(...+ Date.now())` which forces unnecessary network requests on every pageload.
- Fix approach: Introduce a lightweight build step (esbuild, rollup, or even a simple concatenation script) to extract common modules and generate minified bundles per HTML. Keep static hosting (GitHub Pages) but organize as `dist/map.min.js`, `dist/map_municipalities.min.js`, etc.

**Python aggregation script not committed (CRITICAL):**
- Issue: PLAN.md (lines 244–256) describes the parser pipeline (xlsx/csv → parquet → rollups), but there is no `aggregate.py` or equivalent in the repository. The aggregation logic exists only in chat history or external notes. Re-running the full aggregation requires copy-pasting code from chat, which is unreproducible and fragile.
- Files: Missing from repo root; context only in PLAN.md
- Impact: Cannot regenerate `results.json`, `results_municipalities.json` from source data. If data or methodology changes, there is no single source of truth for the transformation. 2026 election data will require the same manual process.
- Fix approach: Commit `scripts/aggregate.py` (or `scripts/parse.py`) that reads the CIK opendata CSVs / XLSXs and outputs the JSON results used by the maps. Include a `README` in `scripts/` documenting inputs, outputs, and dependencies (pandas, openpyxl).

**No data schema validation (MEDIUM):**
- Issue: Both maps fetch `results.json` and `results_municipalities.json` and parse them without validation. If a JSON file is malformed or missing required fields (`parties`, `countyList`/`municipalityList`, `lastUpdated`), the page renders silently with empty tiles and no error.
- Files: `map.html` (line 443–447), `map_municipalities.html` (line 459–462)
- Impact: Data errors go unnoticed. Misaligned county/party keys render as no-data (gray). A single typo in the aggregation script breaks the entire visualization without feedback.
- Fix approach: Add a JSON schema validation step in the aggregation script (using `jsonschema` Python library). On the frontend, wrap the `apply()` function in `map.html` / `map_municipalities.html` with a validation check that logs errors to console before rendering.

**Stale `data_by_oblast.json` artifact (LOW):**
- Issue: `data_by_oblast.json` exists in the repo but is not used by any HTML file. `results.json` is the current oblast data source. The stale file should either be removed or documented as an earlier iteration.
- Files: `data_by_oblast.json` (10 KB, unused)
- Impact: Confusion for future maintainers — which file is authoritative? Wasted storage and potential for accidental use of outdated data.
- Fix approach: Delete `data_by_oblast.json` from the repo once it is confirmed that all maps use `results.json` as the oblast source. If it needs to be kept for archival, add a comment to PLAN.md explaining it is a prior iteration.

---

## Known Bugs & UX Issues

**Colour ambiguity — GERB-SDS vs. APS-post-split (MEDIUM, documented):**
- Issue: GERB-SDS uses `#3399FF` (sky blue). APS uses `#FFD700` (yellow). However, historical coalition data and different election cycles may reuse these colors for different parties. For example, if a prior election had a coalition with the same blue, or if APS was called by a different name, swinging maps comparing 2024 → 2026 could have two regions with visually identical colors representing different parties.
- Files: `results.json` (line 1, party definitions), `results_municipalities.json` (party definitions)
- Impact: On a swing map where region A swung GERB-SDS → other_blue_party and region B swung APS_2024 → APS_2026, they may appear the same color, confusing readers. Documented in PLAN.md but not yet mitigated.
- Fix approach: Audit the color palette for 2024 and 2026 cycles. If collisions exist, add a secondary identifier (e.g., hatching pattern via SVG `<pattern>` — already implemented in both maps for coalition parties with `color2`). Alternatively, expand the palette to use more distinct colors or add subtle texture differences.

**PP-DB and APS-post-split both use yellow (MEDIUM, documented):**
- Issue: PP-DB is `#FFD700` and APS is also `#FFD700`. This is a hard collision. On the oblast/municipality maps, if one region chooses PP-DB as winner and an adjacent region chooses APS, they are indistinguishable.
- Files: `results.json` (lines 2 and 7), `results_municipalities.json` (party definitions)
- Impact: Misreading of regional winners on printed or grayscale-friendly contexts. Accessibility concern for colorblind users.
- Fix approach: Change one party's color immediately. APS → `#DAA520` (goldenrod) or PP-DB → `#FFB6C1` (light pink). Regenerate `results.json` and `results_municipalities.json` with the new palette.

**Sofia City (BG22) label positioning is manually hardcoded (FRAGILE):**
- Issue: Sofia City's polygon in `bg.json` has no hole cut for Sofia Province (BG23). When computing the centroid of BG23, it falls inside BG22's bounds. The code manually nudges BG23's label 50px east and 30px south of BG22's centroid (lines 460–465 of `map.html`).
- Files: `map.html` (lines 460–465)
- Impact: If `bg.json` is regenerated or the projection changes, this hardcoded offset will be misaligned. No warning is raised if the offset is wrong; readers simply see a misplaced label. Any update to the geometry requires re-tuning the magic numbers.
- Fix approach: Use OSM boundaries that properly include the Sofia City hole in BG23's geometry. Or, generate a proper polygon with a hole cutout during the GeoJSON preparation step. Document why the offset exists in a comment, and consider making it configurable via a data-driven `label_offset` field in the GeoJSON properties.

---

## Documented Gaps

**MIR 32 (Abroad district) excluded from all maps (DOCUMENTED, awaiting implementation):**
- Gap: Bulgaria's 2024 election had ~350 polling stations in MIR 32 (abroad), spread across ~60 countries. The current maps show only domestic results (МИР 1–31, 28 oblasts, 265 municipalities). MIR 32 is not included.
- Files: `map.html` and `map_municipalities.html` do not load abroad data; `bg.json` and `bg-municipalities.json` have no geometry for abroad regions.
- Reason: Geographic representation is not meaningful for dispersed polling stations in embassies/consulates. The PLAN.md proposes a separate "diaspora map" by country/city (B4).
- Impact: 6% of the 2024 national vote is invisible on the current maps. Any swing analysis that includes abroad votes without a separate diaspora view will be incomplete.
- Fix approach: Build "B4 diaspora map" (PLAN.md lines 145–146) that shows abroad voting by country/city. Use `sections.csv` (abroad rows) + `votes.csv` to aggregate abroad votes per country. Bonus: overlay embassy locations as circles.

**No party/coalition crosswalk for 2024 → 2026 (DOCUMENTED, awaiting implementation):**
- Gap: Bulgarian coalitions reform between elections. GERB-SDS in 2024 may have different coalition partners in 2026. APS was formed after 2021 and may dissolve or merge. Swing maps require a manual mapping of "2024 party X = 2026 party Y" to compare like-for-like.
- Files: No YAML or CSV crosswalk exists; PLAN.md (lines 94–96) only mentions the need for one.
- Impact: Cannot compute party swing without ambiguity. A chart showing "GERB-SDS swing 2024→2026" is only valid if the coalition composition is identical. If GERB-SDS gains new partners or loses members, the comparison is not apples-to-apples.
- Fix approach: Once 2026 coalitions are finalized (typically 2–3 weeks before the election), manually create `src/data/coalition_mapping.yaml`:
  ```yaml
  gerb_sds_2024: [GERB, SDS]
  gerb_sds_2026: [GERB, SDS, possible_new_partner]
  apm_2024: [APS, some_party]
  apm_2026: [APS]
  # ...
  ```
  Use this during aggregation to align vote totals.

**Municipality names: 69 hand-mapped, 196 transliterated (DOCUMENTED, needs review):**
- Gap: `bg-municipalities.json` contains municipality English names. 69 are hand-curated (e.g., Sofia, Plovdiv). 196 were transliterated via the "Streamlined Bulgarian" system (e.g., "Gotse Delchev" vs. historical "Goce Delchev"). Some transliterations may not match international standards or prior usage.
- Files: `bg-municipalities.json` (municipality features with `name` and `name_en` properties)
- Impact: Inconsistency in spelling could confuse readers familiar with alternative transliterations. May not align with OSM or Wikipedia naming conventions.
- Fix approach: Cross-check the 196 transliterated names against OSM and Wikipedia's English names. Create a list of discrepancies and decide whether to override (e.g., keep historical spellings for well-known places) or standardize.

**No live-count scraper script committed (DOCUMENTED, not started):**
- Gap: PLAN.md (lines 322–333) specifies the scraper design (async HTTP, parse results.cik.bg tables every 60s, store snapshots in parquet). No Python script exists. The scraper must be tested against Wayback Machine snapshots of 2024 HTML before the 2026 election night.
- Files: Missing `scripts/scraper.py` or similar.
- Impact: When the 2026 election is called, there is no ready tool to capture live results. The scraper must be built from scratch during the count, which is high-risk.
- Fix approach: Write and test `scripts/scraper.py` now using Wayback snapshots of 2024 pages (e.g., web.archive.org/web/20241027224557/results.cik.bg/pe202410/rezultati/index.html). Verify it correctly parses the HTML table and captures vote totals. Build the watchdog/alert logic (Telegram notifications if no new snapshot in 20 min).

**MIR 32 abroad stations report over 5–6 days (DOCUMENTED, unhandled):**
- Gap: Abroad polling stations do not all close at the same time due to time zones. Their results trickle in over the night and next morning. The current static map has no mechanism to hide or flag incomplete regions.
- Files: No special handling in `map.html` or `map_municipalities.json` for ahead-of-time vs. live data.
- Impact: During the live count (T+2 to T+12 hours), abroad results are partial. A map showing "100% counted" when BG09 is complete but BG17/BG21 (diaspora-heavy regions) are not is misleading.
- Fix approach: Add a `"counted_pct"` field to the results JSON for each region. On the map, shade incomplete regions with a distinct overlay (e.g., a subtle diagonal stripe or darker opacity). Update `map.html` to check `counted_pct < 100` and apply the overlay.

---

## Performance Notes

**Current rendering performance (acceptable):**
- The oblast map renders 28 polygons + 28 labels + legend interactivity in <100ms on modern browsers. Acceptable.
- The municipality map renders 265 polygons without labels (to avoid clutter) + legend in <200ms. Acceptable.
- Impact: No immediate performance concern. D3-geo + topojson is lightweight for these scales.

**Scaling limit if future maps render 12,919 polling stations:**
- Issue: PLAN.md notes potential for settlement-level (~5,300 luoghi) or polling-station-level choropleths. Rendering 12,919 SVG `<path>` elements would be slow (~2–5s on older hardware).
- Files: Not yet implemented; planning B8 (settlement choropleths) and potential polling-station zoom.
- Impact: Future viz will require canvas or WebGL rendering, or client-side simplification (e.g., topojson quantization to reduce polygon complexity).
- Fix approach: For settlement/station-level maps, use Mapbox GL or a canvas-based renderer. Pre-quantize GeoJSON to reduce vertex count by 50–80%. Test rendering on an older iPad/phone before shipping.

---

## Security Considerations

**No authentication, no user input, no external APIs (LOW RISK):**
- The site is read-only. No user accounts, no data submission, no sensitive queries.
- Data sources are public (CIK opendata, OSM, simplemaps.com).
- No database backend, no API keys in the code (verified by grep).
- Impact: Minimal security risk. Standard web security (HTTPS on GitHub Pages, CSP headers if applicable) is sufficient.
- Recommendations: Keep external dependencies to a minimum (d3-geo, topojson are stable and have no transitive security issues). Pin versions in any future `package.json`. Monitor GitHub security alerts for the repo.

---

## Fragile Areas

**Projection and geometry calculation (FRAGILE):**
- Issue: The map rendering depends on custom projection logic (`makeProjection()`, `featurePath()`, `featureCentroid()`) that is duplicated and reimplemented in both HTML files. The projection parameters (scale, translate, latitude adjustment) are hardcoded and tuned for Bulgaria's bounding box.
- Files: `map.html` (lines 174–227), `map_municipalities.html` (lines 176–230)
- Why fragile: If the GeoJSON bounding box changes (e.g., updated borders, different simplification level), the projection will be off-center or too zoomed. No test suite validates the projection.
- Safe modification: Keep the projection code identical between both maps until duplication is refactored. When updating GeoJSON files, visually inspect the rendered map to ensure Bulgaria is centered and fills the SVG viewBox.
- Test coverage: None. Manual visual inspection only.

**Color scale and winner detection (FRAGILE):**
- Issue: Winner is determined by `getWinner()` (lines 249–254 in `map.html`), which finds the party with the highest vote %. If two parties tie at the same %, the function returns the second one encountered (dictionary iteration order). No tie-breaking logic exists.
- Files: `map.html` (lines 249–254), `map_municipalities.html` (lines 253–261)
- Why fragile: Ties are unlikely but possible due to rounding. If a region's results are malformed (e.g., missing a party entry), the winner may be incorrect.
- Safe modification: Add explicit tie-breaking (e.g., by party priority order or by national vote share). Document the logic in a comment.
- Test coverage: None. No test data for edge cases (ties, missing parties, null data).

**SVG pattern generation for coalition parties (FRAGILE):**
- Issue: Coalition parties with `color2` get a diagonal stripe pattern (lines 264–282 in `map.html`). The pattern ID is generated via `cssId(key)`, which replaces non-alphanumeric characters with underscores. If a party key contains special chars that happen to create a duplicate ID (e.g., "APS-new" and "APS_new" both become `APS_new`), the pattern deduplication fails and a polygon references a non-existent pattern.
- Files: `map.html` (lines 264–282), `map_municipalities.html` (lines 274–292)
- Why fragile: No validation that `cssId()` results are unique. A typo or new coalition name could silently break the pattern rendering.
- Safe modification: Use a deterministic hash (e.g., MD5 of party key) to ensure uniqueness. Add a comment warning future maintainers.
- Test coverage: None.

---

## Test Coverage Gaps

**No automated tests (CRITICAL GAP):**
- Issue: There are no unit tests, integration tests, or even visual regression tests. Changes to `map.html` or the aggregation script are not validated before deploy.
- Files: Entire codebase.
- Risk: A typo in a color code or a missing municipality renders silently. The aggregation script may silently drop records. The scraper may fail to parse the HTML and never alert maintainers.
- Priority: HIGH. Before building the 2026 scraper and expanding to 10+ maps, add:
  1. Unit tests for `aggregate.py`: verify vote totals match CIK published summaries, check party ordering, validate JSON schema.
  2. Visual regression tests for map rendering: compare rendered SVGs against baseline images for any change.
  3. Scraper integration tests: mock HTTP responses from Wayback snapshots, verify parsing accuracy, check error handling.

---

## Missing Critical Features

**No live-count pipeline (BLOCKED on scraper):**
- Feature: During the 2026 count, the maps should update every 60 seconds with fresh data from results.cik.bg. No live pipeline exists yet.
- Blocks: Real-time election night dashboards; live trending analysis; seat-allocation charts.
- Status: Scraper logic is documented in PLAN.md (section 4, lines 276–332); no code yet.
- Approach: Build `scripts/scraper.py` (test on Wayback snapshots), set up a GitHub Actions workflow to run the scraper every minute during the count, and push updated JSON files to the `main` branch (or a separate `live/` directory).

**No seat allocation charts (BLOCKED on Hare-Niemeyer implementation):**
- Feature: PLAN.md (section 3b, lines 195–205) proposes 6 seat-based charts (hemicycle, seats by МИР, seat swing, threshold-cliff, coalition arithmetic). Only the vote-based maps exist today.
- Blocks: Analysis of the "who has a majority" question on election night.
- Status: Algorithm design exists in PLAN.md (lines 213–228); no implementation.
- Approach: Implement `scripts/compute_seats.py` that applies Hare-Niemeyer to vote totals. Build `seat_allocation.html` and supporting JSON structures.

**No bonus maps (BLOCKED on aggregation script):**
- Features: PLAN.md (section 3, lines 136–149) lists 8 bonus maps (preferential votes, paper vs machine, invalid ballots, diaspora, machine audit, turnout deciles, mobile SIK, settlements). None are implemented yet.
- Blocks: Unique analysis angles not available from other outlets.
- Status: All require aggregation script to exist first; then new viz templates.
- Approach: Prioritize in order: diaspora (B4), paper-vs-machine (B2), preferential heatmap (B1). These require only data already in CIK CSVs.

**No CI/CD deployment pipeline (BLOCKED on organization decision):**
- Feature: Currently, the site runs via `python3 -m http.server` locally. No GitHub Pages deployment, no GitHub Actions build, no staging environment.
- Blocks: Automatic updates during live count; easy collaboration with other contributors.
- Status: PLAN.md assumes GitHub Pages (line 269) but no config exists.
- Approach: Create a simple GitHub Actions workflow (`.github/workflows/deploy.yml`) that:
  1. Runs `scripts/aggregate.py` on the CIK opendata releases.
  2. Runs tests.
  3. Pushes updated JSON + HTML to GitHub Pages.
  Set the repository settings to publish from `main` branch (or `gh-pages` branch).

---

*Concerns audit: 2026-04-13*
