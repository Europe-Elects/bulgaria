/* Bulgaria Election Maps — shared utilities
 * Attach to window.EE so pages can `const { ... } = window.EE;`
 */
(function () {
  'use strict';

  const NO_DATA_COLOR = '#E2E8F0';
  const META_KEYS = new Set(['name', 'name_en', 'turnout', 'turnout_pct', 'seats']);

  /* ---------- colour ---------- */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function parseRgb(str) {
    if (!str) return null;
    if (str.startsWith('#')) return hexToRgb(str);
    const m = str.match(/\d+/g);
    return m ? { r: +m[0], g: +m[1], b: +m[2] } : null;
  }
  function isLightFill(fill) {
    const c = parseRgb(fill);
    if (!c) return true;
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.62;
  }
  function partyShade(pct, maxPct, baseHex) {
    if (pct === null || pct === undefined || pct <= 0) return NO_DATA_COLOR;
    const t = Math.max(0, Math.min(1, pct / Math.max(maxPct, 0.01)));
    const b = hexToRgb(baseHex);
    const r = Math.round(255 + (b.r - 255) * t);
    const g = Math.round(255 + (b.g - 255) * t);
    const bl = Math.round(255 + (b.b - 255) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function turnoutShade(pct, minPct, maxPct) {
    if (pct === null || pct === undefined || pct <= 0) return NO_DATA_COLOR;
    const span = Math.max(0.01, maxPct - minPct);
    const t = Math.max(0, Math.min(1, (pct - minPct) / span));
    // slate-50 → indigo-600 (election-ready neutral gradient)
    const from = { r: 248, g: 250, b: 252 };
    const to = { r: 67, g: 56, b: 202 };
    const r = Math.round(from.r + (to.r - from.r) * t);
    const g = Math.round(from.g + (to.g - from.g) * t);
    const bl = Math.round(from.b + (to.b - from.b) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function partyMaxPct(data, party) {
    let mx = 0;
    for (const d of Object.values(data || {})) {
      if (d && typeof d[party] === 'number' && d[party] > mx) mx = d[party];
    }
    return Math.max(10, mx * 1.1);
  }
  function cssId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '_'); }

  /* ---------- data helpers ---------- */
  function getWinner(d) {
    if (!d) return null;
    let max = 0, w = null;
    for (const [p, v] of Object.entries(d)) {
      if (META_KEYS.has(p)) continue;
      if (typeof v === 'number' && v > max) { max = v; w = p; }
    }
    return max > 0 ? { party: w, pct: max } : null;
  }
  function hasData(d) {
    if (!d) return false;
    return Object.entries(d).some(([k, v]) => !META_KEYS.has(k) && typeof v === 'number' && v > 0);
  }

  /* ---------- geometry ---------- */
  function bbox(features) {
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    for (const f of features) {
      const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of rings) for (const ring of poly) for (const [x, y] of ring) {
        if (x < mnx) mnx = x; if (y < mny) mny = y;
        if (x > mxx) mxx = x; if (y > mxy) mxy = y;
      }
    }
    return [mnx, mny, mxx, mxy];
  }
  function makeProjection(bx, w, h) {
    const [minLon, minLat, maxLon, maxLat] = bx;
    const midLat = (minLat + maxLat) / 2 * Math.PI / 180;
    const sx = Math.cos(midLat);
    const lonRange = (maxLon - minLon) * sx, latRange = (maxLat - minLat);
    const scale = Math.min(w / lonRange, h / latRange) * 0.95;
    const ox = (w - lonRange * scale) / 2, oy = (h - latRange * scale) / 2;
    return (lon, lat) => [(lon - minLon) * sx * scale + ox, h - ((lat - minLat) * scale + oy)];
  }
  function featurePath(f, proj) {
    const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let d = '';
    for (const poly of rings) for (const ring of poly) {
      d += ring.map(([lon, lat], i) => { const [x, y] = proj(lon, lat); return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1); }).join('') + 'Z';
    }
    return d;
  }
  function polygonCentroid(ring) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x0, y0] = ring[j], [x1, y1] = ring[i];
      const f = x0 * y1 - x1 * y0;
      a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
    }
    a *= 0.5;
    return a === 0 ? ring[0] : [cx / (6 * a), cy / (6 * a)];
  }
  function featureCentroid(f, proj) {
    const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let best = null, bestArea = -1;
    for (const poly of rings) {
      const outer = poly[0].map(([lon, lat]) => proj(lon, lat));
      let a = 0;
      for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
        a += outer[j][0] * outer[i][1] - outer[i][0] * outer[j][1];
      }
      a = Math.abs(a / 2);
      if (a > bestArea) { bestArea = a; best = outer; }
    }
    const [cx, cy] = polygonCentroid(best);
    return { cx, cy };
  }

  /* ---------- SVG split-colour pattern (coalitions) ---------- */
  function buildSplitPatterns(svg, parties) {
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    for (const [key, p] of Object.entries(parties)) {
      if (!p.color2) continue;
      const pat = document.createElementNS(ns, 'pattern');
      pat.setAttribute('id', 'split-' + cssId(key));
      pat.setAttribute('patternUnits', 'userSpaceOnUse');
      pat.setAttribute('width', '10'); pat.setAttribute('height', '10');
      pat.setAttribute('patternTransform', 'rotate(45)');
      const r1 = document.createElementNS(ns, 'rect');
      r1.setAttribute('x', '0'); r1.setAttribute('y', '0'); r1.setAttribute('width', '5'); r1.setAttribute('height', '10');
      r1.setAttribute('fill', p.color);
      const r2 = document.createElementNS(ns, 'rect');
      r2.setAttribute('x', '5'); r2.setAttribute('y', '0'); r2.setAttribute('width', '5'); r2.setAttribute('height', '10');
      r2.setAttribute('fill', p.color2);
      pat.appendChild(r1); pat.appendChild(r2);
      defs.appendChild(pat);
    }
    svg.appendChild(defs);
  }

  /* ---------- fetch + refresh ---------- */
  async function loadResults(path = 'results_live.json') {
    const r = await fetch(path + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('fetch failed: ' + r.status);
    return r.json();
  }
  function autoRefresh(fn, ms = 60000) {
    return setInterval(async () => {
      try { await fn(); } catch (e) { /* silent; watchdog catches stalls */ }
    }, ms);
  }

  /* ---------- UI helpers ---------- */
  function formatTs(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Sofia' });
  }
  function setCountedPill(el, pct) {
    if (typeof pct !== 'number' || pct <= 0 || pct >= 100) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'inline-block';
    el.textContent = pct.toFixed(1) + '% counted';
  }
  function setLiveDot(el, isLive) {
    el.classList.toggle('live', !!isLive);
  }

  window.EE = {
    NO_DATA_COLOR, META_KEYS,
    hexToRgb, parseRgb, isLightFill, partyShade, turnoutShade, partyMaxPct, cssId,
    getWinner, hasData,
    bbox, makeProjection, featurePath, featureCentroid,
    buildSplitPatterns,
    loadResults, autoRefresh,
    formatTs, setCountedPill, setLiveDot,
  };
})();
