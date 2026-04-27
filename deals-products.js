// deals-products.js — products page

const GATEWAY_META = {
  green_invoice: 'Green Invoice',
  thrivecart:    'ThriveCart',
  wise:          'Wise',
  stripe:        'Stripe',
}

async function initProductsPage(force = false) {
  if (_productsPageLoading) return
  if (_productsPageLoaded && !force) {
    renderProducts()
    return
  }

  const container = document.getElementById('products-container')
  if (container) {
    container.innerHTML = `
      <div class="products-page-head">
        <h1 class="products-page-title">Products</h1>
        <button class="btn btn-primary btn-sm" onclick="openProductModal(null)">+ New Product</button>
      </div>
      <div class="products-page-loading">Loading products…</div>
    `
  }

  _productsPageLoading = true
  try {
    _programsWithProducts = await getProductsWithPlans()
    _productsPageLoaded = true
    _productInlineEdit = { id: null, draft: null }
    _planInlineEdit = { productId: null, planId: null, isNew: false, draft: null }
    renderProducts()
  } catch (e) {
    console.error('[HSos] initProductsPage error:', e)
    showToast(`Failed to load products: ${e.message || e}`, 'warn')
    if (container) {
      container.innerHTML = `
        <div class="products-page-head">
          <h1 class="products-page-title">Products</h1>
          <button class="btn btn-primary btn-sm" onclick="openProductModal(null)">+ New Product</button>
        </div>
        <div class="products-page-empty">Failed to load products</div>
      `
    }
  } finally {
    _productsPageLoading = false
  }
}

function _formatProductBasePrice(product) {
  if (product?.base_price == null) return '—'
  const currency = product.base_currency || product.currency || ''
  return `${Number(product.base_price).toLocaleString('en', { maximumFractionDigits: 2 })} ${currency}`.trim()
}

function _getPlanTypeMeta(plan) {
  const type = plan?.plan_type || ''
  if (type === 'one_time' || type === 'one-payment') return { label: 'One payment', cls: 'one-time' }
  if (type === 'installment' || type === 'installments') {
    const count = parseInt(plan?.installments_count, 10)
    return { label: `${Number.isFinite(count) ? count : '—'} payments`, cls: 'installment' }
  }
  if (type === 'subscription') return { label: 'Subscription', cls: 'subscription' }
  return { label: type || '—', cls: 'manual' }
}

function _truncateUrl(url, max = 30) {
  if (!url) return '—'
  return url.length > max ? `${url.slice(0, max)}...` : url
}

function _findProductInPrograms(productId) {
  for (const program of (_programsWithProducts || [])) {
    const product = (program.products || []).find(p => p.id === productId)
    if (product) return product
  }
  return null
}

function _renderPlanDisplayRow(product, plan) {
  const meta = _getPlanTypeMeta(plan)
  const amount = plan?.amount == null
    ? '—'
    : Number(plan.amount).toLocaleString('en', { maximumFractionDigits: 2 })
  const currency = plan?.currency || '—'
  const url = plan?.link_url || ''
  const pid = escHtmlAttr(product.id)
  const planId = escHtmlAttr(plan.id)

  return `
    <tr>
      <td>
        <span class="products-plan-pill ${meta.cls}">${meta.label}</span>
      </td>
      <td class="products-plan-amount">${amount}</td>
      <td>${escHtml(currency)}</td>
      <td>
        ${url
          ? `<a class="products-plan-link" href="${escHtmlAttr(url)}" target="_blank" rel="noopener">${escHtml(_truncateUrl(url))}</a>`
          : '—'}
      </td>
      <td>
        <button class="products-text-link" onclick="startPlanInlineEdit('${pid}','${planId}')">Edit</button>
      </td>
    </tr>
  `
}

function _renderPlanEditRow(product, isNew = false) {
  const draft = _planInlineEdit.draft || {}
  const pid = escHtmlAttr(product.id)
  const planId = escHtmlAttr(_planInlineEdit.planId || '')
  const showInstallments = draft.payment_type === 'installments'
  const currency = draft.currency || product.base_currency || product.currency || 'USD'

  return `
    <tr class="products-plan-edit-row">
      <td>
        <select class="fi fsel products-inline-select" onchange="setPlanInlineField('payment_type', this.value)">
          ${['one-payment','installments','subscription'].map(type =>
            `<option value="${type}"${(draft.payment_type || 'one-payment') === type ? ' selected' : ''}>${type}</option>`
          ).join('')}
        </select>
        ${showInstallments ? `
          <select class="fi fsel products-inline-select" onchange="setPlanInlineField('installments_count', this.value)">
            <option value="">— # payments —</option>
            ${Array.from({length: 36}, (_, i) => i + 1).map(n =>
              `<option value="${n}"${String(draft.installments_count) === String(n) ? ' selected' : ''}>${n}</option>`
            ).join('')}
          </select>` : ''}
      </td>
      <td>
        <input
          class="fi products-inline-input"
          type="number"
          step="0.01"
          value="${escHtml(draft.amount ?? '')}"
          oninput="setPlanInlineField('amount', this.value)"
        >
      </td>
      <td>
        <select class="fi fsel products-inline-select" onchange="setPlanInlineField('currency', this.value)">
          ${['USD','ILS','EUR','GBP'].map(c =>
            `<option value="${c}"${currency === c ? ' selected' : ''}>${c}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <input
          class="fi products-inline-input"
          type="text"
          value="${escHtml(draft.payment_link_url || '')}"
          placeholder="https://..."
          oninput="setPlanInlineField('payment_link_url', this.value)"
        >
      </td>
      <td class="products-actions-cell">
        <button class="products-text-link" onclick="savePlanInlineEdit('${pid}','${isNew ? '' : planId}')">Save</button>
        <button class="products-text-link" onclick="cancelPlanInlineEdit()">Cancel</button>
      </td>
    </tr>
  `
}

function _renderProductPlanArea(product) {
  const plans = [...(product.plans || [])]
  const isEditingInThisProduct = _planInlineEdit.productId === product.id
  const isAddingInThisProduct = isEditingInThisProduct && _planInlineEdit.isNew

  const rows = plans.map(plan => {
    const isEditingThisPlan = isEditingInThisProduct && !_planInlineEdit.isNew && _planInlineEdit.planId === plan.id
    return isEditingThisPlan ? _renderPlanEditRow(product, false) : _renderPlanDisplayRow(product, plan)
  }).join('')

  const addRow = isAddingInThisProduct ? _renderPlanEditRow(product, true) : ''

  if (!plans.length && !isAddingInThisProduct) {
    return `
      <div class="products-plan-empty">
        No plans — <button class="products-text-link" onclick="startAddPlanInline('${escHtmlAttr(product.id)}')">Add plan</button>
      </div>
      <div class="products-card-subfooter">
        <button class="products-text-link" onclick="startAddPlanInline('${escHtmlAttr(product.id)}')">Add plan</button>
      </div>
    `
  }

  return `
    <div class="products-plans-table-wrap">
      <table class="products-plans-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            <th>Currency</th>
            <th>Payment Link</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}${addRow}
        </tbody>
      </table>
    </div>
    <div class="products-card-subfooter">
      ${isAddingInThisProduct
        ? ''
        : `<button class="products-text-link" onclick="startAddPlanInline('${escHtmlAttr(product.id)}')">Add plan</button>`}
    </div>
  `
}

function renderProducts() {
  const container = document.getElementById('products-container')
  if (!container) return

  const programs = [...(_programsWithProducts || [])]
    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
    .map(program => ({
      ...program,
      products: [...(program.products || [])]
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
    }))

  if (!programs.length) {
    container.innerHTML = `
      <div class="products-page-head">
        <h1 class="products-page-title">Products</h1>
        <button class="btn btn-primary btn-sm" onclick="openProductModal(null)">+ New Product</button>
      </div>
      <div class="products-page-empty">No programs</div>
    `
    return
  }

  container.innerHTML = `
    <div class="products-page-head">
      <h1 class="products-page-title">Products</h1>
      <button class="btn btn-primary btn-sm" onclick="openProductModal(null)">+ New Product</button>
    </div>
    <div class="products-programs">
      ${programs.map(program => {
        const products = program.products || []
        const count = products.length
        const isCollapsed = _collapsedPrograms.has(program.id)
        return `
          <section class="products-program-section">
            <div class="products-program-head">
              <div class="products-program-title-wrap">
                <h2 class="products-program-title">${escHtml(program.name || 'Untitled program')}</h2>
                <span class="products-program-count">${count} product${count === 1 ? '' : 's'}</span>
              </div>
              <button class="products-program-toggle" onclick="toggleProgramSection('${escHtmlAttr(program.id)}')">
                ${isCollapsed ? '▸' : '▾'}
              </button>
            </div>
            <div class="products-program-body${isCollapsed ? ' hidden' : ''}">
              ${count
                ? `<div class="products-cards-grid">
                    ${products.map(product => {
                      const isEditingProduct = _productInlineEdit.id === product.id
                      const draft = _productInlineEdit.draft || {}
                      return `
                        <article class="products-card">
                          <div class="products-card-head">
                            <div class="products-card-name">
                              ${isEditingProduct
                                ? `<input
                                    class="fi products-inline-input"
                                    type="text"
                                    value="${escHtml(draft.name || '')}"
                                    oninput="setProductInlineField('name', this.value)"
                                  >`
                                : escHtml(product.name || '—')}
                            </div>
                            <div class="products-card-price">
                              ${isEditingProduct
                                ? `
                                  <input
                                    class="fi products-inline-input products-inline-price"
                                    type="number"
                                    step="0.01"
                                    value="${escHtml(draft.base_price ?? '')}"
                                    oninput="setProductInlineField('base_price', this.value)"
                                  >
                                  <select
                                    class="fi fsel products-inline-select products-inline-currency"
                                    onchange="setProductInlineField('base_currency', this.value)"
                                  >
                                    ${['USD','ILS','EUR','GBP'].map(c =>
                                      `<option value="${c}"${(draft.base_currency || 'USD') === c ? ' selected' : ''}>${c}</option>`
                                    ).join('')}
                                  </select>`
                                : escHtml(_formatProductBasePrice(product))}
                            </div>
                          </div>

                          ${_renderProductPlanArea(product)}

                          <div class="products-card-footer">
                            ${isEditingProduct
                              ? `
                                <button class="products-text-link" onclick="saveProductInlineEdit('${escHtmlAttr(product.id)}')">Save</button>
                                <button class="products-text-link" onclick="cancelProductInlineEdit()">Cancel</button>
                              `
                              : `<button class="products-text-link" onclick="startProductInlineEdit('${escHtmlAttr(product.id)}')">Edit product</button>`}
                          </div>
                        </article>
                      `
                    }).join('')}
                  </div>`
                : `<div class="products-program-empty">No products yet</div>`}
            </div>
          </section>
        `
      }).join('')}
    </div>
  `
}

function toggleProgramSection(programId) {
  if (!programId) return
  if (_collapsedPrograms.has(programId)) _collapsedPrograms.delete(programId)
  else _collapsedPrograms.add(programId)
  renderProducts()
}
window.toggleProgramSection = toggleProgramSection

function startProductInlineEdit(productId) {
  const product = _findProductInPrograms(productId)
  if (!product) return
  _productInlineEdit = {
    id: productId,
    draft: {
      name: product.name || '',
      base_price: product.base_price ?? '',
      base_currency: product.base_currency || product.currency || 'USD',
    },
  }
  renderProducts()
}
window.startProductInlineEdit = startProductInlineEdit

function setProductInlineField(field, value) {
  if (!_productInlineEdit.id) return
  _productInlineEdit = {
    ..._productInlineEdit,
    draft: {
      ...(_productInlineEdit.draft || {}),
      [field]: value,
    }
  }
}
window.setProductInlineField = setProductInlineField

function cancelProductInlineEdit() {
  _productInlineEdit = { id: null, draft: null }
  renderProducts()
}
window.cancelProductInlineEdit = cancelProductInlineEdit

async function saveProductInlineEdit(productId) {
  const product = _findProductInPrograms(productId)
  if (!product) return

  const draft = _productInlineEdit.draft || {}
  const name = String(draft.name || '').trim()
  const basePriceRaw = String(draft.base_price ?? '').trim()
  const basePrice = basePriceRaw === '' ? null : Number(basePriceRaw)
  const baseCurrency = String(draft.base_currency || '').trim() || 'USD'

  if (!name) {
    showToast('Product name is required', 'warn')
    return
  }
  if (basePriceRaw !== '' && !Number.isFinite(basePrice)) {
    showToast('Base price must be a number', 'warn')
    return
  }

  const currencyField = Object.prototype.hasOwnProperty.call(product, 'base_currency') ? 'base_currency' : 'currency'
  const fields = { name, base_price: basePrice, [currencyField]: baseCurrency }

  try {
    const updated = await updateProduct(productId, fields)
    const i = _products.findIndex(p => p.id === productId)
    if (i !== -1) _products[i] = { ..._products[i], ...updated }
    showToast('Product updated')
    await initProductsPage(true)
  } catch (e) {
    console.error('[HSos] saveProductInlineEdit error:', e)
    showToast(`Failed to update product: ${e.message || e}`, 'warn')
  }
}
window.saveProductInlineEdit = saveProductInlineEdit

function startPlanInlineEdit(productId, planId) {
  const product = _findProductInPrograms(productId)
  const plan = (product?.plans || []).find(p => p.id === planId)
  if (!product || !plan) return

  const dbToForm = (t) => t === 'one_time' ? 'one-payment' : t === 'installment' ? 'installments' : (t || 'one-payment')
  _planInlineEdit = {
    productId,
    planId,
    isNew: false,
    draft: {
      payment_type: dbToForm(plan.plan_type),
      amount: plan.amount ?? '',
      currency: plan.currency || product.base_currency || product.currency || 'USD',
      payment_link_url: plan.link_url || '',
      installments_count: plan.installments_count ?? '',
    },
  }
  renderProducts()
}
window.startPlanInlineEdit = startPlanInlineEdit

function startAddPlanInline(productId) {
  const product = _findProductInPrograms(productId)
  if (!product) return
  _planInlineEdit = {
    productId,
    planId: null,
    isNew: true,
    draft: {
      payment_type: 'one-payment',
      amount: '',
      currency: product.base_currency || product.currency || 'USD',
      payment_link_url: '',
      installments_count: '',
    },
  }
  renderProducts()
}
window.startAddPlanInline = startAddPlanInline

function setPlanInlineField(field, value) {
  if (!_planInlineEdit.productId) return
  const nextDraft = {
    ...(_planInlineEdit.draft || {}),
    [field]: value,
  }
  if (field === 'payment_type' && value !== 'installments') {
    nextDraft.installments_count = ''
  }
  _planInlineEdit = { ..._planInlineEdit, draft: nextDraft }
  if (field === 'payment_type') renderProducts()
}
window.setPlanInlineField = setPlanInlineField

function cancelPlanInlineEdit() {
  _planInlineEdit = { productId: null, planId: null, isNew: false, draft: null }
  renderProducts()
}
window.cancelPlanInlineEdit = cancelPlanInlineEdit

function _defaultPlanName(type, installmentsCount) {
  if (type === 'one_time') return 'One payment'
  if (type === 'installment') return `${installmentsCount || '—'} payments`
  if (type === 'subscription') return 'Subscription'
  return 'Manual'
}

async function savePlanInlineEdit(productId) {
  if (_planInlineEdit.productId !== productId) return
  const draft = _planInlineEdit.draft || {}

  const paymentType = String(draft.payment_type || 'one_time')
  const amountRaw = String(draft.amount ?? '').trim()
  const amount = amountRaw === '' ? null : Number(amountRaw)
  const currency = String(draft.currency || 'USD').trim() || 'USD'
  const paymentLink = String(draft.payment_link_url || '').trim() || null
  const installmentsRaw = String(draft.installments_count ?? '').trim()
  const installmentsCount = paymentType === 'installments'
    ? (installmentsRaw === '' ? null : parseInt(installmentsRaw, 10))
    : null

  if (amountRaw !== '' && !Number.isFinite(amount)) {
    showToast('Amount must be a number', 'warn')
    return
  }
  if (paymentType === 'installment' && (!Number.isFinite(installmentsCount) || installmentsCount < 2)) {
    showToast('Installments count must be 2 or more', 'warn')
    return
  }

  const formToDb = (t) => t === 'one-payment' ? 'one_time' : t === 'installments' ? 'installment' : t
  const fields = {
    plan_type: formToDb(paymentType),
    amount,
    currency,
    link_url: paymentLink,
    installments_count: installmentsCount,
  }

  try {
    if (_planInlineEdit.isNew) {
      await insertPlan({
        ...fields,
        product_id: productId,
        name: _defaultPlanName(paymentType, installmentsCount),
      })
      showToast('Plan added')
    } else {
      await updatePlan(_planInlineEdit.planId, fields)
      showToast('Plan updated')
    }
    await initProductsPage(true)
  } catch (e) {
    console.error('[HSos] savePlanInlineEdit error:', e)
    showToast(`Failed to save plan: ${e.message || e}`, 'warn')
  }
}
window.savePlanInlineEdit = savePlanInlineEdit

// ─── product modal ────────────────────────────────────────────

function openProductModal(id, e) {
  e?.stopPropagation()
  if (id && window.SidePanel?.open) { window.SidePanel.open('product', { id }); return }
  if (id && window.PanelManager?.open) {
    window.PanelManager.open('product', id)
    return
  }
  _editProductId = id
  const p = id ? _products.find(x => x.id === id) : null

  const body = document.getElementById('product-modal-body')
  const title = document.getElementById('product-modal-title')
  title.textContent = id ? 'Edit Product' : 'New Product'

  let plText = ''
  if (p?.payment_links) {
    try {
      plText = typeof p.payment_links === 'string' ? p.payment_links : JSON.stringify(p.payment_links, null, 2)
    } catch { plText = '' }
  }

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="fg">
        <label class="fl">Name</label>
        <input class="fi" id="pm-name" value="${p?.name || ''}" placeholder="Product name">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fg">
          <label class="fl">Type</label>
          <select class="fi fsel" id="pm-type" onchange="onPmTypeChange(this.value)">
            ${['session','package','workshop','custom'].map(t => `<option value="${t}"${p?.type === t ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="fl">Category</label>
          <input class="fi" id="pm-category" value="${p?.category || ''}" placeholder="e.g. fitness, coaching">
        </div>
        <div class="fg">
          <label class="fl">Base price</label>
          <input class="fi" type="number" id="pm-price" value="${p?.base_price != null ? p.base_price : ''}" placeholder="0">
        </div>
        <div class="fg">
          <label class="fl">Currency</label>
          <select class="fi fsel" id="pm-currency">
            ${['EUR','USD','ILS','GBP'].map(c => `<option value="${c}"${(p?.currency || 'EUR') === c ? ' selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="fg" id="pm-sessions-wrap" style="${p?.type === 'package' ? '' : 'display:none'}">
        <label class="fl">Default sessions (package)</label>
        <input class="fi" type="number" id="pm-sessions" value="${p?.default_package_sessions || ''}" placeholder="e.g. 10">
      </div>
      <div class="fg">
        <label class="fl">Payment links (JSON)</label>
        <textarea class="fi" id="pm-links" rows="3" placeholder='{"stripe":"https://...","checkout":"https://..."}'>${plText}</textarea>
        <div style="font-size:10px;color:var(--mu2);margin-top:3px">JSON object or array of {"url":"…","label":"…"}</div>
      </div>
      <div class="fg">
        <label class="fl">Notes</label>
        <textarea class="fi" id="pm-notes" rows="2">${p?.notes || ''}</textarea>
      </div>
    </div>
  `

  document.getElementById('pm-delete-btn').style.display = id ? 'block' : 'none'
  document.getElementById('modal-product').classList.add('open')
}
window.openProductModal = openProductModal

function closeProductModal() {
  document.getElementById('modal-product').classList.remove('open')
  _editProductId = null
}
window.closeProductModal = closeProductModal

function onPmTypeChange(type) {
  const wrap = document.getElementById('pm-sessions-wrap')
  if (wrap) wrap.style.display = type === 'package' ? '' : 'none'
}
window.onPmTypeChange = onPmTypeChange

async function saveProductModal() {
  const name     = document.getElementById('pm-name').value.trim()
  const type     = document.getElementById('pm-type').value
  const category = document.getElementById('pm-category').value.trim() || null
  const price    = parseFloat(document.getElementById('pm-price').value) || null
  const currency = document.getElementById('pm-currency').value
  const sessions = type === 'package' ? (parseInt(document.getElementById('pm-sessions').value) || null) : null
  const notes    = document.getElementById('pm-notes').value.trim() || null
  const linksRaw = document.getElementById('pm-links').value.trim()

  if (!name) { showToast('Product name required', 'warn'); return }

  let payment_links = null
  if (linksRaw) {
    try {
      payment_links = JSON.parse(linksRaw)
    } catch {
      showToast('Payment links must be valid JSON', 'warn')
      return
    }
  }

  const fields = { name, type, category, base_price: price, currency, default_package_sessions: sessions, notes, payment_links }

  try {
    if (_editProductId) {
      const updated = await updateProduct(_editProductId, fields)
      const i = _products.findIndex(p => p.id === _editProductId)
      if (i !== -1) _products[i] = { ..._products[i], ...updated }
      showToast('Product saved')
    } else {
      const created = await createProduct({ ...fields, active: true })
      _products.push(created)
      showToast('Product created')
    }
    closeProductModal()
    if (_page === 'products') await initProductsPage(true)
  } catch(e) {
    console.error('[HSos] saveProductModal error:', e)
    showToast('Save failed — check console', 'warn')
  }
}
window.saveProductModal = saveProductModal

async function deleteProductModal() {
  if (!_editProductId) return
  const p = _products.find(x => x.id === _editProductId)
  showConfirm(`Delete product "${p?.name}"? This cannot be undone.`, async () => {
    try {
      await deleteProduct(_editProductId)
      _products = _products.filter(x => x.id !== _editProductId)
      closeProductModal()
      if (_page === 'products') await initProductsPage(true)
      showToast('Product deleted')
    } catch(e) {
      console.error('[HSos] deleteProductModal error:', e)
      showToast('Delete failed — check console', 'warn')
    }
  })
}
window.deleteProductModal = deleteProductModal

// ─── plans page (product_plans) ───────────────────────────────

let _plansProductId  = null
let _plans           = []

async function openPlansView(productId, e) {
  e?.stopPropagation()
  _plansProductId = productId
  const product = _products.find(p => p.id === productId)

  document.getElementById('plans-product-name').textContent = product?.name || '—'
  document.getElementById('plans-product-meta').textContent =
    [product?.type, product?.category].filter(Boolean).join(' · ') || ''

  document.getElementById('products-list-view').classList.add('hidden')
  document.getElementById('plans-detail-view').classList.remove('hidden')

  await reloadPlans()
}
window.openPlansView = openPlansView

function closePlansView() {
  _plansProductId = null
  _plans = []
  document.getElementById('plans-detail-view').classList.add('hidden')
  document.getElementById('products-list-view').classList.remove('hidden')
}
window.closePlansView = closePlansView

async function reloadPlans() {
  const container = document.getElementById('plans-container')
  container.innerHTML = '<div style="color:var(--mu2);font-size:12px;padding:8px">Loading…</div>'
  try {
    _plans = await getAllProductPlans(_plansProductId)
    renderPlans()
  } catch (err) {
    console.error(err)
    container.innerHTML = '<div style="color:var(--red-text);font-size:12px;padding:8px">Failed to load plans</div>'
  }
}

function renderPlans() {
  const container = document.getElementById('plans-container')
  if (!_plans.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--mu2)">
        No plans yet — click <strong>+ Add Plan</strong> to create one.
      </div>`
    return
  }

  container.innerHTML = `
    <div class="block">
      <table class="tbl">
        <thead>
          <tr>
            <th>Plan name</th>
            <th>Gateway</th>
            <th>Price</th>
            <th>Installments</th>
            <th>Country</th>
            <th>Vendor</th>
            <th>Default</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${_plans.map(plan => {
            const isActive = (plan.status === 'active')
            return `
            <tr style="${!isActive ? 'opacity:0.45' : ''}">
              <td style="font-weight:500">
                ${plan.name || ''}${!isActive ? ' <span style="font-size:10px;color:var(--mu2)">(inactive)</span>' : ''}
                ${plan.link_url ? `
                  <a href="${escHtmlAttr(plan.link_url)}" target="_blank" rel="noopener"
                     style="margin-left:6px;color:var(--blue-text);font-size:11px;text-decoration:none" title="${escHtmlAttr(plan.link_url)}">🔗</a>
                  <button class="btn btn-sm" style="margin-left:2px;padding:1px 5px;font-size:10px"
                    onclick="event.stopPropagation();navigator.clipboard.writeText('${escHtmlAttr(plan.link_url)}').then(()=>showToast('Link copied'))">⎘</button>
                ` : ''}
              </td>
              <td style="font-size:12px;color:var(--mu)">${GATEWAY_META[plan.payment_rail] || plan.payment_rail || ''}</td>
              <td class="mono">${fmt(plan.amount, plan.currency)}</td>
              <td class="mono">${(plan.installments_count || 0) > 1 ? plan.installments_count + 'x' : '1x'}</td>
              <td style="font-size:12px;color:var(--mu)">${plan.target_customer_country || '—'}</td>
              <td style="font-size:12px;color:var(--mu)">${_vendors.find(v => v.id === plan.vendor_id)?.full_name || '—'}</td>
              <td>${plan.is_default ? '<span class="pill active" style="font-size:10px">default</span>' : ''}</td>
              <td style="text-align:right">
                <button class="btn btn-sm" onclick="openPlanModal('${plan.id}',event)">Edit</button>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>`
}

function openPlanModal(id, e) {
  e?.stopPropagation()
  if (id && window.SidePanel?.open) { window.SidePanel.open('plan', { id }); return }
  window.PanelManager?.open('plan', id)
}
window.openPlanModal = openPlanModal
