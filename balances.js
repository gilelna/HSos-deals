// balances.js - standalone account balance snapshots.
// Ported from payments.js balances tab: load/render state, transaction net enrichment,
// inline save via upsertAccountBalance(), and delete via deleteAccountBalance().

let _balAccounts = []
let _balCompanies = []
let _balRows = []
let _balMonth = ''
let _balEditMode = false

function _balInjectStyles() {
  if (document.getElementById('bal-inline-style')) return
  const style = document.createElement('style')
  style.id = 'bal-inline-style'
  style.textContent = `
    .bal-input {
      width: 100%;
      font-size: inherit;
      font-family: inherit;
      text-align: right;
      padding: 4px 6px;
      border: 1px solid var(--border, #d0c9be);
      border-radius: 4px;
      background: var(--surface, #fff);
      color: var(--ink, #1A1410);
    }
    .bal-actual { text-align: right; min-width: 130px; }
    .bal-val { display: inline-block; width: 100%; text-align: right; }
  `
  document.head.appendChild(style)
}

function _balCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function _balMonthDate(month) {
  return `${month}-01`
}

function _balYear(month) {
  return String(month || _balCurrentMonth()).slice(0, 4)
}

function _balMoney(value, currency) {
  if (value == null || value === '') return '<span style="color:var(--mu2)">&mdash;</span>'
  const sym = { USD: '$', ILS: '&#8362;', EUR: '&euro;', GBP: '&pound;' }[currency || 'USD'] || ''
  return `<span style="font-family:var(--font-mono)">${sym}${Number(value).toFixed(2)}</span>`
}

function _balSignedMoney(value, currency) {
  if (value == null || value === '') return '<span style="color:var(--mu2)">&mdash;</span>'
  const sym = { USD: '$', ILS: '&#8362;', EUR: '&euro;', GBP: '&pound;' }[currency || 'USD'] || ''
  const n = Number(value)
  const color = n >= 0 ? 'var(--green-text)' : 'var(--red-text)'
  return `<span style="font-family:var(--font-mono);color:${color}">${n >= 0 ? '+' : '&minus;'}${sym}${Math.abs(n).toFixed(2)}</span>`
}

function _balDeltaHtml(delta, closing, currency) {
  if (delta == null) return '<span style="color:var(--mu2)">&mdash;</span>'
  const sym = { USD: '$', ILS: '&#8362;', EUR: '&euro;', GBP: '&pound;' }[currency || 'USD'] || ''
  const abs = Math.abs(Number(delta))
  const pct = closing ? abs / Math.abs(Number(closing)) : 1
  const color = abs <= 0.01 ? 'var(--green-text)' : pct < 0.05 ? 'var(--amber-text)' : 'var(--red-text)'
  return `<span style="font-family:var(--font-mono);color:${color}">${delta >= 0 ? '+' : '&minus;'}${sym}${abs.toFixed(2)}</span>`
}

function _balEsc(value) {
  if (typeof escHtml === 'function') return escHtml(value)
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function _balRowForAccount(account) {
  return _balRows.find(row => row.account_id === account.id && row.month && row.month.slice(0, 7) === _balMonth) || null
}

function _balColor(value) {
  const color = String(value || '')
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  if (/^[a-z]+$/i.test(color)) return color
  return '#8a8a8a'
}

function _balSkeleton() {
  const root = document.getElementById('balances-root')
  if (!root) return
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div>
        <div style="font-family:var(--font-serif);font-size:24px;font-weight:700;margin-bottom:4px">Account Balances</div>
        <div style="font-size:12px;color:var(--mu)">Monthly opening, transaction net, expected closing, and actual closing snapshots.</div>
      </div>
      <div style="height:32px;width:140px;background:var(--bg);border:1px solid var(--border);border-radius:6px"></div>
    </div>
    <div class="block" style="padding:22px;color:var(--mu2);font-size:13px">Loading...</div>`
}

async function loadBalances() {
  const root = document.getElementById('balances-root')
  if (!root) return
  _balMonth = _balMonth || _balCurrentMonth()
  _balSkeleton()

  try {
    const [accounts, companies, rows] = await Promise.all([
      getAccounts(),
      getCompanies(),
      getAccountBalances(undefined, _balYear(_balMonth)),
    ])

    _balAccounts = accounts || []
    _balCompanies = companies || []
    _balRows = (rows || []).filter(row => row.month && row.month.slice(0, 7) === _balMonth)
    await _enrichBalancesWithTxData(_balRows)
    await _balEnsureMissingNets(_balAccounts.filter(account => account.is_active !== false))
    _renderBalances()
  } catch (err) {
    root.innerHTML = `<div class="block" style="padding:20px;color:var(--red-text);font-size:12px">${_balEsc(err.message || err)}</div>`
  }
}
window.loadBalances = loadBalances

async function _enrichBalancesWithTxData(rows) {
  await Promise.all(rows.map(async row => {
    try {
      const result = await getTransactionSumByAccountMonth(row.account_id, row.month)
      row._net = result.net
    } catch {
      row._net = null
    }
  }))
}

async function _balNetForMissingSnapshot(account) {
  try {
    const result = await getTransactionSumByAccountMonth(account.id, _balMonthDate(_balMonth))
    return result.net
  } catch {
    return null
  }
}

async function _balEnsureMissingNets(accounts) {
  await Promise.all(accounts.map(async account => {
    if (_balRowForAccount(account)) return
    account._balNet = await _balNetForMissingSnapshot(account)
  }))
}

function _renderBalances() {
  const root = document.getElementById('balances-root')
  if (!root) return

  const activeAccounts = _balAccounts.filter(account => account.is_active !== false)
  const companies = _balCompanies.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  const companyBlocks = companies.map(company => _renderCompanyBlock(company, activeAccounts.filter(account => account.company_id === company.id))).join('')
  const ungrouped = activeAccounts.filter(account => !account.company_id || !_balCompanies.some(company => company.id === account.company_id))
  const ungroupedBlock = ungrouped.length ? _renderCompanyBlock({ id: '_ungrouped', name: 'Unassigned', color: '#8a8a8a' }, ungrouped) : ''

  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      <div>
        <div style="font-family:var(--font-serif);font-size:24px;font-weight:700;margin-bottom:4px">Account Balances</div>
        <div style="font-size:12px;color:var(--mu)">Monthly account snapshot by company.</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <input class="fi" type="month" id="bal-month" value="${_balEsc(_balMonth)}" onchange="balSetMonth(this.value)" style="height:32px;font-size:12px;width:140px">
        <button class="btn btn-sm ${_balEditMode ? 'btn-primary' : ''}" onclick="balToggleEdit()">${_balEditMode ? 'Done editing' : 'Edit balances'}</button>
      </div>
    </div>

    ${companyBlocks || ungroupedBlock ? companyBlocks + ungroupedBlock : '<div class="block" style="padding:22px;color:var(--mu2);font-size:13px">No accounts found.</div>'}

    <div class="block" style="padding:14px 16px;margin-top:16px">
      <div style="font-size:12px;font-weight:600;margin-bottom:6px">What delta means</div>
      <div style="font-size:12px;color:var(--mu);line-height:1.5">Delta is actual closing minus expected closing. Expected closing equals opening balance plus net transactions for the selected month. Green means reconciled, amber means a small variance, and red means the account needs review.</div>
    </div>`
}

function _renderCompanyBlock(company, accounts) {
  if (!accounts.length) return ''
  const rows = accounts.map(account => _renderAccountRow(account)).join('')
  const totals = accounts.reduce((sum, account) => {
    const row = _balRowForAccount(account)
    const opening = row?.opening_balance != null ? Number(row.opening_balance) : 0
    const net = row?._net != null ? Number(row._net) : Number(account._balNet || 0)
    const expected = row && row.opening_balance != null && row._net != null ? Number(row.opening_balance) + Number(row._net) : null
    const closing = row?.closing_balance != null ? Number(row.closing_balance) : null
    sum.opening += opening
    sum.net += net
    if (expected != null) sum.expected += expected
    if (closing != null) sum.closing += closing
    if (expected != null && closing != null) sum.delta += closing - expected
    return sum
  }, { opening: 0, net: 0, expected: 0, closing: 0, delta: 0 })

  return `
    <div class="block" style="margin-bottom:14px;overflow-x:auto">
      <div class="block-head">
        <div class="block-title" style="display:flex;align-items:center;gap:8px">
          <span style="width:9px;height:9px;border-radius:50%;background:${_balColor(company.color)};display:inline-block"></span>
          ${_balEsc(company.name || 'Company')}
        </div>
      </div>
      <table class="tbl">
        <thead>
          <tr>
            <th>Account</th>
            <th>Opening</th>
            <th>Net Transactions</th>
            <th>Expected Closing</th>
            <th>Actual Closing</th>
            <th>Delta</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td style="font-weight:600">Totals</td>
            <td>${_balMoney(totals.opening, '')}</td>
            <td>${_balSignedMoney(totals.net, '')}</td>
            <td>${_balMoney(totals.expected, '')}</td>
            <td>${_balMoney(totals.closing, '')}</td>
            <td>${_balDeltaHtml(totals.delta, totals.closing, '')}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>`
}

function _renderAccountRow(account) {
  const row = _balRowForAccount(account)
  const currency = row?.currency || account.currency || 'USD'
  const net = row?._net != null ? row._net : account._balNet
  const expected = row && row.opening_balance != null && net != null ? Number(row.opening_balance) + Number(net) : null
  const delta = row && row.closing_balance != null && expected != null ? Number(row.closing_balance) - expected : null
  const month = _balMonth
  const actual = _balEditMode
    ? `<input type="number" class="bal-input" step="0.01" value="${row?.closing_balance ?? ''}" data-account-id="${_balEsc(account.id)}" data-month="${_balEsc(month)}" onchange="saveActualClosing(this)">`
    : `<span class="bal-val">${_balMoney(row?.closing_balance, currency)}</span>`
  const actions = _balEditMode && row
    ? `<button class="btn btn-sm btn-ghost" style="color:var(--red-text)" onclick="deleteBalRow('${row.id}')">Clear</button>`
    : ''

  return `
    <tr>
      <td>
        <div style="font-weight:600">${_balEsc(account.name || 'Account')}</div>
        <div style="font-size:11px;color:var(--mu);margin-top:2px">${_balEsc(account.provider || account.account_type || '')} <span style="font-family:var(--font-mono);border:1px solid var(--border);border-radius:10px;padding:1px 6px;margin-left:4px">${_balEsc(currency)}</span></div>
      </td>
      <td>${_balMoney(row?.opening_balance, currency)}</td>
      <td>${_balSignedMoney(net, currency)}</td>
      <td>${_balMoney(expected, currency)}</td>
      <td class="bal-actual">${actual}</td>
      <td>${_balDeltaHtml(delta, row?.closing_balance, currency)}</td>
      <td>${actions}</td>
    </tr>`
}

async function balSetMonth(month) {
  if (!month) return
  _balMonth = month
  await loadBalances()
}
window.balSetMonth = balSetMonth

async function balToggleEdit() {
  _balEditMode = !_balEditMode
  _renderBalances()
}
window.balToggleEdit = balToggleEdit

async function saveActualClosing(input) {
  const accountId = input?.dataset?.accountId
  const monthRaw = input?.dataset?.month
  if (!accountId || !monthRaw) return
  const row = _balRows.find(item => item.account_id === accountId && item.month && item.month.slice(0, 7) === monthRaw)
  const account = _balAccounts.find(item => item.id === accountId)
  const month = _balMonthDate(monthRaw)
  const value = input.value
  const closing = value === '' ? null : parseFloat(value)
  try {
    const saved = await upsertAccountBalance({
      account_id: accountId,
      month,
      actual_closing: closing,
      opening_balance: row?.opening_balance != null ? Number(row.opening_balance) : 0,
      closing_balance: closing,
      currency: row?.currency || account?.currency || 'USD',
      notes: row?.notes || null,
    })
    const txResult = await getTransactionSumByAccountMonth(accountId, month)
    if (row) {
      row.closing_balance = closing
      row._net = txResult.net
    } else {
      saved._net = txResult.net
      _balRows.push(saved)
    }
    showToast('Saved', 'success')
    _renderBalances()
  } catch (err) {
    showToast('Failed: ' + (err.message || err), 'error')
  }
}
window.saveActualClosing = saveActualClosing

async function balSaveClosing(id, value) {
  const row = _balRows.find(item => item.id === id)
  if (!row) return
  await saveActualClosing({
    value,
    dataset: {
      accountId: row.account_id,
      month: row.month ? row.month.slice(0, 7) : _balMonth,
    },
  })
}
window.balSaveClosing = balSaveClosing

async function deleteBalRow(id) {
  const row = _balRows.find(item => item.id === id)
  const label = row?.month?.slice(0, 7) || id
  showConfirm(`Delete balance snapshot for ${label}? This cannot be undone.`, async () => {
    try {
      await deleteAccountBalance(id)
      _balRows = _balRows.filter(item => item.id !== id)
      showToast('Snapshot deleted')
      _renderBalances()
    } catch (err) {
      showToast('Failed: ' + (err.message || err), 'error')
    }
  })
}
window.deleteBalRow = deleteBalRow

document.addEventListener('DOMContentLoaded', async () => {
  _balInjectStyles()
  await LAYOUT.init('Account Balances', 'payments')
  document.getElementById('nav-balances')?.classList.add('cur')
  await loadBalances()
})
