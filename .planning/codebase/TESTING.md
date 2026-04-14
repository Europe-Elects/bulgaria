# Testing Patterns

**Analysis Date:** 2026-04-13

## Test Framework

**Status:** NONE CURRENTLY

**Runner:** Not present

**Assertion Library:** Not present

**Run Commands:** None defined

**CI/CD Pipeline:** None present

## Test File Organization

**Current:** No test files exist. Project is prototype-stage with manual QA only.

**Recommended Structure (once testing is introduced):**
```
/Users/andre/Desktop/bulgaria/
├── map.html
├── map_municipalities.html
├── results.json
├── results_municipalities.json
├── __tests__/
│   ├── data-validation.test.js
│   ├── geometry.test.js
│   └── color-rendering.test.js
└── __snapshots__/
    ├── map.html.snap
    └── map_municipalities.html.snap
```

## Test Structure

**Not Applicable** — no test suite exists.

**Recommended Approach for Single-File Static Project:**

Given the project's current scope (static HTML with embedded JS, no framework, no build step):

1. **JSON Schema Validation** (lightweight, data-focused):
   - Validate `results.json` and `results_municipalities.json` against a schema
   - Ensures party keys match between data and display
   - Ensures all geography IDs are valid ISO/NUTS4 codes
   - Example tool: `ajv` (JSON schema validator)

2. **Manual QA Checklist** (against Wayback snapshots):
   - Test on Wayback Machine snapshots of `results.cik.bg/pe202410/...` at 14%, 50%, 95% counted
   - Verify legend buttons toggle correctly between winner and per-party views
   - Verify tooltip appears on hover with correct party order (descending by %)
   - Verify color palette applies correctly to each oblast/municipality
   - Test on desktop + mobile viewports
   - Test keyboard navigation: Tab to legend buttons, Enter to toggle
   - Test screen reader (e.g., NVDA, JAWS) on legend group

3. **Visual Regression Testing** (once CI is set up):
   - Tool: Playwright with `@playwright/test` + visual snapshots
   - Capture PNG of map at full zoom for each party view
   - Compare against baseline after code changes
   - Run in headless Firefox/Chromium
   - Example:
     ```javascript
     test('oblast map renders GERB-SDS shading', async ({ page, context }) => {
       await page.goto('file:///path/to/map.html');
       await page.click('[data-party="GERB-SDS"]');
       await expect(page).toHaveScreenshot('map-gerb-sds.png');
     });
     ```

## Mocking

**Not Applicable** — no test framework present.

**When Testing is Introduced:**
- Mock `fetch()` to return known JSON shapes
- Example: Vitest with `vi.mocked(fetch)`:
  ```javascript
  vi.mock('fetch', () => ({
    default: vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ parties: [...], countyList: {...} })
      })
    )
  }));
  ```
- No need to mock DOM; use a real DOM or JSDOM test environment

**What to Mock:**
- Network calls (fetch to JSON files)
- Timestamps if testing time-dependent behavior (e.g., cache-busting `Date.now()`)

**What NOT to Mock:**
- SVG DOM creation (test real path rendering)
- Geometry calculations (verify against known coordinates)
- Color parsing/conversion (test RGB ↔ hex round-trip)

## Fixtures and Factories

**Test Data Location (Recommended):**
```
__tests__/fixtures/
├── minimal-results.json     (2 parties, 1 oblast)
├── full-results.json        (all 9 parties, all 28 oblasts, Oct 2024 snapshot)
├── bad-party-key.json       (invalid party key to test error handling)
└── missing-oblast.json      (incomplete geography)
```

**Factory Pattern (if needed):**
```javascript
function makeParty(key = 'GERB-SDS', overrides = {}) {
  return {
    key,
    name: `${key} (TEST)`,
    color: '#FF0000',
    color2: null,
    national_pct: 27.5,
    national_votes: 631264,
    ...overrides
  };
}

function makeCountyData(partyKey, pct) {
  return {
    [partyKey]: pct,
    'Other-Party': 100 - pct
  };
}
```

## Coverage

**Requirements:** Not enforced. Project is still a prototype.

**Recommended Minimum (once established):**
- Geometry helpers (bbox, makeProjection, featurePath): 80%+ (critical for rendering)
- Color logic (hexToRgb, isLightFill): 90%+ (correctness is visible)
- Data validation (getWinner, hasData): 100% (gate-keeping for display)
- DOM builders (buildMap, buildLegend): visual regression sufficient (code coverage not practical for HTML generation)

## Test Types

**Unit Tests (Recommended):**
- **Geometry:** Round-trip projection, bbox calculation, path interpolation
  - Test with known Bulgaria coordinates and expected SVG output
  - Validate centroid calculation against known polygon shapes
- **Color:** Hex ↔ RGB conversion, luminance threshold, gradient shading
- **Data:** Winner detection with ties, missing values, metadata filtering

**Example:**
```javascript
test('getWinner returns highest-percentage party', () => {
  const data = { 'GERB-SDS': 32.5, 'PP-DB': 14.2, 'Vazrazhdane': 13.8 };
  const winner = getWinner(data);
  expect(winner).toEqual({ party: 'GERB-SDS', pct: 32.5 });
});

test('getWinner skips metadata keys', () => {
  const data = { name: 'Sofia City', name_en: 'Sofia', 'GERB-SDS': 25, 'PP-DB': 15 };
  const winner = getWinner(data);
  expect(winner.party).toBe('GERB-SDS'); // 'name' not treated as party
});

test('getWinner returns null if no numeric data', () => {
  const data = { name: 'Test Oblast' };
  expect(getWinner(data)).toBeNull();
});
```

**Integration Tests (Recommended):**
- Load real `results.json` + `bg.json`, verify DOM renders without errors
- Test legend button clicks toggle `currentView` and redraw map
- Verify tooltip content matches selected data

**Visual Regression Tests (Recommended):**
- Snapshot map rendering for each party view
- Compare PNG after code changes
- Run on 1024×768 (tablet), 1920×1080 (desktop) viewports

**E2E Tests (Lower Priority):**
- Playwright/Cypress to test full interactive flow on real browser
- Opens `map.html`, clicks legend items, hovers tooltips
- Useful for regression-testing on 2026 election day before going live
- Not required for prototype phase

## Common Patterns

**Async Testing (once live scraper is built):**
```javascript
test('loads and parses results.json', async () => {
  const response = await fetch('results.json');
  const data = await response.json();
  expect(data.parties.length).toBeGreaterThan(0);
  expect(data.countyList).toBeDefined();
});
```

**Error Testing:**
```javascript
test('handles missing color gracefully', () => {
  const rgb = parseRgb(null);
  expect(rgb).toBeNull();
  // downstream code guards with `if(!c) return true;`
});

test('getWinner returns null for empty data', () => {
  expect(getWinner({})).toBeNull();
  expect(getWinner(null)).toBeNull();
});
```

## Recommended Test Stack (When Introduced)

**For a Static Single-File Project (No Framework):**

1. **Vitest** or **Jest**:
   - Fast, Node.js-native, no heavy config
   - JSDOM for DOM simulation (if needed) or real DOM for integration tests

2. **Playwright** (for visual regression + E2E):
   ```bash
   npm install -D @playwright/test
   npx playwright test                    # run all tests
   npx playwright test --debug            # headed mode
   npx playwright codegen file:///...     # record interactions
   ```

3. **AJV** (JSON schema validation):
   ```bash
   npm install -D ajv
   ```
   ```javascript
   const Ajv = require('ajv');
   const ajv = new Ajv();
   const schema = {
     type: 'object',
     properties: {
       parties: { type: 'array' },
       countyList: { type: 'object' }
     },
     required: ['parties', 'countyList']
   };
   const validate = ajv.compile(schema);
   expect(validate(data)).toBe(true);
   ```

**Do NOT over-engineer:**
- No TypeScript (unless adding one)
- No framework test utilities (no Vitest React plugin unless you add React)
- No 100% coverage goal — this is a prototype
- Manual QA against Wayback snapshots is sufficient for 2024 historical baseline

## Manual QA Checklist

**Before 2026 Election Night:**

- [ ] Load `map.html` in Chrome, Firefox, Safari on desktop
- [ ] Load `map_municipalities.html` in Chrome mobile (375px), tablet (768px)
- [ ] Click each legend party button → map should shade by that party's %
- [ ] Click active legend button again → should return to winner view
- [ ] Hover over oblast/municipality → tooltip should appear with all parties, sorted by %
- [ ] Active party in tooltip (current view) should be marked with ●
- [ ] Check contrast: all text readable on both dark and light fills
- [ ] Test keyboard: Tab to legend button, Enter to toggle
- [ ] Test screen reader (NVDA/JAWS): legend announces as "Party drill-down selector", buttons have aria-pressed state
- [ ] Verify `Last updated` timestamp and live indicator (green pulse) when data present
- [ ] Check "% counted" pill appears during partial counts, disappears at 100%

**Before 2026 Live Count:**

- [ ] Verify data fetch caches busted: `?` + `Date.now()` in results.json URL
- [ ] Test on real CIK live HTML snapshots (archived on Wayback at 14%, 30%, 60%, 95%)
- [ ] Confirm geometry from CIK match downloaded `bg.json` / `bg-municipalities.json`
- [ ] Verify party keys in live results match `results.json` party array
- [ ] Test fallback: if fetch fails, does old data persist or error gracefully?

---

*Testing analysis: 2026-04-13*
