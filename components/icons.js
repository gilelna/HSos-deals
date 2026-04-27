// components/icons.js — central inline-SVG icon set + entity color ramps.
//
// Exposes on window:
//   HSOS_ICONS    object — key → raw <svg…> string (no width/height attrs;
//                 those are added by getIcon)
//   ENTITY_COLORS object — entity key → { bg, border, text, eyebrow }
//   getIcon(key, size = 16, color = 'currentColor') → SVG string with
//                 width/height/stroke applied. Falls back to a generic
//                 circle when the key is unknown.
//
// All icons follow the project convention:
//   viewBox="0 0 24 24" fill="none" stroke="currentColor"
//   stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
//
// No build step. Plain script — drop into any HTML page after layout.js.

;(function (global) {
  'use strict'

  const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
  const SVG_CLOSE = '</svg>'
  const wrap = body => SVG_OPEN + body + SVG_CLOSE

  // ─── Entity icons ─────────────────────────────────────────────────
  const ICONS = {
    // Person head + shoulders.
    client: wrap(
      '<circle cx="12" cy="8" r="4"/>' +
      '<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>'
    ),

    // Price tag with bead.
    deal: wrap(
      '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>' +
      '<line x1="7" y1="7" x2="7.01" y2="7"/>'
    ),

    // Briefcase with plus mark.
    vendor: wrap(
      '<rect x="2" y="7" width="20" height="14" rx="2"/>' +
      '<path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>' +
      '<line x1="12" y1="11" x2="12" y2="17"/>' +
      '<line x1="9" y1="14" x2="15" y2="14"/>'
    ),

    // Calendar with header lines + spine.
    session: wrap(
      '<rect x="3" y="4" width="18" height="18" rx="2"/>' +
      '<line x1="16" y1="2" x2="16" y2="6"/>' +
      '<line x1="8" y1="2" x2="8" y2="6"/>' +
      '<line x1="3" y1="10" x2="21" y2="10"/>'
    ),

    // Receipt zigzag with three inner lines.
    bill: wrap(
      '<path d="M4 2v20l3-2 2 2 3-2 3 2 2-2 3 2V2l-3 2-2-2-3 2-3-2-2 2-3-2z"/>' +
      '<line x1="8" y1="8"  x2="16" y2="8"/>' +
      '<line x1="8" y1="12" x2="16" y2="12"/>' +
      '<line x1="8" y1="16" x2="13" y2="16"/>'
    ),

    // Dollar coin.
    transaction: wrap(
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="12" y1="1" x2="12" y2="23"/>' +
      '<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
    ),

    // Credit card.
    invoice: wrap(
      '<rect x="2" y="5" width="20" height="14" rx="2"/>' +
      '<line x1="2" y1="10" x2="22" y2="10"/>' +
      '<line x1="6" y1="15" x2="8" y2="15"/>' +
      '<line x1="10" y1="15" x2="14" y2="15"/>'
    ),

    // 3D box.
    product: wrap(
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
      '<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>' +
      '<line x1="12" y1="22.08" x2="12" y2="12"/>'
    ),

    // Document with two text lines.
    plan: wrap(
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
      '<polyline points="14 2 14 8 20 8"/>' +
      '<line x1="8" y1="13" x2="16" y2="13"/>' +
      '<line x1="8" y1="17" x2="14" y2="17"/>'
    ),

    // File with corner fold.
    document: wrap(
      '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>' +
      '<polyline points="13 2 13 9 20 9"/>'
    ),

    // Clock with hands.
    reminder: wrap(
      '<circle cx="12" cy="12" r="10"/>' +
      '<polyline points="12 6 12 12 16 14"/>'
    ),

    // Person + plus badge.
    customer: wrap(
      '<circle cx="10" cy="8" r="4"/>' +
      '<path d="M2 21c0-4 3.4-7 8-7s8 3 8 7"/>' +
      '<line x1="19" y1="8" x2="23" y2="8"/>' +
      '<line x1="21" y1="6" x2="21" y2="10"/>'
    ),

    // ─── Spaces ────────────────────────────────────────────────────
    sales: wrap(
      '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'
    ),

    workload: wrap(
      '<circle cx="12" cy="12" r="10"/>' +
      '<polyline points="12 6 12 12 16 14"/>' +
      '<line x1="6" y1="12" x2="8" y2="12"/>'
    ),

    payments: wrap(
      '<line x1="12" y1="1" x2="12" y2="23"/>' +
      '<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
    ),

    clients_portal: wrap(
      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7" r="4"/>' +
      '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
    ),

    dashboard: wrap(
      '<rect x="3" y="3" width="7" height="7"/>' +
      '<rect x="14" y="3" width="7" height="7"/>' +
      '<rect x="3" y="14" width="7" height="7"/>' +
      '<rect x="14" y="14" width="7" height="7"/>'
    ),

    settings: wrap(
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.43.18.79.46 1.06.83.27.37.45.81.51 1.27V11h.09a2 2 0 1 1 0 4H21a1.65 1.65 0 0 0-1.51 1z"/>'
    ),
  }

  // ─── Entity colour ramps (mirror of side-panel.js values) ─────────
  const COLORS = {
    client:  { bg: '#EEEDFE', border: '#CECBF6', text: '#26215C', eyebrow: '#534AB7' },
    deal:    { bg: '#E1F5EE', border: '#9FE1CB', text: '#04342C', eyebrow: '#0F6E56' },
    vendor:  { bg: '#FAEEDA', border: '#FAC775', text: '#412402', eyebrow: '#854F0B' },
    session: { bg: '#EEEDFE', border: '#CECBF6', text: '#26215C', eyebrow: '#534AB7' },
    bill:    { bg: '#EAF3DE', border: '#C0DD97', text: '#173404', eyebrow: '#3B6D11' },
    product: { bg: '#F1EFE8', border: '#D3D1C7', text: '#2C2C2A', eyebrow: '#5F5E5A' },
    plan:    { bg: '#E1F5EE', border: '#9FE1CB', text: '#04342C', eyebrow: '#0F6E56' },
  }

  // Generic fallback so callers always get something paintable.
  const FALLBACK_BODY = '<circle cx="12" cy="12" r="9"/>'

  function getIcon(key, size, color) {
    if (size == null) size = 16
    if (color == null) color = 'currentColor'
    const body = ICONS[key]
    let svg = body || (SVG_OPEN + FALLBACK_BODY + SVG_CLOSE)
    // Replace the placeholder stroke and append width/height on the
    // opening <svg ...> tag.
    svg = svg.replace('stroke="currentColor"', `stroke="${color}"`)
    svg = svg.replace(
      /^<svg\b([^>]*)>/,
      `<svg$1 width="${Number(size)}" height="${Number(size)}">`
    )
    return svg
  }

  global.HSOS_ICONS    = ICONS
  global.ENTITY_COLORS = COLORS
  global.getIcon       = getIcon
})(typeof window !== 'undefined' ? window : globalThis)
