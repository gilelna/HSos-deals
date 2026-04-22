// profile.js — Shared utilities for vendor-profile and client-profile pages
// Loaded after db.js and app.js on both profile pages.

// ─── Overlay colors per entity type ──────────────────────────

const PROFILE_OVERLAYS = {
  // vendor types
  coach:       'rgba(26,46,26,0.82)',
  contractor:  'rgba(15,46,46,0.82)',
  staff:       'rgba(20,30,55,0.82)',
  team_member: 'rgba(20,30,55,0.82)',
  // client product types
  coaching:    'rgba(20,40,28,0.82)',
  tutoring:    'rgba(28,25,55,0.82)',
  custom:      'rgba(35,35,45,0.82)',
  other:       'rgba(35,35,45,0.82)',
}

function setProfileOverlay(typeKey) {
  const color = PROFILE_OVERLAYS[typeKey?.toLowerCase()] || PROFILE_OVERLAYS.coach
  const hero = document.querySelector('.prof-hero')
  if (hero) hero.style.setProperty('--profile-overlay', color)
}
window.setProfileOverlay = setProfileOverlay

// ─── Hero shrink on scroll ────────────────────────────────────

function initProfileHeroShrink() {
  const hero = document.querySelector('.prof-hero')
  const body = document.querySelector('.prof-body')
  if (!hero || !body) return
  body.addEventListener('scroll', () => {
    hero.classList.toggle('shrunk', body.scrollTop > 60)
  }, { passive: true })
}
window.initProfileHeroShrink = initProfileHeroShrink

// ─── Avatar background image ──────────────────────────────────

const COVER_BG_URL = "url('files/workload.png')"

function initProfileBg() {
  const bg = document.querySelector('.prof-hero__bg')
  if (bg) bg.style.backgroundImage = COVER_BG_URL
}
window.initProfileBg = initProfileBg

// ─── Tab switching ────────────────────────────────────────────

function profileSwitchTab(id, tabs, panes) {
  tabs.forEach(t  => t.classList.toggle('cur', t.dataset.tab === id))
  panes.forEach(p => p.classList.toggle('cur', p.id === id))
}
window.profileSwitchTab = profileSwitchTab

// ─── Inline name edit ─────────────────────────────────────────

// Opens a small input in-place to rename the entity
function initNameEdit(nameEl, saveFn) {
  const btn = nameEl.closest('.prof-name-row')?.querySelector('.prof-name-edit')
  if (!btn) return
  btn.addEventListener('click', () => {
    const current = nameEl.textContent.trim()
    const input = document.createElement('input')
    input.type  = 'text'
    input.value = current
    input.style.cssText = `
      font-size:22px;font-weight:600;color:#fff;background:rgba(255,255,255,0.12);
      border:none;border-bottom:2px solid rgba(255,255,255,0.6);outline:none;
      font-family:var(--font-sans);min-width:200px;padding:0 4px;
    `
    nameEl.replaceWith(input)
    btn.style.display = 'none'
    input.focus()
    input.select()
    async function commit() {
      const val = input.value.trim() || current
      const newNameEl = document.createElement('div')
      newNameEl.className = 'prof-name'
      newNameEl.textContent = val
      input.replaceWith(newNameEl)
      btn.style.display = ''
      initNameEdit(newNameEl, saveFn)
      if (val !== current) await saveFn(val)
    }
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit() }
      if (e.key === 'Escape') { input.value = current; commit() }
    })
  })
}
window.initNameEdit = initNameEdit

// ─── Doc card renderer (shared) ──────────────────────────────

function renderDocCard(doc, onDelete) {
  const isUrl  = doc.type === 'url' || doc.storage_path?.startsWith('http')
  const href   = isUrl ? doc.url || doc.storage_path : doc.url || '#'
  const ext    = (doc.filename || '').split('.').pop().toUpperCase().slice(0, 4) || 'FILE'
  const label  = doc.title || doc.filename || 'Document'

  const card = document.createElement('a')
  card.href   = href
  card.target = '_blank'
  card.rel    = 'noopener'
  card.style.cssText = `
    display:flex;flex-direction:column;gap:6px;
    background:var(--surface);border:1px solid var(--border);
    border-radius:var(--r-lg);padding:12px;cursor:pointer;
    text-decoration:none;transition:box-shadow .1s;
    position:relative;
  `
  card.addEventListener('mouseenter', () => card.style.boxShadow = '0 2px 10px rgba(0,0,0,.08)')
  card.addEventListener('mouseleave', () => card.style.boxShadow = '')

  card.innerHTML = `
    <div style="width:36px;height:36px;border-radius:var(--r);background:var(--bg);
      display:flex;align-items:center;justify-content:center;
      font-size:10px;font-family:var(--font-mono);font-weight:600;color:var(--mu)">
      ${isUrl ? '↗' : ext}
    </div>
    <div style="font-size:12px;font-weight:500;color:var(--ink);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(label)}</div>
    ${doc.description ? `<div style="font-size:11px;color:var(--mu2)">${escHtml(doc.description)}</div>` : ''}
    <button class="doc-del-btn" style="
      position:absolute;top:6px;right:6px;
      background:none;border:none;cursor:pointer;
      color:var(--mu2);font-size:13px;opacity:0;transition:opacity .1s;
      line-height:1;padding:2px 4px;border-radius:4px;
    ">✕</button>
  `
  const delBtn = card.querySelector('.doc-del-btn')
  card.addEventListener('mouseenter', () => delBtn.style.opacity = '1')
  card.addEventListener('mouseleave', () => delBtn.style.opacity = '0')
  delBtn.addEventListener('click', e => {
    e.preventDefault()
    e.stopPropagation()
    showConfirm(`Delete "${label}"?`, () => onDelete(doc), { confirmLabel: 'Delete' })
  })
  return card
}
window.renderDocCard = renderDocCard

// ─── Comms filter tabs ────────────────────────────────────────

function renderCommsSection(containerId, comms) {
  const el = document.getElementById(containerId)
  if (!el) return
  if (!comms?.length) {
    el.innerHTML = '<div class="prof-comms-empty">No communications logged yet.</div>'
    return
  }
  el.innerHTML = '<div class="prof-comms-empty">Communications log coming soon.</div>'
}
window.renderCommsSection = renderCommsSection

// esc / escHtml defined globally in app.js
