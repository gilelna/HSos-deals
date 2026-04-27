// deals-clients.js — clients page

function setClientsSearch(v) {
  _clientSearch = v.toLowerCase()
  renderClients()
}
window.setClientsSearch = setClientsSearch

// Skeleton placeholder rendered while initial loadData() is in flight.
// Static markup; no user-supplied strings.
function renderClientsSkeleton() {
  const list = document.getElementById('clients-list')
  if (!list || _clients.length) return
  let html = ''
  for (let i = 0; i < 8; i++) {
    html +=
      '<div class="skeleton-row">' +
        '<div class="skeleton-shimmer" style="width:24px;height:24px;border-radius:50%;flex:0 0 auto"></div>' +
        '<div class="skeleton-shimmer" style="width:60%"></div>' +
      '</div>'
  }
  list.innerHTML = html
}
window.renderClientsSkeleton = renderClientsSkeleton

function renderClients() {
  const list = document.getElementById('clients-list')
  let clients = [..._clients]
  if (_clientSearch) clients = clients.filter(c => c.full_name.toLowerCase().includes(_clientSearch))

  list.innerHTML = clients.map(c => {
    const deals = _deals.filter(d => d.client_id === c.id)
    return `
      <div class="client-list-item${_selClientId === c.id ? ' sel' : ''}" onclick="showClientDetail('${c.id}',event)" style="position:relative">
        <div class="av av-sm" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)}">${initials(c.full_name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.full_name)}</div>
          <div style="font-size:11px;color:var(--mu2)">${deals.length} deal${deals.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="client-del-btn" onclick="deleteClientFromList('${c.id}',event)" title="Delete client"
          style="display:none;position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--red);font-size:14px;padding:2px 4px;line-height:1">&#x2715;</button>
      </div>
    `
  }).join('') || `<div style="padding:24px;text-align:center;color:var(--mu2)">No clients found</div>`

  list.querySelectorAll('.client-list-item').forEach(row => {
    const btn = row.querySelector('.client-del-btn')
    row.addEventListener('mouseenter', () => { if (btn) btn.style.display = '' })
    row.addEventListener('mouseleave', () => { if (btn) btn.style.display = 'none' })
  })
}

function showClientDetail(clientId, e, from = 'list') {
  e?.stopPropagation()
  const source = from || 'list'
  if (window.Router && !_routerDispatching) {
    Router.open({
      entity: 'client',
      id: clientId,
      view: 'panel',
      from: source,
    })
    return
  }
  if (window.SidePanel?.open) { window.SidePanel.open('client', { id: clientId }); return }
  window.PanelManager?.open('client', clientId)
}
window.showClientDetail = showClientDetail

// ─── add client panel ─────────────────────────────────────────

function openAddClientPanel() {
  document.getElementById('ac-name').value    = ''
  document.getElementById('ac-email').value   = ''
  document.getElementById('ac-phone').value   = ''
  document.getElementById('ac-notes').value   = ''
  document.getElementById('ac-source').value  = 'manual'
  document.getElementById('ac-company').value = ''
  document.querySelector('input[name="ac-kind"][value="private"]').checked = true
  document.getElementById('ac-company-row').style.display = 'none'

  document.getElementById('add-client-overlay').style.display = 'block'
  document.getElementById('add-client-panel').style.display   = 'flex'
  setTimeout(() => document.getElementById('ac-name').focus(), 50)
}
window.openAddClientPanel = openAddClientPanel

function closeAddClientPanel() {
  document.getElementById('add-client-overlay').style.display = 'none'
  document.getElementById('add-client-panel').style.display   = 'none'
}
window.closeAddClientPanel = closeAddClientPanel

function acToggleCompany(val) {
  document.getElementById('ac-company-row').style.display = val === 'corporate' ? 'block' : 'none'
}
window.acToggleCompany = acToggleCompany

async function submitAddClient() {
  const name = document.getElementById('ac-name').value.trim()
  if (!name) { showToast('Full name is required', 'warn'); return }

  const kind = document.querySelector('input[name="ac-kind"]:checked')?.value || 'private'
  const fields = {
    full_name:   name,
    email:       document.getElementById('ac-email').value.trim()   || null,
    phone:       document.getElementById('ac-phone').value.trim()   || null,
    client_kind: kind,
    company:     kind === 'corporate' ? (document.getElementById('ac-company').value.trim() || null) : null,
    source:      document.getElementById('ac-source').value,
    notes:       document.getElementById('ac-notes').value.trim()   || null,
    active:      true,
  }

  try {
    const newClient = await createClient(fields)
    _clients.push(newClient)
    _clients.sort((a, b) => a.full_name.localeCompare(b.full_name))
    closeAddClientPanel()
    renderClients()
    showToast(`${newClient.full_name} added`, 'success')
    showClientDetail(newClient.id, null, 'list')
  } catch (err) {
    showToast('Failed to create client: ' + err.message, 'warn')
  }
}
window.submitAddClient = submitAddClient

async function deleteClientFromList(clientId, e) {
  e?.stopPropagation()
  const client = _clients.find(c => c.id === clientId)
  if (!client) return
  const activeDeals = _deals.filter(d => d.client_id === clientId)
  const dealWarning = activeDeals.length
    ? ` This client has ${activeDeals.length} deal${activeDeals.length !== 1 ? 's' : ''} that will also be deleted.`
    : ''
  showConfirm(
    `Delete "${client.full_name}"? This cannot be undone.${dealWarning}`,
    async () => {
      try {
        await deleteClient(clientId)
        _clients = _clients.filter(c => c.id !== clientId)
        _deals   = _deals.filter(d => d.client_id !== clientId)
        if (_selClientId === clientId) _selClientId = null
        renderClients()
        renderDeals()
        showToast(`${client.full_name} deleted`)
      } catch(err) {
        console.error('[HSos] deleteClientFromList error:', err)
        showToast('Delete failed — check console', 'warn')
      }
    }
  )
}
window.deleteClientFromList = deleteClientFromList

// ─── AC import panel ──────────────────────────────────────────

let _acParsed = [] // [{first_name, last_name, email, phone, tags[], _status, _existing}]

function openAcImportPanel() {
  document.getElementById('ac-paste-input').value = ''
  document.getElementById('ac-parse-error').style.display = 'none'
  _showAcStep(1)
  document.getElementById('ac-import-overlay').style.display = 'block'
  document.getElementById('ac-import-panel').style.display   = 'flex'
}
window.openAcImportPanel = openAcImportPanel

function closeAcImportPanel() {
  document.getElementById('ac-import-overlay').style.display = 'none'
  document.getElementById('ac-import-panel').style.display   = 'none'
  _acParsed = []
}
window.closeAcImportPanel = closeAcImportPanel

function _showAcStep(n) {
  document.getElementById('ac-step-1').style.display = n === 1 ? 'flex' : 'none'
  document.getElementById('ac-step-2').style.display = n === 2 ? 'flex' : 'none'
  document.getElementById('ac-import-title').textContent = n === 1 ? 'Import from ActiveCampaign' : 'Review & Import'
  document.getElementById('ac-import-sub').textContent   = n === 1 ? 'Paste contact data to import' : 'Review parsed contacts before importing'
}

function _acParseJSON(raw) {
  const arr = JSON.parse(raw)
  if (!Array.isArray(arr)) throw new Error('Expected a JSON array')
  return arr.map(r => ({
    first_name: (r.first_name || r.firstName || r['First Name'] || '').trim(),
    last_name:  (r.last_name  || r.lastName  || r['Last Name']  || '').trim(),
    email:      (r.email      || r['Email']   || '').trim().toLowerCase(),
    phone:      (r.phone      || r['Phone']   || '').trim(),
    tags:       Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(',').map(t => t.trim()) : []),
    external_id:(r.id || r.contact_id || '').toString().trim() || null,
  }))
}

function _acParseCSV(raw) {
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const vals = line.split(',')
    const row  = {}
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim() })
    const tagsRaw = row.tags || ''
    return {
      first_name:  row.first_name  || '',
      last_name:   row.last_name   || '',
      email:       (row.email      || '').toLowerCase(),
      phone:       row.phone       || '',
      tags:        tagsRaw ? tagsRaw.split(';').map(t => t.trim()).filter(Boolean) : [],
      external_id: row.id || row.contact_id || null,
    }
  })
}

function acParseAndReview() {
  const raw = document.getElementById('ac-paste-input').value.trim()
  const errEl = document.getElementById('ac-parse-error')
  errEl.style.display = 'none'

  if (!raw) { errEl.textContent = 'Paste some data first'; errEl.style.display = 'block'; return }

  let rows = []
  try {
    rows = raw.startsWith('[') || raw.startsWith('{') ? _acParseJSON(raw) : _acParseCSV(raw)
  } catch (err) {
    errEl.textContent = 'Parse error: ' + err.message
    errEl.style.display = 'block'
    return
  }

  if (!rows.length) { errEl.textContent = 'No contacts found in pasted data'; errEl.style.display = 'block'; return }

  const existingByEmail = {}
  _clients.forEach(c => { if (c.email) existingByEmail[c.email.toLowerCase()] = c })

  _acParsed = rows.map(r => {
    const full = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || 'Unknown'
    const existing = r.email ? existingByEmail[r.email.toLowerCase()] : null
    return { ...r, _fullName: full, _existing: existing || null, _merge: !!existing, _selected: true }
  })

  _renderAcReviewTable()
  _showAcStep(2)
}
window.acParseAndReview = acParseAndReview

function _renderAcReviewTable() {
  const tbody = document.getElementById('ac-review-tbody')
  const countEl = document.getElementById('ac-review-count')
  const selected = _acParsed.filter(r => r._selected).length
  countEl.textContent = `${selected} / ${_acParsed.length} selected`

  tbody.innerHTML = _acParsed.map((r, i) => {
    const isDup = !!r._existing
    const statusHtml = isDup
      ? `<div style="font-size:11px;color:var(--amber-text)">Duplicate</div>
         <label style="font-size:10px;display:flex;align-items:center;gap:4px;margin-top:2px;cursor:pointer">
           <input type="checkbox" ${r._merge ? 'checked' : ''} onchange="acToggleMerge(${i},this.checked)"> merge
         </label>`
      : `<span style="font-size:11px;color:var(--green-text)">New</span>`

    return `<tr style="opacity:${r._selected ? '1' : '0.4'}">
      <td><input type="checkbox" ${r._selected ? 'checked' : ''} onchange="acToggleRow(${i},this.checked)"></td>
      <td style="font-weight:500;font-size:13px">${escHtml(r._fullName)}</td>
      <td style="font-family:var(--font-mono);font-size:11px;color:var(--mu)">${escHtml(r.email || '—')}</td>
      <td style="font-size:12px">${escHtml(r.phone || '—')}</td>
      <td style="font-size:11px;color:var(--mu2)">${(r.tags || []).map(t => `<span class="pill" style="background:var(--bg)">${escHtml(t)}</span>`).join(' ')}</td>
      <td>${statusHtml}</td>
    </tr>`
  }).join('')
}

function acToggleRow(i, checked) {
  _acParsed[i]._selected = checked
  _renderAcReviewTable()
  const allSelected = _acParsed.every(r => r._selected)
  document.getElementById('ac-select-all').checked = allSelected
}
window.acToggleRow = acToggleRow

function acToggleMerge(i, checked) {
  _acParsed[i]._merge = checked
}
window.acToggleMerge = acToggleMerge

function acToggleSelectAll(checked) {
  _acParsed.forEach(r => { r._selected = checked })
  _renderAcReviewTable()
}
window.acToggleSelectAll = acToggleSelectAll

function acBackToStep1() { _showAcStep(1) }
window.acBackToStep1 = acBackToStep1

async function acImportSelected() {
  const toProcess = _acParsed.filter(r => r._selected)
  if (!toProcess.length) { showToast('Select at least one contact', 'warn'); return }

  let imported = 0, merged = 0, skipped = 0, errors = 0

  for (const r of toProcess) {
    try {
      if (r._existing && r._merge) {
        const updates = {}
        const ex = r._existing
        if (!ex.phone && r.phone)      updates.phone      = r.phone
        if (!ex.client_kind)           updates.client_kind = 'private'
        if (!ex.external_id && r.external_id) updates.external_id = r.external_id
        if (Object.keys(updates).length) await updateClient(ex.id, updates)
        merged++
      } else if (!r._existing) {
        const created = await createClient({
          full_name:   r._fullName,
          email:       r.email  || null,
          phone:       r.phone  || null,
          source:      'activecampaign',
          external_id: r.external_id || null,
          active:      true,
        })
        _clients.push(created)
        imported++
      } else {
        skipped++
      }
    } catch (_) {
      errors++
    }
  }

  _clients.sort((a, b) => a.full_name.localeCompare(b.full_name))
  closeAcImportPanel()
  renderClients()

  const parts = []
  if (imported) parts.push(`${imported} imported`)
  if (merged)   parts.push(`${merged} merged`)
  if (skipped)  parts.push(`${skipped} skipped`)
  if (errors)   parts.push(`${errors} errors`)
  showToast(parts.join(', '), errors ? 'warn' : 'success')
}
window.acImportSelected = acImportSelected
