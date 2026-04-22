// registry.js — HSos Registry Tab
// Inline-editable sections: Companies, Accounts, Exchange Rates, Opening Balances, Categories, Tags, Settings

;(function () {
'use strict'

// ══════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════

let _companies = []
let _accounts  = []
let _rates     = []
let _balances  = []
let _settings  = []
let _categories = []
let _tags       = []
let _loaded    = false

const REG_TAX_TREATMENTS = [
  'non_deductible', 'mixed_review', 'income',
  'business_payroll_contractors', 'business_professional_services',
  'business_banking_fees', 'business_taxes_government', 'business_insurance',
  'business_software_online', 'business_travel', 'business_equipment',
  'business_marketing', 'business_training',
]


function slugifyId(s) {
  const slug = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^_+|_+$/g, '')
  return slug || 'newitem'
}

function uniqueId(base, existingIds) {
  const set = new Set((existingIds || []).map(String))
  if (!set.has(base)) return base
  let i = 2
  while (set.has(`${base}${i}`)) i++
  return `${base}${i}`
}

// ══════════════════════════════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════════════════════════════

async function load() {
  if (_loaded) { render(); return }
  showLoadingAll()
  try {
    ;[_companies, _accounts, _rates, _balances, _settings, _categories, _tags] = await Promise.all([
      getCompanies(),
      getAccounts(),
      getExchangeRates(),
      getAccountBalances(),
      getSystemSettings(),
      getTransactionCategories(),
      getTransactionTags(),
    ])
    _loaded = true
    hideErrorBanner()
    render()
  } catch (err) {
    showErrorBanner('Failed to load registry data: ' + (err.message || err))
  }
}

function render() {
  renderCompanies()
  renderAccounts()
  renderExchangeRates()
  renderOpeningBalances()
  renderCategories()
  renderTags()
  renderSettings()
}

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════

function showLoadingAll() {
  ;[
    'reg-companies',
    'reg-accounts',
    'reg-exchange-rates',
    'reg-opening-balances',
    'reg-categories',
    'reg-tags',
    'reg-settings',
  ].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = '<div class="reg-loading">Loading…</div>'
  })
}

function showErrorBanner(msg) {
  const el = document.getElementById('reg-error-banner')
  if (!el) return
  el.textContent = msg
  el.classList.remove('hidden')
}

function hideErrorBanner() {
  document.getElementById('reg-error-banner')?.classList.add('hidden')
}

function _notifyClassificationLookupChanged(sectionKey) {
  if (sectionKey !== 'categories' && sectionKey !== 'tags') return
  window.dispatchEvent(new CustomEvent('classification:lookup-changed'))
}

// esc defined globally in app.js

function selectOpts(options, current) {
  return options.map(o =>
    `<option value="${esc(o)}" ${o === current ? 'selected' : ''}>${esc(o)}</option>`
  ).join('')
}

// Cell that becomes a plain text input on click
function cellText(rowId, field, value, placeholder, required) {
  const v = value ?? ''
  const ph = placeholder || ''
  const displayVal = v || `<span style="color:var(--mu2);font-size:11px">${ph}</span>`
  return `
    <div class="reg-cell${v ? '' : ' muted'}" onclick="Registry._startEdit(this)"
         data-row="${esc(rowId)}" data-field="${esc(field)}" data-value="${esc(v)}"
         data-required="${required ? '1' : '0'}">${v ? esc(v) : displayVal}</div>
    <input class="reg-cell-input" type="text" value="${esc(v)}" placeholder="${esc(ph)}"
           onblur="Registry._commitEdit(this)"
           onkeydown="Registry._keyEdit(event, this)" />`
}

// Cell that becomes a <select> on click
function cellSelect(rowId, field, value, options, readOnly) {
  if (readOnly) {
    return `<div class="reg-cell">${esc(value || '—')}</div>`
  }
  const v = value ?? ''
  return `
    <div class="reg-cell${v ? '' : ' muted'}" onclick="Registry._startEdit(this)"
         data-row="${esc(rowId)}" data-field="${esc(field)}" data-value="${esc(v)}">${esc(v || '—')}</div>
    <select class="reg-cell-select"
            onblur="Registry._commitEdit(this)"
            onchange="Registry._commitEdit(this)"
            onkeydown="Registry._keyEdit(event, this)">
      <option value="">—</option>
      ${selectOpts(options, v)}
    </select>`
}

// Pill cell (click toggles through states)
function cellPill(rowId, field, value, states, pillMap) {
  const v = value || states[0]
  return `<div class="reg-cell" style="padding:9px 10px">
    <button class="reg-pill-toggle ${pillMap[v] || v}" data-row="${esc(rowId)}"
            data-field="${esc(field)}" data-value="${esc(v)}" data-states='${JSON.stringify(states)}'
            data-map='${JSON.stringify(pillMap)}'
            onclick="Registry._togglePill(this)">${esc(v)}</button>
  </div>`
}

// Delete cell
function cellDel(sectionKey, rowId) {
  return `<td class="reg-del-cell">
    <button class="reg-del-btn" onclick="Registry._confirmDelete(this,'${esc(sectionKey)}','${esc(rowId)}')" title="Delete row">✕</button>
  </td>`
}

// ══════════════════════════════════════════════════════════════════
// EDIT LOGIC
// ══════════════════════════════════════════════════════════════════

function _startEdit(cellDiv) {
  const td = cellDiv.closest('td')
  if (!td) return
  const input = td.querySelector('.reg-cell-input, .reg-cell-select')
  if (!input) return
  cellDiv.style.display = 'none'
  input.classList.add('active')
  input.focus()
  if (input.tagName === 'INPUT') {
    input.select()
  }
}

async function _commitEdit(input) {
  const td = input.closest('td')
  if (!td) return
  const cellDiv = td.querySelector('.reg-cell')
  if (!cellDiv) return

  const rowId   = cellDiv.dataset.row
  const field   = cellDiv.dataset.field
  const origVal = cellDiv.dataset.value
  const newVal  = input.value.trim()
  const required = cellDiv.dataset.required === '1'

  input.classList.remove('active')
  cellDiv.style.display = ''

  if (newVal === origVal) return
  if (required && !newVal) {
    _setCellError(td, 'This field is required')
    return
  }

  const sectionKey = td.closest('table')?.dataset.section
  await _saveField(sectionKey, rowId, field, newVal, td, cellDiv)
}

function _keyEdit(e, input) {
  if (e.key === 'Enter') {
    e.preventDefault()
    _commitEdit(input)
  } else if (e.key === 'Escape') {
    const td = input.closest('td')
    const cellDiv = td?.querySelector('.reg-cell')
    input.value = cellDiv?.dataset.value || ''
    input.classList.remove('active')
    if (cellDiv) cellDiv.style.display = ''
    _clearCellState(td)
  } else if (e.key === 'Tab') {
    e.preventDefault()
    _commitEdit(input)
    // Focus next cell in row
    const tr = input.closest('tr')
    if (tr) {
      const tds = Array.from(tr.querySelectorAll('td'))
      const idx = tds.indexOf(input.closest('td'))
      for (let i = idx + 1; i < tds.length; i++) {
        const nextCell = tds[i].querySelector('.reg-cell')
        if (nextCell) { nextCell.click(); break }
      }
    }
  }
}

async function _togglePill(btn) {
  const states = JSON.parse(btn.dataset.states || '[]')
  const map    = JSON.parse(btn.dataset.map    || '{}')
  const cur    = btn.dataset.value
  const idx    = states.indexOf(cur)
  const next   = states[(idx + 1) % states.length]

  const td         = btn.closest('td')
  const sectionKey = btn.closest('table')?.dataset.section
  const rowId      = btn.dataset.row
  const field      = btn.dataset.field

  // Optimistic update
  btn.dataset.value = next
  btn.className = `reg-pill-toggle ${map[next] || next}`
  btn.textContent = next

  try {
    await _saveFieldRaw(sectionKey, rowId, field, next)
    _flashSaved(td)
    _syncLocalState(sectionKey, rowId, field, next)
  } catch (err) {
    // Revert
    btn.dataset.value = cur
    btn.className = `reg-pill-toggle ${map[cur] || cur}`
    btn.textContent = cur
    _setCellError(td, err.message)
  }
}

async function _saveField(sectionKey, rowId, field, value, td, cellDiv) {
  _setCellSaving(td)
  try {
    const saved = await _saveFieldRaw(sectionKey, rowId, field, value)
    let displayVal = saved?.[field] ?? value
    // month is a date — keep only YYYY-MM for display
    if (sectionKey === 'exchange-rates' && field === 'month') {
      displayVal = String(displayVal).slice(0, 7)
    }
    if (sectionKey === 'accounts' && field === 'is_active') {
      displayVal = displayVal ? 'active' : 'inactive'
    }
    if (sectionKey === 'categories' && field === 'match_patterns' && Array.isArray(displayVal)) {
      displayVal = displayVal.join(', ')
    }
    cellDiv.dataset.value = displayVal
    cellDiv.innerHTML = esc(displayVal) || `<span style="color:var(--mu2);font-size:11px">—</span>`
    _flashSaved(td)
    _syncLocalState(sectionKey, rowId, field, saved?.[field] ?? value)
  } catch (err) {
    _setCellError(td, err.message)
  }
}

async function _saveFieldRaw(sectionKey, rowId, field, value) {
  let v = value
  // month column is a date type — coerce YYYY-MM → YYYY-MM-01
  if (sectionKey === 'exchange-rates' && field === 'month') {
    v = /^\d{4}-\d{2}$/.test(v) ? v + '-01' : v
  }
  if (sectionKey === 'accounts' && field === 'is_active') {
    v = String(v).toLowerCase() === 'active' || String(v).toLowerCase() === 'true'
  }
  if (sectionKey === 'categories' && field === 'match_patterns') {
    v = String(v || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  switch (sectionKey) {
    case 'companies':     return updateCompanyField(rowId, field, v)
    case 'accounts':      return updateAccountField(rowId, field, v)
    case 'exchange-rates':return updateExchangeRateField(rowId, field, v)
    case 'balances':      return upsertAccountBalance({ ...(_balances.find(b => b.id === rowId) || {}), [field]: v })
    case 'categories':    return updateTransactionCategoryField(rowId, field, v)
    case 'tags':          return updateTransactionTagField(rowId, field, v)
    default: throw new Error('Unknown section: ' + sectionKey)
  }
}

function _syncLocalState(sectionKey, rowId, field, value) {
  const arr = {
    companies: _companies,
    accounts: _accounts,
    'exchange-rates': _rates,
    balances: _balances,
    categories: _categories,
    tags: _tags,
  }[sectionKey]
  if (!arr) return
  const row = arr.find(r => r.id === rowId)
  if (row) row[field] = value
  _notifyClassificationLookupChanged(sectionKey)
}

function _setCellSaving(td) {
  td.classList.remove('reg-error', 'reg-saved')
  td.classList.add('reg-saving')
  td.title = ''
}

function _flashSaved(td) {
  td.classList.remove('reg-saving', 'reg-error')
  td.classList.add('reg-saved')
  setTimeout(() => td.classList.remove('reg-saved'), 1800)
}

function _setCellError(td, msg) {
  td.classList.remove('reg-saving', 'reg-saved')
  td.classList.add('reg-error')
  td.title = msg || 'Save failed'
}

function _clearCellState(td) {
  if (!td) return
  td.classList.remove('reg-saving', 'reg-saved', 'reg-error')
  td.title = ''
}

// ══════════════════════════════════════════════════════════════════
// DELETE LOGIC
// ══════════════════════════════════════════════════════════════════

function _confirmDelete(btn, sectionKey, rowId) {
  const tr = btn.closest('tr')
  if (!tr) return

  // Replace row content with inline confirm
  const cols = tr.querySelectorAll('td')
  const totalCols = cols.length
  tr.innerHTML = `
    <td colspan="${totalCols}" class="reg-del-confirm">
      Delete this row?
      <button class="reg-yes" onclick="Registry._doDelete(this,'${esc(sectionKey)}','${esc(rowId)}')">Yes, delete</button>
      <button class="reg-no"  onclick="Registry._cancelDelete('${esc(sectionKey)}')">No</button>
    </td>`
}

function _cancelDelete(sectionKey) {
  // Re-render the whole section
  _reRenderSection(sectionKey)
}

async function _doDelete(btn, sectionKey, rowId) {
  btn.disabled = true
  btn.textContent = 'Deleting…'
  try {
    switch (sectionKey) {
      case 'companies':      await deleteCompany(rowId);       _companies = _companies.filter(r => r.id !== rowId);      break
      case 'accounts':       await deleteAccount(rowId);       _accounts  = _accounts.filter(r => r.id !== rowId);        break
      case 'exchange-rates': await deleteExchangeRate(rowId);  _rates     = _rates.filter(r => r.id !== rowId);            break
      case 'balances':       await deleteAccountBalance(rowId);_balances  = _balances.filter(r => r.id !== rowId);        break
      case 'categories':     await deleteTransactionCategory(rowId); _categories = _categories.filter(r => r.id !== rowId); break
      case 'tags':           await deleteTransactionTag(rowId); _tags = _tags.filter(r => r.id !== rowId); break
      default: throw new Error('Unknown section')
    }
    _reRenderSection(sectionKey)
    _notifyClassificationLookupChanged(sectionKey)
  } catch (err) {
    btn.closest('td').innerHTML += `<span style="color:var(--red-text);font-size:11px;margin-left:8px">${esc(err.message)}</span>`
    btn.textContent = 'Yes, delete'
    btn.disabled = false
  }
}

function _reRenderSection(sectionKey) {
  switch (sectionKey) {
    case 'companies':      renderCompanies();       break
    case 'accounts':       renderAccounts();        break
    case 'exchange-rates': renderExchangeRates();   break
    case 'balances':       renderOpeningBalances(); break
    case 'categories':     renderCategories();      break
    case 'tags':           renderTags();            break
  }
}

// ══════════════════════════════════════════════════════════════════
// ADD ROW LOGIC
// ══════════════════════════════════════════════════════════════════

async function _addCompanyRow() {
  const idBase = uniqueId('com_' + slugifyId('new company'), _companies.map(c => c.id))
  try {
    const row = await createCompany({
      id: idBase,
      name: 'New Company',
      currency: 'USD',
      entity_type: 'llc',
      status: 'active',
    })
    _companies.push(row)
    renderCompanies()
    // Focus name cell of new row
    _focusNewRow('reg-companies', row.id)
  } catch (err) {
    showErrorBanner('Failed to add company: ' + err.message)
  }
}

async function _addAccountRow() {
  const defaultCompany = _companies[0]?.id || null
  if (!defaultCompany) {
    showErrorBanner('Add a company first, then create accounts')
    return
  }
  const accountId = uniqueId('acc_' + slugifyId('new account'), _accounts.map(a => a.id))
  try {
    const row = await createAccount({
      id: accountId,
      company_id: defaultCompany,
      name: 'New Account',
      provider: 'bank',
      currency: 'USD',
      account_type: 'bank',
      is_active: true,
    })
    _accounts.push(row)
    await _refreshAccountsLocal()
    renderAccounts()
    _focusNewRow('reg-accounts', row.id)
  } catch (err) {
    showErrorBanner('Failed to add account: ' + err.message)
  }
}

async function _refreshAccountsLocal() {
  _accounts = await getAccounts()
}

async function _addExchangeRateRow() {
  const now = new Date()
  const month = now.toISOString().slice(0, 7) + '-01'  // date type requires full date
  try {
    const row = await createExchangeRate({ month, from_currency: 'ILS', to_currency: 'USD', rate: 0, source: 'manual' })
    _rates.unshift(row)
    renderExchangeRates()
    _focusNewRow('reg-exchange-rates', row.id)
  } catch (err) {
    showErrorBanner('Failed to add exchange rate: ' + err.message)
  }
}

async function _addBalanceRow() {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const firstAccount = _accounts[0]?.id || null
  if (!firstAccount) { showErrorBanner('Add an account first'); return }
  try {
    const row = await upsertAccountBalance({ account_id: firstAccount, month, opening_balance: 0, closing_balance: null, currency: _accounts[0]?.currency || 'USD', notes: null })
    const existing = _balances.findIndex(b => b.id === row.id)
    if (existing >= 0) _balances[existing] = row
    else _balances.unshift(row)
    renderOpeningBalances()
    _focusNewRow('reg-opening-balances', row.id)
  } catch (err) {
    showErrorBanner('Failed to add balance: ' + err.message)
  }
}

async function _addCategoryRow() {
  const name = 'New Category'
  const id = uniqueId('ca_' + slugifyId(name), _categories.map(c => c.id))
  try {
    const row = await createTransactionCategory({
      id,
      name,
      tax_category: null,
      status: 'active',
      match_patterns: [],
      notes: null,
    })
    _categories.push(row)
    renderCategories()
    _focusNewRow('reg-categories', row.id)
    _notifyClassificationLookupChanged('categories')
  } catch (err) {
    showErrorBanner('Failed to add category: ' + err.message)
  }
}

async function _addTagRow() {
  const name = 'new-tag'
  const id = uniqueId('tag_' + slugifyId(name), _tags.map(t => t.id))
  try {
    const row = await createTransactionTag({
      id,
      name,
      status: 'active',
      notes: null,
    })
    _tags.push(row)
    renderTags()
    _focusNewRow('reg-tags', row.id)
    _notifyClassificationLookupChanged('tags')
  } catch (err) {
    showErrorBanner('Failed to add tag: ' + err.message)
  }
}

function _focusNewRow(containerId, rowId) {
  setTimeout(() => {
    const container = document.getElementById(containerId)
    const tr = container?.querySelector(`tr[data-row-id="${CSS.escape(rowId)}"]`)
    const firstCell = tr?.querySelector('.reg-cell')
    firstCell?.click()
  }, 60)
}

// ══════════════════════════════════════════════════════════════════
// SECTION 1 — COMPANIES
// ══════════════════════════════════════════════════════════════════

function renderCompanies() {
  const el = document.getElementById('reg-companies')
  if (!el) return

  const rows = _companies.map(c => `
    <tr data-row-id="${esc(c.id)}">
      <td>${cellText(c.id, 'name',             c.name,             'Company name', true)}</td>
      <td><div class="reg-cell" style="font-family:var(--font-mono);color:var(--mu2)">${esc(c.id)}</div></td>
      <td>${cellSelect(c.id,'currency',        c.currency,         ['USD','ILS','EUR','GBP'])}</td>
      <td>${cellSelect(c.id,'entity_type',     c.entity_type,      ['llc','ltd','autonomo','other'])}</td>
      <td>${cellPill(c.id, 'status', c.status, ['active','inactive'], { active:'active', inactive:'inactive' })}</td>
      <td>${cellText(c.id, 'notes',            c.notes,            'Notes')}</td>
      ${cellDel('companies', c.id)}
    </tr>`).join('')

  el.innerHTML = sectionHtml(
    'Companies', _companies.length,
    `<button class="btn btn-sm" onclick="Registry._addCompanyRow()">+ Add row</button>`,
    `<table class="reg-tbl" data-section="companies">
      <thead><tr>
        <th>Name</th><th>ID</th><th>Currency</th>
        <th>Entity</th><th>Status</th><th>Notes</th><th></th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--mu2);font-size:12px">No companies yet</td></tr>'}</tbody>
    </table>`
  )
}

// ══════════════════════════════════════════════════════════════════
// SECTION 2 — ACCOUNTS (grouped by company)
// ══════════════════════════════════════════════════════════════════

function renderAccounts() {
  const el = document.getElementById('reg-accounts')
  if (!el) return

  const companyIds = [...new Set(_accounts.map(a => a.company_id).filter(Boolean))]
  const ungrouped  = _accounts.filter(a => !a.company_id)

  let bodyHtml = ''

  companyIds.forEach(cid => {
    const company = _companies.find(c => c.id === cid)
    const label   = company?.name || cid
    const accs    = _accounts.filter(a => a.company_id === cid)

    bodyHtml += `<tr class="reg-group-row"><td colspan="7">${esc(label)}</td></tr>`
    bodyHtml += accs.map(a => accountRow(a)).join('')
  })

  if (ungrouped.length) {
    bodyHtml += `<tr class="reg-group-row"><td colspan="7">Unassigned</td></tr>`
    bodyHtml += ungrouped.map(a => accountRow(a)).join('')
  }

  el.innerHTML = sectionHtml(
    'Accounts', _accounts.length,
    `<button class="btn btn-sm" onclick="Registry._addAccountRow()">+ Add row</button>`,
    `<table class="reg-tbl" data-section="accounts">
      <thead><tr>
        <th>Name</th><th>Company</th><th>Provider</th>
        <th>Type</th><th>Currency</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>${bodyHtml || '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--mu2);font-size:12px">No accounts yet</td></tr>'}</tbody>
    </table>`
  )
}

function accountRow(a) {
  // company_id → display name for cell, but save by id
  const companyName = _companies.find(c => c.id === a.company_id)?.name || a.company_id || '—'
  const companyDisplayCell = `
    <div class="reg-cell${a.company_id ? '' : ' muted'}" onclick="Registry._startEdit(this)"
         data-row="${esc(a.id)}" data-field="company_id" data-value="${esc(a.company_id || '')}">${esc(companyName)}</div>
    <select class="reg-cell-select"
            onblur="Registry._commitEdit(this)"
            onchange="Registry._commitEdit(this)"
            onkeydown="Registry._keyEdit(event, this)">
      <option value="">—</option>
      ${_companies.map(c => `<option value="${esc(c.id)}" ${c.id === a.company_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>`

  return `<tr data-row-id="${esc(a.id)}">
    <td>${cellText(a.id, 'name',     a.name,     'Account name', true)}</td>
    <td>${companyDisplayCell}</td>
    <td>${cellText(a.id, 'provider', a.provider, 'bank/wise/stripe')}</td>
    <td>${cellSelect(a.id,'account_type', a.account_type, ['bank','card','processor','wallet','other'])}</td>
    <td>${cellSelect(a.id,'currency', a.currency, ['USD','ILS','EUR','GBP'])}</td>
    <td>${cellSelect(a.id,'is_active', a.is_active ? 'active' : 'inactive', ['active','inactive'])}</td>
    ${cellDel('accounts', a.id)}
  </tr>`
}

// ══════════════════════════════════════════════════════════════════
// SECTION 3 — EXCHANGE RATES
// ══════════════════════════════════════════════════════════════════

function renderExchangeRates() {
  const el = document.getElementById('reg-exchange-rates')
  if (!el) return

  const rows = _rates.map(r => {
    // month stored as date YYYY-MM-DD, display as YYYY-MM
    const monthDisplay = r.month ? String(r.month).slice(0, 7) : ''
    return `
    <tr data-row-id="${esc(r.id)}">
      <td>${cellText(r.id, 'month',         monthDisplay,    'YYYY-MM', true)}</td>
      <td>${cellSelect(r.id,'from_currency',r.from_currency, ['ILS','EUR','GBP','USD'])}</td>
      <td><div class="reg-cell" style="color:var(--mu2)">USD</div></td>
      <td>${cellText(r.id, 'rate',          r.rate,          '0.000000', true)}</td>
      <td>${cellPill(r.id, 'source', r.source, ['manual','wise'], { manual:'manual', wise:'wise' })}</td>
      <td>${cellText(r.id, 'notes',         r.notes,         'Notes')}</td>
      ${cellDel('exchange-rates', r.id)}
    </tr>`
  }).join('')

  el.innerHTML = sectionHtml(
    'Exchange Rates', _rates.length,
    `<button class="btn btn-sm" onclick="Registry._addExchangeRateRow()">+ Add row</button>`,
    `<table class="reg-tbl" data-section="exchange-rates">
      <thead><tr>
        <th>Month</th><th>From</th><th>To</th>
        <th>Rate</th><th>Source</th><th>Notes</th><th></th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--mu2);font-size:12px">No rates yet</td></tr>'}</tbody>
    </table>`
  )
}

// ══════════════════════════════════════════════════════════════════
// SECTION 4 — OPENING BALANCES
// ══════════════════════════════════════════════════════════════════

function renderOpeningBalances() {
  const el = document.getElementById('reg-opening-balances')
  if (!el) return

  const rows = _balances.map(b => {
    const acc = _accounts.find(a => a.id === b.account_id)
    const currency = b.currency || acc?.currency || 'USD'
    const sym = { USD: '$', ILS: '₪', EUR: '€', MULTI: '' }[currency] || ''
    const monthLabel = b.month ? b.month.slice(0, 7) : '—'

    return `<tr data-row-id="${esc(b.id)}">
      <td style="font-size:12px">${esc(acc?.name || b.account_id || '—')}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${esc(monthLabel)}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${sym}${b.opening_balance != null ? Number(b.opening_balance).toFixed(2) : '—'}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${b.closing_balance != null ? sym + Number(b.closing_balance).toFixed(2) : '—'}</td>
      <td style="font-size:11px;color:var(--mu)">${esc(currency)}</td>
      <td style="font-size:11px;color:var(--mu)">${esc(b.notes || '')}</td>
      ${cellDel('balances', b.id)}
    </tr>`
  }).join('')

  el.innerHTML = sectionHtml(
    'Account Balances', _balances.length,
    `<span style="font-size:11px;color:var(--mu)">Managed via Payments → Balances tab</span>`,
    `<table class="reg-tbl" data-section="balances">
      <thead><tr>
        <th>Account</th><th>Month</th><th>Opening</th><th>Closing</th>
        <th>Currency</th><th>Notes</th><th></th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--mu2);font-size:12px">No balance snapshots yet — add from Payments → Balances</td></tr>'}</tbody>
    </table>`
  )
}

// ══════════════════════════════════════════════════════════════════
// SECTION 5 — TRANSACTION CATEGORIES
// ══════════════════════════════════════════════════════════════════

function renderCategories() {
  const el = document.getElementById('reg-categories')
  if (!el) return

  const rows = _categories.map(c => {
    const patterns = Array.isArray(c.match_patterns) ? c.match_patterns.join(', ') : ''
    return `<tr data-row-id="${esc(c.id)}">
      <td>${cellText(c.id, 'name', c.name, 'Category name', true)}</td>
      <td><div class="reg-cell" style="font-family:var(--font-mono);color:var(--mu2)">${esc(c.id)}</div></td>
      <td>${cellSelect(c.id, 'tax_category', c.tax_category || '', REG_TAX_TREATMENTS)}</td>
      <td>${cellPill(c.id, 'status', c.status || 'active', ['active','inactive'], { active:'active', inactive:'inactive' })}</td>
      <td>${cellText(c.id, 'match_patterns', patterns, 'comma, separated')}</td>
      <td>${cellText(c.id, 'notes', c.notes, 'Notes')}</td>
      ${cellDel('categories', c.id)}
    </tr>`
  }).join('')

  el.innerHTML = sectionHtml(
    'Categories', _categories.length,
    `<button class="btn btn-sm" onclick="Registry._addCategoryRow()">+ Add row</button>`,
    `<table class="reg-tbl" data-section="categories">
      <thead><tr>
        <th>Name</th><th>ID</th><th>Tax</th><th>Status</th><th>Match Patterns</th><th>Notes</th><th></th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--mu2);font-size:12px">No categories yet</td></tr>'}</tbody>
    </table>`
  )
}

// ══════════════════════════════════════════════════════════════════
// SECTION 6 — TRANSACTION TAGS
// ══════════════════════════════════════════════════════════════════

function renderTags() {
  const el = document.getElementById('reg-tags')
  if (!el) return

  const rows = _tags.map(t => `<tr data-row-id="${esc(t.id)}">
    <td>${cellText(t.id, 'name', t.name, 'Tag name', true)}</td>
    <td><div class="reg-cell" style="font-family:var(--font-mono);color:var(--mu2)">${esc(t.id)}</div></td>
    <td>${cellPill(t.id, 'status', t.status || 'active', ['active','inactive'], { active:'active', inactive:'inactive' })}</td>
    <td>${cellText(t.id, 'notes', t.notes, 'Notes')}</td>
    ${cellDel('tags', t.id)}
  </tr>`).join('')

  el.innerHTML = sectionHtml(
    'Tags', _tags.length,
    `<button class="btn btn-sm" onclick="Registry._addTagRow()">+ Add row</button>`,
    `<table class="reg-tbl" data-section="tags">
      <thead><tr>
        <th>Name</th><th>ID</th><th>Status</th><th>Notes</th><th></th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--mu2);font-size:12px">No tags yet</td></tr>'}</tbody>
    </table>`
  )
}

// ══════════════════════════════════════════════════════════════════
// SECTION 7 — GENERAL SETTINGS
// ══════════════════════════════════════════════════════════════════

function renderSettings() {
  const el = document.getElementById('reg-settings')
  if (!el) return

  const settingInput = (s) => {
    const v = s.value ?? ''
    if (s.key === 'default_currency') {
      return `
        <div class="reg-cell${v ? '' : ' muted'}" onclick="Registry._startEdit(this)"
             data-row="${esc(s.key)}" data-field="value" data-value="${esc(v)}">${esc(v || '—')}</div>
        <select class="reg-cell-select"
                onblur="Registry._commitSettingEdit(this,'${esc(s.key)}')"
                onchange="Registry._commitSettingEdit(this,'${esc(s.key)}')"
                onkeydown="Registry._keyEdit(event, this)">
          ${selectOpts(['USD','ILS','EUR','GBP'], v)}
        </select>`
    }
    if (s.key === 'default_company_id') {
      return `
        <div class="reg-cell${v ? '' : ' muted'}" onclick="Registry._startEdit(this)"
             data-row="${esc(s.key)}" data-field="value" data-value="${esc(v)}">${esc(_companies.find(c => c.id === v)?.name || v || '—')}</div>
        <select class="reg-cell-select"
                onblur="Registry._commitSettingEdit(this,'${esc(s.key)}')"
                onchange="Registry._commitSettingEdit(this,'${esc(s.key)}')"
                onkeydown="Registry._keyEdit(event, this)">
          <option value="">—</option>
          ${_companies.map(c => `<option value="${esc(c.id)}" ${c.id === v ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>`
    }
    // Generic text
    return `
      <div class="reg-cell${v ? '' : ' muted'}" onclick="Registry._startEdit(this)"
           data-row="${esc(s.key)}" data-field="value" data-value="${esc(v)}">${esc(v || '—')}</div>
      <input class="reg-cell-input" type="text" value="${esc(v)}"
             onblur="Registry._commitSettingEdit(this,'${esc(s.key)}')"
             onkeydown="Registry._keySettingEdit(event, this, '${esc(s.key)}')" />`
  }

  const rows = _settings.map(s => `
    <tr>
      <td style="padding:9px 14px;font-weight:500;white-space:nowrap;width:220px">${esc(s.label || s.key)}</td>
      <td style="font-size:11px;color:var(--mu);padding:9px 14px;max-width:260px">${esc(s.description || '')}</td>
      <td data-setting-key="${esc(s.key)}">${settingInput(s)}</td>
    </tr>`).join('')

  el.innerHTML = sectionHtml(
    'General Settings', null, '',
    `<table class="reg-tbl" data-section="settings">
      <thead><tr>
        <th>Setting</th><th>Description</th><th>Value</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--mu2);font-size:12px">No settings</td></tr>'}</tbody>
    </table>`
  )
}

async function _commitSettingEdit(input, key) {
  const td = input.closest('td')
  if (!td) return
  const cellDiv = td.querySelector('.reg-cell')
  if (!cellDiv) return

  const origVal = cellDiv.dataset.value
  const newVal  = input.value.trim()

  input.classList.remove('active')
  cellDiv.style.display = ''

  if (newVal === origVal) return

  _setCellSaving(td)
  try {
    await updateSystemSetting(key, newVal)
    cellDiv.dataset.value = newVal

    // Display label for company dropdown
    if (key === 'default_company_id') {
      const c = _companies.find(c => c.id === newVal)
      cellDiv.textContent = c?.name || newVal || '—'
    } else {
      cellDiv.textContent = newVal || '—'
    }

    const s = _settings.find(s => s.key === key)
    if (s) s.value = newVal

    _flashSaved(td)
  } catch (err) {
    _setCellError(td, err.message)
  }
}

function _keySettingEdit(e, input, key) {
  if (e.key === 'Enter') { e.preventDefault(); _commitSettingEdit(input, key) }
  else if (e.key === 'Escape') {
    const td = input.closest('td')
    const cellDiv = td?.querySelector('.reg-cell')
    input.value = cellDiv?.dataset.value || ''
    input.classList.remove('active')
    if (cellDiv) cellDiv.style.display = ''
    _clearCellState(td)
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTION WRAPPER
// ══════════════════════════════════════════════════════════════════

function sectionHtml(title, count, actionHtml, bodyHtml) {
  const countBadge = count != null
    ? `<span class="reg-section-count">${count}</span>` : ''
  return `
    <div class="reg-section">
      <div class="reg-section-head">
        <div style="display:flex;align-items:center">
          <span class="reg-section-title">${esc(title)}</span>${countBadge}
        </div>
        <div>${actionHtml}</div>
      </div>
      ${bodyHtml}
    </div>`
}

// ══════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════

window.Registry = {
  load,
  _startEdit,
  _commitEdit,
  _keyEdit,
  _togglePill,
  _confirmDelete,
  _cancelDelete,
  _doDelete,
  _addCompanyRow,
  _addAccountRow,
  _addExchangeRateRow,
  _addBalanceRow,
  _addCategoryRow,
  _addTagRow,
  _commitSettingEdit,
  _keySettingEdit,
}

})()
