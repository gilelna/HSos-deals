// admin/users.js — User management page (admin-only).
//
// Reads via getAllProfiles() (RPC: get_user_management_rows). Inline role edit
// via updateProfileRole() (RPC: update_profile_role). Both RPCs are admin-gated
// server-side; this file also redirects non-admins client-side after the auth
// gate resolves so the page never shells out an empty list.
//
// Row click (outside the role <select>) opens the vendor side panel when the
// user has vendor_id; otherwise paints a small inline profile card.

const ROLE_VALUES = ['admin', 'manager', 'finance', 'vendor']

let umRows = []

// ── helpers ──────────────────────────────────────────────────────────────────
function umDaysSince(iso) {
  if (!iso) return Infinity
  const ms = Date.now() - new Date(iso).getTime()
  return ms / 86400000
}

function umRelTime(iso) {
  const days = umDaysSince(iso)
  if (days < 1)   return Math.max(1, Math.round(days * 24)) + 'h ago'
  if (days < 30)  return Math.round(days) + 'd ago'
  if (days < 365) return Math.round(days / 30) + 'mo ago'
  return Math.round(days / 365) + 'y ago'
}

function umBuildStatusCell(td, lastSignInAt) {
  // last_sign_in_at: Supabase updates this on each successful sign-in. We show:
  //   • green dot — within last 24h    (active recently)
  //   • amber dot — within last 30 days (returning user)
  //   • gray  dot — older or never     (dormant / never signed in)
  while (td.firstChild) td.removeChild(td.firstChild)
  const dot = document.createElement('span')
  dot.className = 'um-dot'
  const label = document.createElement('span')
  label.className = 'um-status-label'

  if (!lastSignInAt) {
    dot.classList.add('um-dot-gray')
    label.textContent = 'never'
  } else {
    const days = umDaysSince(lastSignInAt)
    if (days < 1)        { dot.classList.add('um-dot-green'); label.textContent = 'active' }
    else if (days < 30)  { dot.classList.add('um-dot-amber'); label.textContent = umRelTime(lastSignInAt) }
    else                 { dot.classList.add('um-dot-gray');  label.textContent = umRelTime(lastSignInAt) }
  }
  td.appendChild(dot)
  td.appendChild(label)
}

function umFmtJoined(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function umDisplayName(row) {
  return row.full_name || row.email || row.id
}

function umMessageRow(text, color) {
  const tbody = document.getElementById('um-tbody')
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild)
  const tr = document.createElement('tr')
  const td = document.createElement('td')
  td.colSpan = 5
  td.style.padding = '40px'
  td.style.textAlign = 'center'
  td.style.color = color || 'var(--mu2)'
  td.style.fontSize = '13px'
  td.textContent = text
  tr.appendChild(td)
  tbody.appendChild(tr)
}

// ── data ─────────────────────────────────────────────────────────────────────
async function umLoad() {
  const badge = document.getElementById('um-count-badge')
  try {
    umRows = await getAllProfiles()
  } catch (err) {
    const code = err?.message || ''
    if (/forbidden_admin_only/i.test(code)) {
      window.location.replace('/index.html')
      return
    }
    umMessageRow('Failed to load users: ' + code, 'var(--red-text)')
    return
  }

  badge.textContent = umRows.length + ' user' + (umRows.length === 1 ? '' : 's')

  if (!umRows.length) {
    umMessageRow('No users yet.')
    return
  }

  umRender()
}

function umRender() {
  const tbody = document.getElementById('um-tbody')
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild)

  for (const row of umRows) {
    const tr = document.createElement('tr')
    tr.dataset.userId = row.id
    tr.dataset.vendorId = row.vendor_id || ''
    tr.style.cursor = 'pointer'

    // ── name + email ──
    const tdUser = document.createElement('td')
    const nameEl = document.createElement('div')
    nameEl.style.fontWeight = '600'
    nameEl.style.color = 'var(--ink)'
    nameEl.textContent = umDisplayName(row)
    const emailEl = document.createElement('div')
    emailEl.style.fontSize = '11px'
    emailEl.style.color = 'var(--mu)'
    emailEl.style.fontFamily = 'var(--font-mono)'
    emailEl.style.marginTop = '2px'
    emailEl.textContent = row.email || ''
    tdUser.appendChild(nameEl)
    tdUser.appendChild(emailEl)
    tr.appendChild(tdUser)

    // ── role select ──
    const tdRole = document.createElement('td')
    const wrap = document.createElement('div')
    wrap.className = 'um-role-wrap'

    const sel = document.createElement('select')
    sel.className = 'fi um-role-select'
    sel.dataset.userId = row.id
    sel.dataset.original = row.system_role || ''
    for (const r of ROLE_VALUES) {
      const opt = document.createElement('option')
      opt.value = r
      opt.textContent = r
      if (r === row.system_role) opt.selected = true
      sel.appendChild(opt)
    }
    sel.addEventListener('click', e => e.stopPropagation())
    sel.addEventListener('change', umOnRoleChange)
    wrap.appendChild(sel)

    const ok = document.createElement('span')
    ok.className = 'um-role-check'
    ok.textContent = '✓'
    ok.style.display = 'none'
    wrap.appendChild(ok)

    tdRole.appendChild(wrap)
    tr.appendChild(tdRole)

    // ── vendor link ──
    const tdVendor = document.createElement('td')
    if (row.vendor_id && row.vendor_name) {
      const a = document.createElement('a')
      a.href = '#'
      a.textContent = row.vendor_name
      a.style.color = 'var(--blue-text)'
      a.style.textDecoration = 'underline'
      a.dataset.vendorId = row.vendor_id
      a.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        umOpenVendor(row.vendor_id)
      })
      tdVendor.appendChild(a)
    } else if (row.vendor_id) {
      const span = document.createElement('span')
      span.className = 'mono'
      span.style.fontSize = '11px'
      span.style.color = 'var(--mu2)'
      span.textContent = row.vendor_id
      tdVendor.appendChild(span)
    } else {
      const dash = document.createElement('span')
      dash.style.color = 'var(--mu2)'
      dash.textContent = '—'
      tdVendor.appendChild(dash)
    }
    tr.appendChild(tdVendor)

    // ── status ──
    const tdStatus = document.createElement('td')
    umBuildStatusCell(tdStatus, row.last_sign_in_at)
    tr.appendChild(tdStatus)

    // ── joined ──
    const tdJoined = document.createElement('td')
    tdJoined.className = 'mono'
    tdJoined.style.fontSize = '11px'
    tdJoined.style.color = 'var(--mu)'
    tdJoined.textContent = umFmtJoined(row.created_at)
    tr.appendChild(tdJoined)

    tr.addEventListener('click', () => umOpenRow(row))

    tbody.appendChild(tr)
  }
}

// ── inline role edit ────────────────────────────────────────────────────────
async function umOnRoleChange(e) {
  const sel = e.currentTarget
  const userId   = sel.dataset.userId
  const newRole  = sel.value
  const original = sel.dataset.original
  if (newRole === original) return

  const wrap = sel.parentElement
  const ok = wrap.querySelector('.um-role-check')

  sel.disabled = true
  if (ok) {
    ok.textContent = '…'
    ok.style.color = 'var(--mu2)'
    ok.style.display = 'inline-block'
  }

  try {
    await updateProfileRole(userId, newRole)
    sel.dataset.original = newRole
    const row = umRows.find(r => r.id === userId)
    if (row) row.system_role = newRole
    if (ok) {
      ok.textContent = '✓'
      ok.style.color = 'var(--green-text)'
      setTimeout(() => { ok.style.display = 'none' }, 1400)
    }
  } catch (err) {
    sel.value = original
    if (ok) ok.style.display = 'none'
    const code = err?.message || 'Failed to update role'
    if (/cannot_demote_self/i.test(code)) {
      showToast('You cannot demote yourself from admin.', 'error')
    } else if (/forbidden_admin_only/i.test(code)) {
      showToast('Admins only.', 'error')
    } else {
      showToast(code, 'error')
    }
  } finally {
    sel.disabled = false
  }
}

// ── row click → vendor side panel or inline profile card ─────────────────────
function umOpenRow(row) {
  if (row.vendor_id) {
    umOpenVendor(row.vendor_id)
    return
  }
  umShowProfileCard(row)
}

function umOpenVendor(vendorId) {
  if (window.SidePanel?.open)    { window.SidePanel.open('vendor', { id: vendorId }); return }
  if (window.PanelManager?.open) { window.PanelManager.open('vendor', vendorId);     return }
  showToast('Side panel unavailable', 'error')
}

function umShowProfileCard(row) {
  const existing = document.getElementById('um-profile-card-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'um-profile-card-overlay'
  overlay.className = 'um-overlay'

  const card = document.createElement('div')
  card.className = 'um-profile-card'

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'um-profile-close'
  close.textContent = '×'
  close.setAttribute('aria-label', 'Close')
  close.addEventListener('click', () => overlay.remove())
  card.appendChild(close)

  const eyebrow = document.createElement('div')
  eyebrow.className = 'um-profile-eyebrow'
  eyebrow.textContent = 'Profile · ' + (row.system_role || '—')
  card.appendChild(eyebrow)

  const title = document.createElement('div')
  title.className = 'um-profile-title'
  title.textContent = umDisplayName(row)
  card.appendChild(title)

  const email = document.createElement('div')
  email.className = 'um-profile-email'
  email.textContent = row.email || ''
  card.appendChild(email)

  const note = document.createElement('div')
  note.className = 'um-profile-note'
  note.textContent = 'No vendor record linked to this user.'
  card.appendChild(note)

  overlay.appendChild(card)
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove()
  })
  document.body.appendChild(overlay)
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return
  const o = document.getElementById('um-profile-card-overlay')
  if (o) o.remove()
})

// ── client-side admin gate ───────────────────────────────────────────────────
// LAYOUT._runAuthGate ensures __hsosAuth.profile.system_role is non-null.
// If it's not 'admin', redirect home — the RPC would also reject, but this
// is faster and gives a cleaner UX.
function umEnforceAdmin() {
  const role = (window.__hsosAuth?.profile?.system_role || '').toLowerCase()
  if (role !== 'admin') {
    window.location.replace('/index.html')
    return false
  }
  return true
}

// ── boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (window.LAYOUT?.init) await window.LAYOUT.init('Manage Users', 'operations')
  if (!umEnforceAdmin()) return
  umLoad()
})
