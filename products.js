// products.js — Products page (rebuilt 2026-04-26)
// Expandable product cards + plan grid + right-side panel for editing.

const PRODUCTS = (() => {
  const PLAN_TYPE_OPTS = [
    { db: 'one_time',     label: 'one-time' },
    { db: 'installment',  label: 'installments' },
    { db: 'subscription', label: 'subscription' },
    { db: 'package',      label: 'package' },
  ]
  const PLAN_TYPE_DB_TO_LABEL = Object.fromEntries(PLAN_TYPE_OPTS.map(o => [o.db, o.label]))
  const PAYMENT_TYPE_OPTS = PLAN_TYPE_OPTS.filter(o => o.db !== 'package')

  const PRODUCT_TYPE_OPTS = [
    { value: '',         label: '— select —' },
    { value: 'session',  label: 'session' },
    { value: 'package',  label: 'package' },
    { value: 'workshop', label: 'workshop' },
    { value: 'custom',   label: 'custom' },
  ]
  const CATEGORY_OPTS = [
    { value: '',                  label: '— select —' },
    { value: 'Coaching program',  label: 'Coaching program' },
    { value: 'Online course',     label: 'Online course' },
    { value: 'Group coaching',    label: 'Group coaching' },
    { value: 'Workshop',          label: 'Workshop' },
    { value: 'Custom',            label: 'Custom' },
  ]
  const CURRENCIES = ['USD', 'ILS', 'EUR']
  const PAYMENT_RAILS = [
    { value: '',              label: '— none —' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'thrivecart',    label: 'ThriveCart' },
    { value: 'green_invoice', label: 'Green Invoice' },
    { value: 'stripe',        label: 'Stripe' },
    { value: 'wise',          label: 'Wise' },
  ]
  const STATUS_OPTS = [
    { value: 'active',   label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ]
  const CATEGORY_ICON = {
    'Coaching program': '🎯',
    'Online course':    '🎓',
    'Group coaching':   '👥',
    'Workshop':         '🛠️',
    'Custom':           '✨',
  }
  const PRODUCT_TYPE_FALLBACK_ICON = {
    session:  '🗓️',
    package:  '📦',
    workshop: '🛠️',
    custom:   '✨',
  }

  let _products = []
  let _expanded = new Set()
  let _activeTab = 'details'
  let _panel = { mode: null, productId: null, planId: null }

  async function init() {
    try { await reload() }
    catch (e) {
      console.error('[products] init', e)
      document.getElementById('products-list').innerHTML =
        '<div class="products-error">Failed to load products: ' + esc(e.message) + '</div>'
    }
  }

  async function reload() {
    _products = await getAllProductsWithPlans()
    render()
  }

  function render() {
    const root = document.getElementById('products-list')
    if (!_products.length) {
      root.innerHTML = '<div class="products-empty">No products yet. Click <strong>+ New product</strong> to add one.</div>'
      return
    }
    root.innerHTML = _products.map(renderProductCard).join('')
  }

  function renderProductCard(p) {
    const isOpen = _expanded.has(p.id)
    const status = p.status || 'active'
    const statusLabel = status === 'archived' ? 'Archived' : status === 'draft' ? 'Draft' : 'Active'
    const icon = CATEGORY_ICON[p.category] || PRODUCT_TYPE_FALLBACK_ICON[p.type] || '📦'
    const subParts = [p.category, p.type].filter(Boolean)
    const sub = subParts.length ? subParts.join(' · ') : 'Uncategorised'
    return `
<div class="products-card ${isOpen ? 'is-open' : ''} ${status === 'archived' ? 'is-archived' : ''}" id="prd-card-${esc(p.id)}" data-product-id="${esc(p.id)}">
  <div class="products-card-head" onclick="PRODUCTS.toggleProduct('${esc(p.id)}', event)">
    <div class="products-card-icon">${icon}</div>
    <div class="products-card-titles">
      <div class="products-card-name">${esc(p.name || '(untitled)')}</div>
      <div class="products-card-sub">${esc(sub)}</div>
    </div>
    <span class="products-status-badge ${status}">${statusLabel}</span>
    <button class="products-card-edit" onclick="event.stopPropagation();PRODUCTS.openEditProduct('${esc(p.id)}')">Edit</button>
    <span class="products-card-chevron">▶</span>
  </div>
  <div class="products-card-body">
    <div class="products-plans-head">
      <div class="products-plans-label">Plans</div>
      <button class="products-add-plan-btn" onclick="event.stopPropagation();PRODUCTS.openNewPlan('${esc(p.id)}')">+ Add plan</button>
    </div>
    ${renderPlansGrid(p)}
  </div>
</div>`
  }

  function renderPlansGrid(product) {
    const plans = product.plans || []
    if (!plans.length) {
      return '<div class="products-plans-empty">No plans yet — click <strong>+ Add plan</strong> above.</div>'
    }
    return '<div class="plans-row">' + plans.map(pl => renderPlanCard(pl, product)).join('') + '</div>'
  }

  function renderPlanCard(plan, product) {
    const dbType = plan.plan_type || 'one_time'
    const isPackage = dbType === 'package'
    const typeLabel = PLAN_TYPE_DB_TO_LABEL[dbType] || dbType
    const status = plan.status || 'active'
    const amount = plan.amount != null ? Number(plan.amount).toLocaleString() : '—'
    const currency = plan.currency || ''
    const rail = formatRail(plan.payment_rail)
    const sessions = product.sessions_included
    return `
<div class="plan-card-float type-${esc(dbType)} ${status === 'archived' ? 'is-archived' : status === 'draft' ? 'is-draft' : ''}"
     id="plan-card-${esc(plan.id)}"
     onclick="PRODUCTS.openEditPlan('${esc(product.id)}','${esc(plan.id)}')">
  <div class="plan-card-name">${esc(plan.name || typeLabel)}</div>
  <div class="plan-card-amount-row">
    <span class="plan-card-amount">${amount}</span>
    <span class="plan-card-currency">${esc(currency)}</span>
  </div>
  <div class="plan-card-meta">
    ${isPackage
      ? (sessions ? `<span class="plan-package-badge">📦 ${sessions} session${sessions === 1 ? '' : 's'}</span>` : `<span class="plan-package-badge">📦 package</span>`)
      : `<span class="plan-type-badge ${esc(dbType)}">${esc(typeLabel)}</span>`}
  </div>
  ${rail ? `<div class="plan-card-rail">${esc(rail)}</div>` : ''}
</div>`
  }

  function formatRail(value) {
    if (!value) return ''
    const found = PAYMENT_RAILS.find(r => r.value === value)
    return found ? found.label : value
  }

  function toggleProduct(id, ev) {
    if (ev && (ev.target.closest('.products-card-edit') || ev.target.closest('.products-add-plan-btn'))) return
    if (_expanded.has(id)) _expanded.delete(id); else _expanded.add(id)
    const card = document.getElementById('prd-card-' + id)
    if (card) card.classList.toggle('is-open')
  }

  function openPanel() {
    document.getElementById('products-panel-overlay').classList.add('is-open')
    document.getElementById('products-panel').classList.add('is-open')
    document.getElementById('products-panel').setAttribute('aria-hidden', 'false')
  }
  function closePanel() {
    document.getElementById('products-panel-overlay').classList.remove('is-open')
    document.getElementById('products-panel').classList.remove('is-open')
    document.getElementById('products-panel').setAttribute('aria-hidden', 'true')
    _panel = { mode: null, productId: null, planId: null }
  }
  function switchTab(tab) {
    _activeTab = tab
    document.querySelectorAll('#pp-tabs .products-panel-tab').forEach(b => {
      b.classList.toggle('is-active', b.dataset.tab === tab)
    })
    renderPanelBody()
  }
  function setTabsVisible(visible) {
    document.getElementById('pp-tabs').style.display = visible ? '' : 'none'
  }
  function setDeleteVisible(visible) {
    document.getElementById('pp-delete').style.display = visible ? '' : 'none'
  }

  function openNewProduct() {
    _panel = { mode: 'product-new', productId: null, planId: null }
    document.getElementById('pp-title').textContent = 'New product'
    document.getElementById('pp-sub').textContent  = '(auto-assigned on save)'
    setTabsVisible(false); setDeleteVisible(false)
    _activeTab = 'details'
    renderPanelBody(); openPanel()
  }
  function openEditProduct(productId) {
    const p = _products.find(x => x.id === productId)
    if (!p) return
    _panel = { mode: 'product-edit', productId, planId: null }
    document.getElementById('pp-title').textContent = 'Edit · ' + (p.name || '')
    document.getElementById('pp-sub').textContent  = p.prd_uid || p.id
    setTabsVisible(false); setDeleteVisible(true)
    _activeTab = 'details'
    renderPanelBody(); openPanel()
  }
  function openNewPlan(productId) {
    const p = _products.find(x => x.id === productId)
    if (!p) return
    _panel = { mode: 'plan-new', productId, planId: null }
    document.getElementById('pp-title').textContent = 'New plan'
    document.getElementById('pp-sub').textContent  = p.name
    setTabsVisible(false); setDeleteVisible(false)
    _activeTab = 'details'
    renderPanelBody(); openPanel()
  }
  function openEditPlan(productId, planId) {
    const p = _products.find(x => x.id === productId)
    const plan = (p?.plans || []).find(x => x.id === planId)
    if (!p || !plan) return
    _panel = { mode: 'plan-edit', productId, planId }
    document.getElementById('pp-title').textContent = 'Edit plan · ' + (PLAN_TYPE_DB_TO_LABEL[plan.plan_type] || '')
    document.getElementById('pp-sub').textContent  = p.name + ' · ' + (plan.plan_uid || plan.id)
    setTabsVisible(true); setDeleteVisible(true)
    _activeTab = 'details'
    document.querySelectorAll('#pp-tabs .products-panel-tab').forEach(b => {
      b.classList.toggle('is-active', b.dataset.tab === 'details')
    })
    renderPanelBody(); openPanel()
  }

  function renderPanelBody() {
    const body = document.getElementById('pp-body')
    if (!_panel.mode) { body.innerHTML = ''; return }
    if (_activeTab === 'deals' && _panel.mode === 'plan-edit') { renderDealsTab(body); return }
    if (_panel.mode === 'product-new' || _panel.mode === 'product-edit') {
      body.innerHTML = renderProductForm()
      hookProductForm()
    } else {
      body.innerHTML = renderPlanForm()
      hookPlanForm()
    }
  }

  function renderProductForm() {
    const p = _panel.mode === 'product-edit'
      ? (_products.find(x => x.id === _panel.productId) || {})
      : {}
    return `
<div class="products-panel-section">
  <div class="fg">
    <label class="fl">Name</label>
    <input type="text" id="pf-name" class="fi" value="${esc(p.name || '')}" placeholder="e.g. English Accent Mastery">
  </div>
  <div class="form-row">
    <div class="fg" style="flex:1">
      <label class="fl">Category</label>
      <select id="pf-category" class="fi fsel">
        ${CATEGORY_OPTS.map(o => `<option value="${esc(o.value)}" ${p.category === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
      </select>
    </div>
    <div class="fg" style="flex:1">
      <label class="fl">Type</label>
      <select id="pf-type" class="fi fsel">
        ${PRODUCT_TYPE_OPTS.map(o => `<option value="${esc(o.value)}" ${p.type === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="fg" id="pf-sessions-wrap" style="${p.type === 'package' ? '' : 'display:none'}">
    <label class="fl">Sessions included</label>
    <input type="number" id="pf-sessions" class="fi" min="1" value="${p.sessions_included != null ? p.sessions_included : ''}" placeholder="e.g. 10">
    <div class="products-panel-note">Used by package-type plans to set the package size at deal time.</div>
  </div>
  <div class="fg">
    <label class="fl">Description</label>
    <textarea id="pf-description" class="fi" rows="3" placeholder="Internal description">${esc(p.description || '')}</textarea>
  </div>
  <div class="fg">
    <label class="fl">Status</label>
    <select id="pf-status" class="fi fsel">
      ${STATUS_OPTS.map(o => `<option value="${esc(o.value)}" ${(p.status || 'active') === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>
  </div>
</div>`
  }

  function hookProductForm() {
    const typeSel = document.getElementById('pf-type')
    if (!typeSel) return
    typeSel.addEventListener('change', () => {
      document.getElementById('pf-sessions-wrap').style.display = typeSel.value === 'package' ? '' : 'none'
    })
  }

  function renderPlanForm() {
    const product = _products.find(x => x.id === _panel.productId) || {}
    const pl = _panel.mode === 'plan-edit'
      ? ((product.plans || []).find(x => x.id === _panel.planId) || {})
      : {}
    const dbType = pl.plan_type || 'one_time'
    const isPackage = dbType === 'package'
    // Payment-type dropdown reflects only one_time/installment/subscription.
    // When the row's plan_type is 'package', fall back to one_time as the latent payment type.
    const paymentType = isPackage ? 'one_time' : dbType
    const isInstall = paymentType === 'installment'
    const sessions = product.sessions_included
    return `
<div class="products-panel-section">
  <div class="fg">
    <label class="fl">Name</label>
    <input type="text" id="plf-name" class="fi" value="${esc(pl.name || '')}" placeholder="e.g. Full pay">
  </div>
  <div class="form-row">
    <div class="fg" style="flex:1">
      <label class="fl">Payment type</label>
      <select id="plf-payment-type" class="fi fsel" ${isPackage ? 'disabled' : ''}>
        ${PAYMENT_TYPE_OPTS.map(o => `<option value="${esc(o.db)}" ${paymentType === o.db ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
      </select>
    </div>
    <div class="fg" style="flex:1">
      <label class="fl">Status</label>
      <select id="plf-status" class="fi fsel">
        ${STATUS_OPTS.map(o => `<option value="${esc(o.value)}" ${(pl.status || 'active') === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="fg" style="margin-top:6px">
    <label class="cb-row">
      <input type="checkbox" id="plf-is-package" ${isPackage ? 'checked' : ''}>
      <span>This plan includes a session package</span>
    </label>
    <div class="products-panel-note">When checked, the plan is treated as a package and the payment type is ignored.</div>
  </div>
  <div class="fg" id="plf-package-sessions-wrap" style="${isPackage ? '' : 'display:none'}">
    <label class="fl">Sessions included</label>
    <input type="number" class="fi" value="${sessions != null ? sessions : ''}" disabled>
    <div class="products-panel-note">Sessions come from the product (<strong>${esc(product.name || 'this product')}</strong>). Edit the product to change.</div>
  </div>
  <div class="form-row">
    <div class="fg" style="flex:2">
      <label class="fl">Amount</label>
      <input type="number" id="plf-amount" class="fi" value="${pl.amount != null ? pl.amount : ''}" placeholder="0" min="0" step="0.01">
    </div>
    <div class="fg" style="flex:1">
      <label class="fl">Currency</label>
      <select id="plf-currency" class="fi fsel">
        ${CURRENCIES.map(c => `<option value="${c}" ${(pl.currency || product.currency || 'USD') === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="fg">
    <label class="fl">Payment rail</label>
    <select id="plf-rail" class="fi fsel">
      ${PAYMENT_RAILS.map(r => `<option value="${esc(r.value)}" ${(pl.payment_rail || '') === r.value ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}
    </select>
  </div>
  <div class="fg">
    <label class="fl">Payment link URL</label>
    <input type="url" id="plf-link-url" class="fi" value="${esc(pl.link_url || '')}" placeholder="https://…">
  </div>
  <div class="fg" id="plf-installments-wrap" style="${isInstall && !isPackage ? '' : 'display:none'}">
    <label class="fl">Installments count</label>
    <input type="number" id="plf-installments" class="fi" min="2" max="36" value="${pl.installments_count != null ? pl.installments_count : ''}" placeholder="e.g. 3">
  </div>
  <div class="fg">
    <label class="fl">Target country <span style="color:var(--mu2);font-weight:400">(optional)</span></label>
    <input type="text" id="plf-country" class="fi" value="${esc(pl.target_customer_country || '')}" placeholder="e.g. IL, US, EU">
  </div>
</div>`
  }

  function hookPlanForm() {
    const ptSel = document.getElementById('plf-payment-type')
    const cb    = document.getElementById('plf-is-package')
    if (!ptSel || !cb) return
    const sync = () => {
      const checked = cb.checked
      ptSel.disabled = checked
      document.getElementById('plf-package-sessions-wrap').style.display = checked ? '' : 'none'
      document.getElementById('plf-installments-wrap').style.display =
        (!checked && ptSel.value === 'installment') ? '' : 'none'
    }
    cb.addEventListener('change', sync)
    ptSel.addEventListener('change', sync)
  }

  async function renderDealsTab(body) {
    body.innerHTML = '<div class="products-deals-empty">Loading deals…</div>'
    try {
      const deals = await getDealsForPlan(_panel.planId)
      if (!deals.length) {
        body.innerHTML = '<div class="products-deals-empty">No deals reference this plan yet.</div>'
        return
      }
      body.innerHTML = '<div class="products-deals-list">' + deals.map(renderDealRow).join('') + '</div>'
    } catch (e) {
      console.error('[products] deals tab', e)
      body.innerHTML = '<div class="products-error">Failed to load deals: ' + esc(e.message) + '</div>'
    }
  }

  function renderDealRow(d) {
    const sessions = (d.sessions_used != null && d.sessions_total != null)
      ? `${d.sessions_used}/${d.sessions_total} sessions` : ''
    const amount = d.agreed_price != null
      ? `${Number(d.agreed_price).toLocaleString()} ${d.agreed_currency || ''}`.trim()
      : ''
    const status = d.sales_status || ''
    return `
<a class="products-deal-row" href="deal.html?deal=${esc(d.id)}">
  <div>
    <div class="products-deal-client">${esc(d.client_name || '(no client)')}</div>
    <div class="products-deal-meta">${esc([sessions, status].filter(Boolean).join(' · '))}</div>
  </div>
  <div style="text-align:right">
    <div class="products-deal-amount">${esc(amount)}</div>
    <div class="products-deal-status">${esc(status)}</div>
  </div>
</a>`
  }

  async function save() {
    if (!_panel.mode) return
    if (_panel.mode === 'product-new' || _panel.mode === 'product-edit') return saveProduct()
    return savePlan()
  }

  async function saveProduct() {
    const name = document.getElementById('pf-name').value.trim()
    if (!name) { showToast('Product name is required', 'warn'); return }
    const type = document.getElementById('pf-type').value || null
    const sessions = type === 'package'
      ? (parseInt(document.getElementById('pf-sessions').value, 10) || null)
      : null
    const fields = {
      name,
      category:    document.getElementById('pf-category').value || null,
      type,
      sessions_included: sessions,
      description: document.getElementById('pf-description').value.trim() || null,
      status:      document.getElementById('pf-status').value || 'active',
    }
    try {
      if (_panel.mode === 'product-new') {
        await createProductFull(fields)
        showToast('Product created', 'info')
      } else {
        await updateProductFull(_panel.productId, fields)
        showToast('Product saved', 'info')
      }
      closePanel(); await reload()
    } catch (e) {
      console.error('[products] saveProduct', e)
      showToast('Save failed: ' + e.message, 'error')
    }
  }

  async function savePlan() {
    const amount = parseFloat(document.getElementById('plf-amount').value)
    if (isNaN(amount) || amount < 0) { showToast('Amount is required', 'warn'); return }
    const isPackage   = document.getElementById('plf-is-package').checked
    const paymentType = document.getElementById('plf-payment-type').value || 'one_time'
    const planType    = isPackage ? 'package' : paymentType
    const installments = (!isPackage && paymentType === 'installment')
      ? (parseInt(document.getElementById('plf-installments').value, 10) || null)
      : null
    const railVal = document.getElementById('plf-rail').value || null
    const linkUrl = document.getElementById('plf-link-url').value.trim() || null
    const country = document.getElementById('plf-country').value.trim() || null
    const status  = document.getElementById('plf-status').value || 'active'
    const fields = {
      product_id:        _panel.productId,
      name:              document.getElementById('plf-name').value.trim() || PLAN_TYPE_DB_TO_LABEL[planType] || 'Plan',
      plan_type:         planType,
      amount,
      currency:          document.getElementById('plf-currency').value || 'USD',
      payment_rail:      railVal,
      link_source:       railVal,
      link_url:          linkUrl,
      installments_count: installments,
      target_customer_country: country,
      status,
    }
    try {
      if (_panel.mode === 'plan-new') {
        await createPlanFull(fields)
        showToast('Plan created', 'info')
      } else {
        await updatePlanFull(_panel.planId, fields)
        showToast('Plan saved', 'info')
      }
      closePanel(); await reload()
    } catch (e) {
      console.error('[products] savePlan', e)
      showToast('Save failed: ' + e.message, 'error')
    }
  }

  async function doDelete() {
    if (_panel.mode === 'product-edit') {
      const p = _products.find(x => x.id === _panel.productId)
      if (!p) return
      showConfirm(`Archive product "${p.name}"? Plans will be archived too.`, async () => {
        try {
          await deleteProductFull(p.id)
          showToast('Product archived', 'info')
          closePanel(); await reload()
        } catch (e) {
          console.error('[products] delete product', e)
          showToast(e.message || 'Delete failed', 'error')
        }
      })
    } else if (_panel.mode === 'plan-edit') {
      showConfirm('Archive this plan?', async () => {
        try {
          await deletePlanFull(_panel.planId)
          showToast('Plan archived', 'info')
          closePanel(); await reload()
        } catch (e) {
          console.error('[products] delete plan', e)
          showToast(e.message || 'Delete failed', 'error')
        }
      })
    }
  }

  return {
    init,
    toggleProduct,
    openNewProduct,
    openEditProduct,
    openNewPlan,
    openEditPlan,
    closePanel,
    switchTab,
    save,
    delete: doDelete,
  }
})()

window.PRODUCTS = PRODUCTS
