// app.js — HSos shared application layer
// Loaded on every page after db.js

// ─── role selector ────────────────────────────────────────────
const ROLES = ['Admin', 'Manager', 'Finance', 'Vendor']

const Role = {
  get() {
    return sessionStorage.getItem('hsos_role') || 'Admin'
  },
  set(r) {
    sessionStorage.setItem('hsos_role', r)
    document.body.dataset.role = r.toLowerCase()
    const btns = document.querySelectorAll('.role-btn')
    btns.forEach(b => b.classList.toggle('cur', b.dataset.role === r))
  },
  init() {
    const r = Role.get()
    document.body.dataset.role = r.toLowerCase()
  }
}
window.Role = Role

function renderRoleSelector() {
  const el = document.getElementById('role-selector')
  if (!el) return
  const cur = Role.get()
  el.innerHTML = ROLES.map(r =>
    `<button class="role-btn${r === cur ? ' cur' : ''}" data-role="${r}" onclick="Role.set('${r}')">${r}</button>`
  ).join('')
}
window.renderRoleSelector = renderRoleSelector

document.addEventListener('DOMContentLoaded', () => {
  Role.init()
  renderRoleSelector()
})

// ─── demo identity ────────────────────────────────────────────
// In demo mode, the current vendor is stored in sessionStorage.
// The vendor picker lets you switch vendor to showcase any role.

const DEMO = {
  get vendor() {
    const s = sessionStorage.getItem('hsos_vendor')
    return s ? JSON.parse(s) : null
  },
  set vendor(v) {
    if (v) sessionStorage.setItem('hsos_vendor', JSON.stringify(v))
    else sessionStorage.removeItem('hsos_vendor')
  },
  clear() { sessionStorage.removeItem('hsos_vendor') }
}
window.DEMO = DEMO

// Show vendor picker. Returns a Promise that resolves when a vendor is picked.
async function showVendorPicker(opts = {}) {
  // opts.required = true means user cannot dismiss without picking
  return new Promise(async (resolve) => {
    let vendors = []
    try { vendors = await getVendors() } catch(e) {
      console.error('[HSos] Could not load vendors:', e)
    }

    const overlay = document.createElement('div')
    overlay.id = 'vpick-overlay'
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:1000;
      background:rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
    `

    const modal = document.createElement('div')
    modal.style.cssText = `
      background:#fff;border-radius:14px;
      width:320px;padding:28px 24px 20px;
      font-family:'DM Sans',sans-serif;
    `

    modal.innerHTML = `
      <div style="font-size:18px;font-weight:600;color:#1a1a1a;margin-bottom:4px">
        Select vendor
      </div>
      <div style="font-size:11px;color:#aaa;font-family:'DM Mono',monospace;margin-bottom:20px;letter-spacing:.06em">
        DEMO MODE — pick who you are
      </div>
      <div id="vpick-list" style="display:flex;flex-direction:column;gap:6px">
        ${vendors.length === 0
          ? `<div style="color:#e05a5a;font-size:13px">No vendors found — check Supabase connection and RLS policies</div>`
          : vendors.map(v => `
            <div
              class="vpick-item"
              data-id="${v.id}"
              style="display:flex;align-items:center;gap:12px;padding:10px 12px;
                     border-radius:10px;border:1px solid #e8e4da;cursor:pointer;"
            >
              <div style="
                width:36px;height:36px;border-radius:50%;flex-shrink:0;
                background:${avatarBg(v.full_name)};color:${avatarFg(v.full_name)};
                display:flex;align-items:center;justify-content:center;
                font-size:12px;font-family:'DM Mono',monospace;font-weight:500;
              ">${initials(v.full_name)}</div>
              <div>
                <div style="font-size:14px;font-weight:500;color:#1a1a1a">${v.full_name}</div>
                <div style="font-size:11px;color:#aaa;font-family:'DM Mono',monospace">
                  ${v.vendor_type || 'vendor'}
                </div>
              </div>
            </div>
          `).join('')
        }
      </div>
      ${!opts.required ? `
        <button id="vpick-cancel" style="
          margin-top:14px;width:100%;padding:9px;border-radius:8px;
          border:1px solid #e8e4da;background:#fff;font-size:13px;
          cursor:pointer;color:#aaa;
        ">Cancel</button>
      ` : ''}
    `

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    // Click handlers
    modal.querySelectorAll('.vpick-item').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.borderColor = '#1a1a1a')
      item.addEventListener('mouseleave', () => item.style.borderColor = '#e8e4da')
      item.addEventListener('click', () => {
        const vendor = vendors.find(v => v.id === item.dataset.id)
        if (!vendor) return
        DEMO.vendor = vendor
        overlay.remove()
        updateTopbarUser(vendor)
        resolve(vendor)
      })
    })

    const cancelBtn = modal.querySelector('#vpick-cancel')
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        overlay.remove()
        resolve(null)
      })
    }
  })
}
window.showVendorPicker = showVendorPicker

// Update topbar with current vendor name and initials
function updateTopbarUser(vendor) {
  const nameEl = document.querySelector('.tb-user-name')
  const avEl   = document.querySelector('.tb-av')
  if (nameEl) nameEl.textContent = vendor?.full_name || '—'
  if (avEl) {
    if (vendor?.profile_picture_url) {
      avEl.textContent = ''
      avEl.style.backgroundImage = `url("${vendor.profile_picture_url.replace(/"/g, '%22')}")`
      avEl.style.backgroundSize = 'cover'
      avEl.style.backgroundPosition = 'center'
    } else {
      avEl.textContent = initials(vendor?.full_name || '')
      avEl.style.backgroundImage = ''
    }
  }
}
window.updateTopbarUser = updateTopbarUser

// ─── toast ───────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  let t = document.getElementById('hsos-toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'hsos-toast'
    document.body.appendChild(t)
  }
  t.className = `hsos-toast ${type}`
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.classList.remove('show'), 2800)
}
window.showToast = showToast

// ─── helpers ─────────────────────────────────────────────────

function initials(name = '') {
  return (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}
window.initials = initials

const _AV_COLORS = [
  { bg: '#E1F5EE', fg: '#085041' },
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#FAECE7', fg: '#712B13' },
  { bg: '#FAEEDA', fg: '#633806' },
  { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#F1EFE8', fg: '#444441' },
]
function avatarColors(name = '') {
  return _AV_COLORS[(name.charCodeAt(0) || 0) % _AV_COLORS.length]
}
function avatarBg(name) { return avatarColors(name).bg }
function avatarFg(name) { return avatarColors(name).fg }
window.avatarBg = avatarBg
window.avatarFg = avatarFg

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatMonth(ym) {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}
window.formatDate  = formatDate
window.formatMonth = formatMonth
