// deals-modal.js — new deal modal and deal edit

function openEditDeal(id, e) {
  e?.stopPropagation()
  if (window.Router && !_routerDispatching) {
    Router.open({ entity: 'deal', id, view: 'panel', from: _view === 'list' ? 'list' : 'kanban' })
    return
  }
  window.PanelManager?.open('deal', id)
}
window.openEditDeal = openEditDeal

async function _autoCreatePackage(dealId, clientId, vendorId, totalSessions) {
  const total = Number(totalSessions) || 0
  if (total < 1) return
  const { data: existing } = await _sb
    .from('packages').select('id').eq('deal_id', dealId).maybeSingle()
  if (existing) return

  await createPackage({
    deal_id:        dealId,
    client_id:      clientId,
    vendor_id:      vendorId,
    sessions_total: total,
    sessions_used:  0,
    status:         'active',
  })
  showToast(`Package created: ${total} sessions`)
}

async function _autoAssignVendorClient(vendorId, clientId) {
  const { data: existing } = await _sb
    .from('vendor_clients')
    .select('vendor_id')
    .eq('vendor_id', vendorId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (existing) return  // already assigned

  await assignClientToVendor(vendorId, clientId)
  const v = _vendors.find(x => x.id === vendorId)
  const c = _clients.find(x => x.id === clientId)
  if (v && c) {
    if (!v.clients) v.clients = []
    if (!v.clients.find(x => x.id === clientId)) v.clients.push(c)
  }
}

// ─── package row in step 3 (injected at runtime) ──────────────

function _ndEnsurePackageRow() {
  if (document.getElementById('nd-package-row')) return
  const step3 = document.getElementById('nd-step-3')
  if (!step3) return
  const grid = step3.querySelector('div[style*="grid-template-columns:1fr 1fr"]')
  const container = document.createElement('div')
  container.id = 'nd-package-row'
  container.className = 'nd-package-row'
  const cb       = document.createElement('label')
  cb.className   = 'cb-row'
  cb.style.gridColumn = '1/-1'
  const cbInput  = document.createElement('input')
  cbInput.type   = 'checkbox'
  cbInput.id     = 'nd-package-checkbox'
  const cbLabel  = document.createElement('span')
  cbLabel.textContent = 'This deal includes a session package'
  cb.appendChild(cbInput); cb.appendChild(cbLabel)

  const sessionsRow = document.createElement('div')
  sessionsRow.id   = 'nd-package-sessions-row'
  sessionsRow.className = 'fg'
  sessionsRow.style.gridColumn = '1/-1'
  sessionsRow.style.display = 'none'
  const sLabel = document.createElement('label')
  sLabel.className = 'fl'
  sLabel.textContent = 'Sessions total'
  const sInput = document.createElement('input')
  sInput.className = 'fi'
  sInput.type = 'number'
  sInput.id   = 'nd-package-sessions'
  sInput.min  = '1'
  sInput.placeholder = 'e.g. 10'
  sessionsRow.appendChild(sLabel); sessionsRow.appendChild(sInput)

  const sectionTitle = document.createElement('div')
  sectionTitle.className = 'nd-package-title'
  sectionTitle.style.gridColumn = '1/-1'
  sectionTitle.textContent = 'Package (optional)'

  // Insert at end of the existing 1fr-1fr grid so it spans full width.
  grid.appendChild(sectionTitle)
  grid.appendChild(cb)
  grid.appendChild(sessionsRow)

  cbInput.addEventListener('change', () => {
    sessionsRow.style.display = cbInput.checked ? '' : 'none'
    if (cbInput.checked && !sInput.value) sInput.focus()
  })
}

function _ndApplyPackageFromPlan(plan) {
  const cb     = document.getElementById('nd-package-checkbox')
  const sInput = document.getElementById('nd-package-sessions')
  const sRow   = document.getElementById('nd-package-sessions-row')
  if (!cb || !sInput || !sRow) return
  // The plan's product may carry sessions_included as its package size hint.
  // Fall back to plan.sessions_included for forward-compat if a column is added later.
  let auto = Number(plan?.sessions_included) || 0
  if (!auto && plan?.product_id) {
    const prod = (window._products || []).find(p => p.id === plan.product_id)
    auto = Number(prod?.sessions_included) || 0
  }
  if (auto > 0) {
    cb.checked = true
    sInput.value = auto
    sRow.style.display = ''
  } else {
    cb.checked = false
    sInput.value = ''
    sRow.style.display = 'none'
  }
}

// ─── new deal modal state ─────────────────────────────────────

let _ndSelClient     = null
let _ndCsOpen        = false
let _ndCsSearch      = ''
let _ndCsFocused     = -1
let _ndQcOpen        = false
let _ndQcName        = ''
let _ndQcEmail       = ''
let _ndSelectedPlan  = null  // selected product_plan record
let _ndCurrentStep   = 1

function _ndGoToStep(step) {
  _ndCurrentStep = step
  ;[1, 2, 3].forEach(n => {
    const el = document.getElementById(`nd-step-${n}`)
    if (el) el.style.display = n === step ? '' : 'none'
    const tab = document.getElementById(`nd-tab-${n}`)
    if (tab) {
      tab.style.color = n === step ? 'var(--ink)' : 'var(--mu2)'
      tab.style.borderBottom = n === step ? '2px solid var(--ink)' : '2px solid transparent'
    }
  })
}

async function ndStep1Next() {
  const productId = document.getElementById('nd-product').value
  if (!productId) {
    _ndSelectedPlan = null
    _ndGoToStep(3)
    _prefillStep3FromPlan(null)
    return
  }
  const country = document.getElementById('nd-country').value || null
  _ndGoToStep(2)
  await _ndLoadPlans(productId, country)
}
window.ndStep1Next = ndStep1Next

function ndStepBack(toStep) {
  _ndGoToStep(toStep)
}
window.ndStepBack = ndStepBack

async function _ndLoadPlans(productId, country) {
  const loading = document.getElementById('nd-plans-loading')
  const list    = document.getElementById('nd-plans-list')
  const noPlans = document.getElementById('nd-no-plans')
  const nextBtn = document.getElementById('nd-step2-next')

  loading.style.display = 'block'
  list.innerHTML = ''
  noPlans.style.display = 'none'
  nextBtn.disabled = true
  _ndSelectedPlan = null

  try {
    const plans = await getProductPlans(productId, country)
    loading.style.display = 'none'

    if (!plans.length) {
      noPlans.style.display = 'block'
      nextBtn.disabled = false
      return
    }

    list.innerHTML = plans.map((p, i) => {
      const isDefault = p.is_default
      const gatewayColors = {
        green_invoice: 'var(--green)', stripe: 'var(--blue)',
        thrivecart: 'var(--purple)', wise: 'var(--amber)',
      }
      const gColor = gatewayColors[p.payment_rail] || 'var(--mu2)'
      const installLabel = (p.installments_count || 0) > 1
        ? `${p.installments_count} × ${Math.round((p.amount || 0) / p.installments_count)} ${p.currency}`
        : `${p.amount} ${p.currency}`
      const countryLabel = p.target_customer_country ? `🌍 ${p.target_customer_country}` : '🌐 Default'
      return `
        <div class="nd-plan-card" id="nd-plan-${p.id}"
          onclick="ndSelectPlan('${p.id}')"
          style="border:2px solid var(--border);border-radius:var(--r);padding:12px 14px;cursor:pointer;transition:border-color .1s">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:13px;font-weight:600">${p.name}</div>
            <div style="display:flex;align-items:center;gap:6px">
              ${isDefault ? `<span style="font-size:10px;background:var(--gold-bg);color:var(--gold);border:1px solid var(--gold-border);padding:1px 8px;border-radius:10px;font-family:var(--font-mono)">default</span>` : ''}
              <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${gColor}20;color:${gColor};font-family:var(--font-mono);font-weight:500">${p.payment_rail || ''}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;font-size:12px;color:var(--mu)">
            <span>💰 ${installLabel}</span>
            <span>${countryLabel}</span>
            ${p.link_url ? `<span style="color:var(--blue-text)">🔗 Has link</span>` : ''}
            ${p.vendors ? `<span>👤 ${p.vendors.full_name}</span>` : ''}
          </div>
          ${p.external_id ? `<div style="font-size:10px;font-family:var(--font-mono);color:var(--mu2);margin-top:4px">${p.external_id}</div>` : ''}
        </div>
      `
    }).join('')

    if (plans[0]) ndSelectPlan(plans[0].id, plans[0])
  } catch(e) {
    loading.style.display = 'none'
    noPlans.style.display = 'block'
    noPlans.textContent = 'Failed to load plans — you can still create a manual deal.'
    nextBtn.disabled = false
    console.error('[HSos] _ndLoadPlans error:', e)
  }
}

function ndSelectPlan(planId, planObj) {
  document.querySelectorAll('.nd-plan-card').forEach(c => {
    c.style.borderColor = 'var(--border)'
    c.style.background  = ''
  })
  const card = document.getElementById(`nd-plan-${planId}`)
  if (card) { card.style.borderColor = 'var(--ink)'; card.style.background = 'var(--bg)' }
  _ndSelectedPlan = planObj || null
  document.getElementById('nd-step2-next').disabled = false
}
window.ndSelectPlan = ndSelectPlan

function ndStep2Next() {
  _ndGoToStep(3)
  _prefillStep3FromPlan(_ndSelectedPlan)
}
window.ndStep2Next = ndStep2Next

function _prefillStep3FromPlan(plan) {
  const vendorSel = document.getElementById('nd-vendor')
  if (vendorSel) {
    vendorSel.innerHTML = `<option value="">— Vendor —</option>` +
      _vendors.map(v => `<option value="${v.id}"${plan?.vendor_id === v.id ? ' selected' : ''}>${v.full_name}</option>`).join('')
  }
  if (plan) {
    const priceEl = document.getElementById('nd-price')
    const curEl   = document.getElementById('nd-currency')
    if (priceEl) priceEl.value = plan.amount || ''
    if (curEl)   curEl.value   = plan.currency || 'EUR'
  }
  _ndEnsurePackageRow()
  _ndApplyPackageFromPlan(plan)
  calcNdVat()
  requestAnimationFrame(() => _initNdNotesQuill())

  const summary     = document.getElementById('nd-plan-summary')
  const summaryName = document.getElementById('nd-plan-summary-name')
  const summaryDet  = document.getElementById('nd-plan-summary-detail')
  if (plan && summary) {
    summary.style.display = 'block'
    summaryName.textContent = plan.name || ''
    const installLabel = (plan.installments_count || 0) > 1
      ? `${plan.installments_count} installments × ${Math.round((plan.amount || 0) / plan.installments_count)} ${plan.currency}`
      : `${plan.amount} ${plan.currency}`
    summaryDet.textContent = `${plan.payment_rail || ''} · ${installLabel}${plan.external_id ? ' · ' + plan.external_id : ''}`
  } else if (summary) {
    summary.style.display = 'none'
  }

  const linkRow = document.getElementById('nd-payment-link-row')
  const linkEl  = document.getElementById('nd-payment-link')
  if (plan?.link_url && linkRow && linkEl) {
    linkRow.style.display = 'block'
    linkEl.value = plan.link_url
  } else if (linkRow) {
    linkRow.style.display = 'none'
  }
}

function copyNdPaymentLink() {
  const val = document.getElementById('nd-payment-link')?.value
  if (val) { navigator.clipboard.writeText(val); showToast('Link copied') }
}
window.copyNdPaymentLink = copyNdPaymentLink

let _ndEmailTimer = null
async function onNdCustomerEmailInput(val) {
  clearTimeout(_ndEmailTimer)
  const hint = document.getElementById('nd-customer-hint')
  if (!val || !val.includes('@')) { if (hint) hint.textContent = ''; return }
  _ndEmailTimer = setTimeout(async () => {
    try {
      const existing = await getCustomerByEmail(val)
      if (hint) {
        hint.textContent = existing
          ? `✓ Known customer: ${existing.full_name}${existing.country ? ' · ' + existing.country : ''}`
          : '+ Will create new customer record on deal creation'
        hint.style.color = existing ? 'var(--green-text)' : 'var(--mu2)'
        if (existing?.country) {
          const sel = document.getElementById('nd-country')
          if (sel) sel.value = existing.country
        }
      }
    } catch { if (hint) hint.textContent = '' }
  }, 400)
}
window.onNdCustomerEmailInput = onNdCustomerEmailInput

function openNewDeal() {
  _ndSelClient = null; _ndCsOpen = false; _ndCsSearch = ''; _ndCsFocused = -1
  _ndSelectedPlan = null

  _ndGoToStep(1)

  const priceEl   = document.getElementById('nd-price')
  const vatEl     = document.getElementById('nd-vat')
  const vatPrevEl = document.getElementById('nd-vat-preview')
  if (priceEl)   priceEl.value = ''
  if (vatEl)     vatEl.value   = ''
  if (vatPrevEl) vatPrevEl.textContent = ''

  document.getElementById('nd-product').innerHTML = `<option value="">— Product (optional) —</option>` +
    _products.map(p => `<option value="${p.id}">${p.name}</option>`).join('')

  // Reset package row (in case it was left checked from a prior open)
  _ndEnsurePackageRow()
  _ndApplyPackageFromPlan(null)

  const hint = document.getElementById('nd-customer-hint')
  const emailEl = document.getElementById('nd-customer-email')
  if (hint)    hint.textContent = ''
  if (emailEl) emailEl.value   = ''
  const countrySel = document.getElementById('nd-country')
  if (countrySel) countrySel.value = ''

  _renderNdCs()
  document.getElementById('modal-new-deal').classList.add('open')
}
window.openNewDeal = openNewDeal

function closeNewDeal() {
  document.getElementById('modal-new-deal').classList.remove('open')
}
window.closeNewDeal = closeNewDeal

function _ndBuildCsTrigger() {
  if (_ndSelClient) {
    return `
      <div class="cs-trigger" onclick="ndCsToggle()">
        <div class="av" style="background:${avatarBg(_ndSelClient.full_name)};color:${avatarFg(_ndSelClient.full_name)};width:20px;height:20px;font-size:9px;flex-shrink:0">${initials(_ndSelClient.full_name)}</div>
        <span style="flex:1;color:var(--ink)">${_ndSelClient.full_name}</span>
        <span onclick="ndCsClear(event)" style="color:var(--mu2);font-size:14px;line-height:1;cursor:pointer;padding:0 2px">×</span>
      </div>
    `
  }
  return `
    <div class="cs-trigger" onclick="ndCsToggle()">
      <span style="color:var(--mu2);flex:1">Select client…</span>
      <span style="color:var(--mu2);font-size:10px">▾</span>
    </div>
  `
}

function _ndBuildCsDropdown() {
  if (!_ndCsOpen) return ''
  const filtered = _ndCsSearch
    ? _clients.filter(c => c.full_name.toLowerCase().includes(_ndCsSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(_ndCsSearch.toLowerCase()))
    : _clients
  return `
    <div class="cs-dropdown">
      <div style="padding:6px 8px;border-bottom:1px solid var(--border2)">
        <input class="fi" style="height:30px;font-size:12px" placeholder="Search…" id="nd-cs-search"
          oninput="ndCsSearch(this.value)" onkeydown="ndCsKeydown(event)"
          value="${_ndCsSearch}" autocomplete="off">
      </div>
      <div class="cs-list">
        ${filtered.length ? filtered.map((c, i) => `
          <div class="cs-item${_ndSelClient?.id === c.id ? ' cs-sel' : ''}${_ndCsFocused === i ? ' cs-focused' : ''}"
            onclick="ndCsSelect('${c.id}')">
            <div class="av" style="background:${avatarBg(c.full_name)};color:${avatarFg(c.full_name)};width:20px;height:20px;font-size:9px;flex-shrink:0">${initials(c.full_name)}</div>
            <div>
              <div style="font-size:13px;color:var(--ink)">${c.full_name}</div>
              ${c.email ? `<div style="font-size:11px;color:var(--mu2)">${c.email}</div>` : ''}
            </div>
          </div>
        `).join('') : `
          <div style="padding:10px 12px">
            <div style="font-size:12px;color:var(--mu2);margin-bottom:8px">No clients found${_ndCsSearch ? ' for "' + escHtml(_ndCsSearch) + '"' : ''}</div>
            ${_ndQcOpen ? `
              <div style="display:flex;flex-direction:column;gap:6px">
                <input class="fi" id="nd-qc-name" type="text" placeholder="Full name *" style="height:30px;font-size:12px"
                  value="${escHtml(_ndQcName)}" oninput="_ndQcName=this.value">
                <input class="fi" id="nd-qc-email" type="email" placeholder="Email (optional)" style="height:30px;font-size:12px"
                  value="${escHtml(_ndQcEmail)}" oninput="_ndQcEmail=this.value">
                <div style="display:flex;gap:6px">
                  <button class="btn btn-primary btn-sm" onclick="ndQcSubmit(event)" style="flex:1">Create & select</button>
                  <button class="btn btn-sm" onclick="ndQcCancel(event)">Cancel</button>
                </div>
              </div>
            ` : `
              <button class="btn btn-sm" onclick="ndQcOpen(event)" style="width:100%;font-size:12px">+ Create new client</button>
            `}
          </div>
        `}
      </div>
    </div>
  `
}

function _renderNdCs() {
  const wrap = document.getElementById('nd-cs-wrap')
  if (!wrap) return
  wrap.innerHTML = _ndBuildCsTrigger() + _ndBuildCsDropdown()
  if (_ndCsOpen) document.getElementById('nd-cs-search')?.focus()
}

function ndCsToggle() { _ndCsOpen = !_ndCsOpen; _ndCsFocused = -1; _renderNdCs() }
window.ndCsToggle = ndCsToggle

function ndCsClear(e) { e.stopPropagation(); _ndSelClient = null; _ndCsOpen = false; _ndCsSearch = ''; _renderNdCs() }
window.ndCsClear = ndCsClear

function ndCsSearch(v) { _ndCsSearch = v; _ndCsFocused = -1; _ndQcOpen = false; _ndQcName = v; _ndQcEmail = ''; _renderNdCs() }
window.ndCsSearch = ndCsSearch

function ndCsSelect(id) { _ndSelClient = _clients.find(c => c.id === id) || null; _ndCsOpen = false; _ndCsSearch = ''; _renderNdCs() }
window.ndCsSelect = ndCsSelect

function ndCsKeydown(e) {
  const filtered = _ndCsSearch
    ? _clients.filter(c => c.full_name.toLowerCase().includes(_ndCsSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(_ndCsSearch.toLowerCase()))
    : _clients
  if (e.key === 'ArrowDown') { e.preventDefault(); _ndCsFocused = Math.min(_ndCsFocused + 1, filtered.length - 1); _renderNdCs() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _ndCsFocused = Math.max(_ndCsFocused - 1, -1); _renderNdCs() }
  else if (e.key === 'Enter') { e.preventDefault(); if (_ndCsFocused >= 0 && filtered[_ndCsFocused]) ndCsSelect(filtered[_ndCsFocused].id) }
  else if (e.key === 'Escape') { _ndCsOpen = false; _renderNdCs() }
}
window.ndCsKeydown = ndCsKeydown

function ndQcOpen(e) {
  e?.stopPropagation()
  _ndQcOpen = true
  _renderNdCs()
  setTimeout(() => document.getElementById('nd-qc-name')?.focus(), 40)
}
window.ndQcOpen = ndQcOpen

function ndQcCancel(e) {
  e?.stopPropagation()
  _ndQcOpen = false; _ndQcName = ''; _ndQcEmail = ''
  _renderNdCs()
}
window.ndQcCancel = ndQcCancel

async function ndQcSubmit(e) {
  e?.stopPropagation()
  const name  = (document.getElementById('nd-qc-name')?.value  || _ndQcName).trim()
  const email = (document.getElementById('nd-qc-email')?.value || _ndQcEmail).trim()
  if (!name) { showToast('Name is required', 'warn'); return }
  try {
    const newClient = await createClient({ full_name: name, email: email || null, source: 'manual', active: true })
    _clients.push(newClient)
    _clients.sort((a, b) => a.full_name.localeCompare(b.full_name))
    _ndQcOpen = false; _ndQcName = ''; _ndQcEmail = ''
    ndCsSelect(newClient.id)
    showToast(`${newClient.full_name} created`, 'success')
  } catch (err) {
    showToast('Failed to create: ' + err.message, 'warn')
  }
}
window.ndQcSubmit = ndQcSubmit

function onNdProductChange(id) {
  const p = _products.find(x => x.id === id)
  if (p) {
    document.getElementById('nd-price').value = p.base_price || ''
    if (p.currency) document.getElementById('nd-currency').value = p.currency
    calcNdVat()
  }
}
window.onNdProductChange = onNdProductChange

function calcNdVat() {
  const price = parseFloat(document.getElementById('nd-price').value) || 0
  const vat   = parseFloat(document.getElementById('nd-vat').value) || 0
  const cur   = document.getElementById('nd-currency').value
  const final = price * (1 + vat / 100)
  const prev  = document.getElementById('nd-vat-preview')
  if (price > 0) {
    prev.textContent = vat > 0
      ? `Base: ${fmt(price, cur)} + VAT (${vat}%): ${fmt(price * vat / 100, cur)} = Final: ${fmt(final, cur)}`
      : `Final: ${fmt(price, cur)}`
  } else {
    prev.textContent = ''
  }
}
window.calcNdVat = calcNdVat

async function submitNewDeal() {
  const clientId  = _ndSelClient?.id || null
  const vendorId  = document.getElementById('nd-vendor')?.value
  const productId = document.getElementById('nd-product').value
  const price     = parseFloat(document.getElementById('nd-price')?.value) || null
  const currency  = document.getElementById('nd-currency')?.value || 'EUR'
  const vatPct    = parseFloat(document.getElementById('nd-vat')?.value) || 0
  const sales     = document.getElementById('nd-sales')?.value || 'lead'
  const billing   = document.getElementById('nd-billing')?.value || 'pending'
  const notes     = _quillValue(_ndNotesQuill)

  if (!clientId) { showToast('Select a client', 'warn'); return }

  try {
    const fields = {
      client_id:         clientId,
      primary_vendor_id: vendorId || null,
      product_id:        productId || null,
      agreed_price:      price,
      agreed_currency:   currency,
      vat_pct:           vatPct,
      vat_mode:          'excl',
      sales_status:      sales,
      billing_status:    billing,
      notes,
    }
    if (window._plansSchemaReady) {
      fields.plan_id      = _ndSelectedPlan?.id || null
      fields.payment_link = _ndSelectedPlan?.link_url || null
    }
    const newDeal = await createDeal(fields)
    closeNewDeal()
    showToast('Deal created')

    const pkgChecked = document.getElementById('nd-package-checkbox')?.checked
    const pkgSessions = parseInt(document.getElementById('nd-package-sessions')?.value, 10) || 0
    if (pkgChecked && pkgSessions >= 1 && vendorId && clientId) {
      await _autoCreatePackage(newDeal.id, clientId, vendorId, pkgSessions)
    }

    if (vendorId && clientId) {
      await _autoAssignVendorClient(vendorId, clientId)
    }

    await loadData()
  } catch(e) {
    console.error('[HSos] createDeal error:', e)
    showToast('Failed to create deal — check console', 'warn')
  }
}
window.submitNewDeal = submitNewDeal
