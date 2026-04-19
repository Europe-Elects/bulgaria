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

  // Pan + zoom helper. Wraps every child of `svg` into a <g> viewport
  // that can be translated and scaled. Call after each render; it
  // attaches the viewport and handlers exactly once per SVG.
  // opts.controls = { zoomIn, zoomOut, zoomReset, zoomLevel } — DOM IDs or elements
  function enableZoomPan(svg, opts) {
    opts = opts || {};
    if (!svg || svg.__zoomPanInit) {
      rewrap(svg);
      if (svg && svg.__updateZoomLevel) svg.__updateZoomLevel();
      return;
    }
    svg.__zoomPanInit = true;
    rewrap(svg);

    const state = { k: 1, tx: 0, ty: 0, minK: 1, maxK: opts.maxK || 12 };
    svg.__zoomPanState = state;
    svg.style.cursor = 'grab';

    const resolve = (x) => typeof x === 'string' ? document.getElementById(x) : x;
    const ctrls = opts.controls || {};
    const levelEl = resolve(ctrls.zoomLevel);
    const updateLevel = () => { if (levelEl) levelEl.textContent = state.k.toFixed(1) + 'x'; };
    svg.__updateZoomLevel = updateLevel;

    const apply = () => {
      const g = svg.__viewport;
      if (g) g.setAttribute('transform', `translate(${state.tx},${state.ty}) scale(${state.k})`);
      updateLevel();
    };

    // Zoom by factor around the centre of the current viewport
    const zoomByFactor = (factor) => {
      const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      const vbW = vb[2] || 1000, vbH = vb[3] || 600;
      // current visible centre in the original (unscaled) coord space
      const cx = (vbW / 2 - state.tx) / state.k;
      const cy = (vbH / 2 - state.ty) / state.k;
      const newK = Math.min(state.maxK, Math.max(state.minK, state.k * factor));
      if (newK === state.k) return;
      state.k = newK;
      state.tx = vbW / 2 - cx * newK;
      state.ty = vbH / 2 - cy * newK;
      clampPan(svg); apply();
    };
    const resetZoom = () => { state.k = 1; state.tx = 0; state.ty = 0; apply(); };

    const bin = resolve(ctrls.zoomIn);
    const bout = resolve(ctrls.zoomOut);
    const brst = resolve(ctrls.zoomReset);
    if (bin) bin.addEventListener('click', () => zoomByFactor(1.5));
    if (bout) bout.addEventListener('click', () => zoomByFactor(1/1.5));
    if (brst) brst.addEventListener('click', resetZoom);

    const svgPoint = (clientX, clientY) => {
      const r = svg.getBoundingClientRect();
      const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      const vbW = vb[2] || r.width, vbH = vb[3] || r.height;
      return { x: (clientX - r.left) * (vbW / r.width), y: (clientY - r.top) * (vbH / r.height) };
    };

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = svgPoint(e.clientX, e.clientY);
      const dir = e.deltaY < 0 ? 1 : -1;
      const factor = Math.exp(dir * 0.12);
      const newK = Math.min(state.maxK, Math.max(state.minK, state.k * factor));
      // keep the cursor point stable under zoom
      state.tx = p.x - (p.x - state.tx) * (newK / state.k);
      state.ty = p.y - (p.y - state.ty) * (newK / state.k);
      state.k = newK;
      clampPan(svg);
      apply();
    }, { passive: false });

    let dragging = false, lastX = 0, lastY = 0;
    svg.addEventListener('pointerdown', (e) => {
      if (state.k <= state.minK + 1e-6) return; // no panning at base zoom
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      svg.setPointerCapture(e.pointerId);
      svg.style.cursor = 'grabbing';
    });
    svg.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = svg.getBoundingClientRect();
      const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      const vbW = vb[2] || r.width, vbH = vb[3] || r.height;
      state.tx += (e.clientX - lastX) * (vbW / r.width);
      state.ty += (e.clientY - lastY) * (vbH / r.height);
      lastX = e.clientX; lastY = e.clientY;
      clampPan(svg);
      apply();
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try { svg.releasePointerCapture(e.pointerId); } catch (err) {}
      svg.style.cursor = state.k > state.minK + 1e-6 ? 'grab' : 'grab';
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    svg.addEventListener('dblclick', (e) => {
      e.preventDefault();
      state.k = 1; state.tx = 0; state.ty = 0;
      apply();
    });
  }

  function rewrap(svg) {
    const ns = 'http://www.w3.org/2000/svg';
    let g = svg.__viewport;
    if (!g || g.parentNode !== svg) {
      g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'viewport');
      svg.__viewport = g;
    } else {
      // already attached; just move any loose children into it
    }
    // Move any direct children of svg that aren't the viewport into it,
    // preserving <defs> at the top level (defs don't need to scale).
    const toMove = [];
    for (const c of Array.from(svg.childNodes)) {
      if (c === g) continue;
      if (c.nodeType === 1 && c.tagName.toLowerCase() === 'defs') continue;
      toMove.push(c);
    }
    if (g.parentNode !== svg) svg.appendChild(g);
    toMove.forEach(c => g.appendChild(c));
    // re-apply transform if state exists
    const s = svg.__zoomPanState;
    if (s) g.setAttribute('transform', `translate(${s.tx},${s.ty}) scale(${s.k})`);
  }

  function clampPan(svg) {
    const s = svg.__zoomPanState;
    if (!s) return;
    const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    const vbW = vb[2] || 1000, vbH = vb[3] || 600;
    // allow panning as long as some of the scaled content overlaps the viewBox
    const scaledW = vbW * s.k, scaledH = vbH * s.k;
    const minTx = vbW - scaledW, maxTx = 0;
    const minTy = vbH - scaledH, maxTy = 0;
    s.tx = Math.min(maxTx, Math.max(minTx, s.tx));
    s.ty = Math.min(maxTy, Math.max(minTy, s.ty));
  }

  window.EE = {
    NO_DATA_COLOR, META_KEYS,
    hexToRgb, parseRgb, isLightFill, partyShade, turnoutShade, partyMaxPct, cssId,
    getWinner, hasData,
    bbox, makeProjection, featurePath, featureCentroid,
    buildSplitPatterns,
    loadResults, autoRefresh,
    formatTs, setCountedPill, setLiveDot,
    enableZoomPan,
  };
})();
