// activity-log.js — HSos Activity Log page

// Minimal inline Markdown renderer.
// Input is application data stored in DB (not raw HTTP input).
// HTML entities are escaped first, then only bold/italic/URL patterns applied.
function renderMd(text) {
  if (!text) return ''
  let s = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  s = s.replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
  return s
}

let _allActivities = []

function fmtDateTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function typeBadge(type) {
  const t = type || 'system_log'
  return `<span class="act-type-badge act-type-${t}">${t}</span>`
}

function statusBadge(status) {
  if (!status) return '—'
  return `<span class="act-status-badge act-status-${status}">${status}</span>`
}

function entityLabel(row) {
  if (!row.entity_type) return '—'
  const idSlice = row.entity_id.length > 8 ? row.entity_id.slice(0, 8) + '…' : row.entity_id
  const id = row.entity_id ? `<br><span style="font-size:10px;color:var(--mu);font-family:var(--font-mono)">${idSlice}</span>` : ''
  return row.entity_type + id
}

function renderActivityTable() {
  const search       = (document.getElementById('act-search')?.value || '').toLowerCase()
  const typeFilter   = document.getElementById('act-filter-type')?.value   || ''
  const statusFilter = document.getElementById('act-filter-status')?.value || ''

  const rows = _allActivities.filter(a => {
    if (typeFilter   && a.type   !== typeFilter)   return false
    if (statusFilter && a.status !== statusFilter) return false
    if (search && !(a.body || '').toLowerCase().includes(search)) return false
    return true
  })

  const tbody = document.getElementById('act-tbody')
  if (!tbody) return

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="act-empty">No activities match the current filters.</td></tr>`
    return
  }

  tbody.innerHTML = rows.map(a => `
    <tr>
      <td style="font-size:11px;font-family:var(--font-mono);white-space:nowrap">${fmtDateTime(a.created_at)}</td>
      <td style="font-size:11px">${entityLabel(a)}</td>
      <td>${typeBadge(a.type)}</td>
      <td style="font-size:11px;color:var(--mu)">${a.subtype || '—'}</td>
      <td class="act-body-cell" style="font-size:12px">${renderMd(a.body)}</td>
      <td>${statusBadge(a.status)}</td>
      <td class="act-origin-badge">${a.origin || '—'}</td>
    </tr>
  `).join('')
}

async function initActivityLog() {
  await LAYOUT.init('Activity Log', 'payments')

  try {
    _allActivities = await getActivities()
  } catch (err) {
    console.error('[ActivityLog] load failed', err)
    const tbody = document.getElementById('act-tbody')
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="act-empty">Failed to load activities.</td></tr>`
    return
  }

  renderActivityTable()
}

document.addEventListener('DOMContentLoaded', initActivityLog)
