# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- HTML5 — Structure for both `map.html` and `map_municipalities.html`
- JavaScript (ES6+) — Vanilla client-side logic, no frameworks or transpilation required
- JSON — Data serialization for results and geometry files

**Secondary:**
- CSS3 — Inline styles in HTML head, no external stylesheets
- Python 3 — Ad-hoc data aggregation scripts (not in repo, referenced in PLAN.md)

## Runtime

**Frontend:**
- Web browser (no specific version requirements, uses standard DOM/SVG APIs)

**Data Processing:**
- Python 3 — Used for parsing CIK data exports and aggregating results into JSON artifacts

## Frameworks & Libraries

**Frontend:**
- **Vanilla JavaScript** — No frameworks; DOM manipulation via `document.querySelector()`, `fetch()` API
- **SVG** — Inline SVG rendering for choropleth maps with `<svg>` elements
- **Google Fonts** — Inter font family (400, 500, 600, 700 weights)

**Data Processing (inferred from PLAN.md):**
- `openpyxl` — Python library for reading XLSX files from `spreadsheet/` folder
- `pandas` — Data manipulation and aggregation (referenced in architecture section of PLAN.md)
- `httpx` — Async HTTP/2 client for live scraping (battle-tested for Hungary 2026)
- `selectolax` or `lxml` — HTML parsing for live CIK result pages
- `apscheduler` — Task scheduling for polling live data
- `duckdb` — Columnar database for appending parquet snapshots

## Build & Development

**No build step required:**
- Single-file HTML deployments
- Direct file serving (fetch JSON files from same origin)
- No package manager, no dependencies tracked

**Development approach:**
- Edit HTML/JS/JSON directly
- Test in browser with live reload (e.g., `python -m http.server 8000`)

## Key Dependencies

**External services:**
- Google Fonts API for Inter typeface (`fonts.googleapis.com/css2?family=Inter`)

**Data files (local, generated via Python):**
- `results.json` — National vote shares by party, oblast totals, grand total (2,292,524 votes)
- `results_municipalities.json` — Same data keyed by party number (1–28), with per-oblast breakdowns
- `bg.json` — GeoJSON FeatureCollection of 28 oblasti (oblast-level choropleths), sourced from simplemaps.com
- `bg-municipalities.json` — GeoJSON FeatureCollection of 265 municipalities with properties: `nuts4`, `nuts3`, `name`
- `data_by_oblast.json` — Per-oblast summary (totals by region)

## Configuration

**No runtime configuration:**
- No `.env` files, no config-as-code
- Data paths hardcoded in HTML (`fetch('bg.json')`, `fetch('results.json')`)
- Font URL hardcoded in `<link>` tag

**Election metadata:**
- Embedded in JSON: `lastUpdated` timestamp (ISO 8601, e.g., `2024-10-30T00:00:00+02:00`)
- Processing progress: `processingPctDomestic: 100` (for final counts)

## Data Aggregation Pipeline

**Input sources:**
- `export/Актуализирана база данни/*.txt` — CIK CSV exports (`;`-delimited):
  - `cik_parties_27.10.2024.txt` — National parties (27 rows)
  - `local_parties_27.10.2024.txt` — Party registrations per МИР (840 rows)
  - `sections_27.10.2024.txt` — Polling stations (12,919 rows) with EKATTE, address, flags
  - `protocols_27.10.2024.txt` — SIK protocol headers (turnout, valid/invalid, paper/machine split)
  - `votes_27.10.2024.txt` — Per-station variable-length vote totals by party
  - `preferences_27.10.2024.txt` — Per-station × per-candidate preference votes (2,998,892 rows)
  
- `spreadsheet/*.xlsx` — Human-readable МИР sheets (ns01–ns32, 65 MB total):
  - РИКxx-Секции (polling stations)
  - РИКxx-Кандидати (candidate lists)
  - РИКxx-Гласове (per-party votes)
  - РИКxx-Точки в протоколи (turnout protocol points)

- `export/suemg/**/*.zip` — Voting machine logs with PKCS#7 signatures (9,447 zips):
  - NNNNNNNNN.csv — Raw machine vote log
  - NNNNNNNNN.csv.p7s — Digital signature (authenticity proof)

**Processing:**
- Python 3 + `openpyxl` for XLSX parsing
- `pandas` for aggregation to oblast, municipality, settlement levels
- Output to `results.json`, `results_municipalities.json`, `data_by_oblast.json`

**Geometry sources:**
- `bg.json` — Downloaded from simplemaps.com (28 oblast polygons)
- `bg-municipalities.json` — Fetched from yurukov/Bulgaria-geocoding (265 municipality polygons with NUTS4 codes)

## Platform Requirements

**Development:**
- Python 3.6+ (for data aggregation scripts)
- No special OS requirements (cross-platform)
- No IDE requirements (edit in any text editor)

**Production:**
- Static file hosting (GitHub Pages compatible)
- HTTPS recommended (for Google Fonts CDN)
- No server-side code, no database required

---

*Stack analysis: 2026-04-13*
