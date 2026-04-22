// products.js — Products page
// Rebuilt 2026-04-16. Depends on db.js (getAllProductsWithPlans, createProductFull,
// updateProductFull, deleteProductFull, createPlanFull, updatePlanFull, deletePlanFull).

// ─── constants ────────────────────────────────────────────────

const CATEGORY_OVERLAY = {
  'Coaching program': 'rgba(26,46,26,0.88)',
  'Online course':    'rgba(15,46,46,0.90)',
  'Group coaching':   'rgba(28,25,55,0.90)',
  'Workshop':         'rgba(55,28,15,0.88)',
}
const OVERLAY_DEFAULT = 'rgba(35,35,45,0.88)'

const SOURCE_ID_LABELS = {
  thrivecart:    'TC ID',
  green_invoice: 'GI ID',
  wise:          'Wise ID',
  bank_transfer: 'Reference',
  manual:        'Label',
}

const SOURCE_LABELS = {
  thrivecart:    'ThriveCart',
  green_invoice: 'Green Invoice',
  wise:          'Wise',
  bank_transfer: 'Bank Transfer',
  manual:        'Manual URL',
}

const SOURCE_NORMALIZE = {
  thrivecart: 'thrivecart',
  'thrive cart': 'thrivecart',
  'green invoice': 'green_invoice',
  green_invoice: 'green_invoice',
  wise: 'wise',
  'bank transfer': 'bank_transfer',
  bank_transfer: 'bank_transfer',
  manual: 'manual',
  'manual url': 'manual',
  stripe: 'manual',
  paypal: 'manual',
}

const BG_IMAGE = "url('files/class.png')"

// ─── state ────────────────────────────────────────────────────

let _products = []    // flat list with .plans array
let _editingProduct = null  // product being edited in modal (null = new)
let _editingPlan    = null  // plan being edited in modal (null = new)
let _editingPlanProductId = null  // product.id for new plan

// ─── init ─────────────────────────────────────────────────────

async function initProducts() {
  try {
    _products = await getAllProductsWithPlans()
    renderStack()
    handleDeepLink()
  } catch (e) {
    console.error('[products]', e)
    document.getElementById('prd-stack').innerHTML =
      `<div style="padding:32px;text-align:center;color:var(--red-text);font-size:13px">Failed to load products: ${e.message}</div>`
  }
}

// ─── render ───────────────────────────────────────────────────

function renderStack() {
  const stack = document.getElementById('prd-stack')
  if (!_products.length) {
    stack.innerHTML = `
      <div style="padding:48px;text-align:center;color:var(--mu2);font-size:13px">
        No products yet. Click <strong>+ New product</strong> to add one.
      </div>`
    return
  }
  stack.innerHTML = _products.map(renderProductSection).join('')
}

function renderProductSection(product) {
  const overlay = CATEGORY_OVERLAY[product.category] || OVERLAY_DEFAULT
  const plans   = product.plans || []
  const planCount = plans.length
  const currency  = product.currency || (plans[0]?.currency) || ''

  const subLine = [
    planCount + ' plan' + (planCount !== 1 ? 's' : ''),
    currency,
    product.category || '',
  ].filter(Boolean).join(' · ')

  const logoHtml = product.logo_url
    ? `<img src="${esc(product.logo_url)}" class="prd-logo" alt="">`
    : ''

  const statusClass = product.status || 'active'
  const statusLabel = product.status ? product.status.charAt(0).toUpperCase() + product.status.slice(1) : 'Active'

  const heroStyle = `--product-overlay:${overlay}`

  return `
<div class="prd-section" id="prd-section-${product.id}" data-product-id="${product.id}">
  <div class="prd-hero" style="${heroStyle}">
    <div class="prd-hero__bg" style="background-image:${BG_IMAGE}"></div>
    <div class="prd-hero__overlay"></div>
    <div class="prd-hero-left">
      ${logoHtml}
      <div class="prd-hero-id-wrap">
        <div class="prd-hero-name">${esc(product.name)}</div>
        <div class="prd-hero-sub">${esc(subLine)}</div>
      </div>
    </div>
    <div class="prd-hero-right">
      <span class="prd-status-pill ${statusClass}">${statusLabel}</span>
      <button class="prd-hero-btn" onclick="openEditProductModal('${product.id}')">Edit product</button>
      <button class="prd-hero-btn" onclick="openNewPlanModal('${product.id}')">+ Add plan</button>
    </div>
  </div>
  <div class="prd-plans-area" style="background-color:${darkenOverlay(overlay)}">
    ${renderPlansArea(product)}
  </div>
</div>`
}

function darkenOverlay(overlay) {
  // Stack a slight darkening on the plans area background
  // We just return a very dark rgba to be used as background-color
  // combined with the section's border-radius clip
  return 'rgba(0,0,0,0.55)'
}

function renderPlansArea(product) {
  const plans = product.plans || []
  if (!plans.length) {
    return `<div class="prd-plans-empty" onclick="openNewPlanModal('${product.id}')">No plans yet — + Add plan</div>`
  }
  const cards = plans.map(plan => renderPlanCard(plan, product)).join('')
  const addCard = `
    <div class="prd-plan-add-card" onclick="openNewPlanModal('${product.id}')">
      + Add plan
    </div>`
  return `<div class="prd-plans-row">${cards}${addCard}</div>`
}

function renderPlanCard(plan, product) {
  const planType = plan.plan_type || plan.payment_type || '—'
  const amount   = plan.amount != null ? Number(plan.amount).toLocaleString() : '—'
  const currency = plan.currency || ''
  const planUid  = plan.plan_uid || ''
  const status   = plan.status || 'active'

  // Installment note
  let note = plan.description || ''
  if (!note) {
    const count = plan.installments_count
    if (count && count > 1) note = `${count} installments`
    else if (planType.toLowerCase().includes('subscription')) note = 'Recurring'
  }

  // Payment link
  const linkSource = plan.link_source || plan.payment_rail || ''
  const linkSourceLabel = formatPlanSource(linkSource)
  const linkUrl    = plan.link_url || plan.payment_link_url || ''
  const linkId     = plan.link_id || plan.external_id || ''

  const linkHtml = linkUrl
    ? `<div class="prd-plan-link-source">${esc(linkSourceLabel || 'Link')}</div>
       <a class="prd-plan-link" href="${esc(linkUrl)}" target="_blank" title="${esc(linkUrl)}">${esc(linkUrl)}</a>`
    : (linkId ? `<div class="prd-plan-link-source">${esc(linkSourceLabel)}</div>
                 <div class="prd-plan-uid" style="color:var(--blue-text)">${esc(linkId)}</div>` : '')

  // Status opacity hint for draft/archived
  const cardStyle = status === 'archived' ? 'opacity:0.5' : (status === 'draft' ? 'opacity:0.75' : '')

  return `
<div class="prd-plan-card" id="prd-plan-card-${plan.id}" data-plan-id="${plan.id}" style="${cardStyle}">
  <button class="prd-plan-edit-btn" title="Edit plan" onclick="openEditPlanModal('${plan.id}','${product.id}')">✎</button>
  <div class="prd-plan-type">${esc(planType)}</div>
  <div class="prd-plan-amount-row">
    <div class="prd-plan-amount">${amount}</div>
    <div class="prd-plan-currency">${esc(currency)}</div>
  </div>
  ${note ? `<div class="prd-plan-note">${esc(note)}</div>` : ''}
  ${planUid ? `<div class="prd-plan-uid">${esc(planUid)}</div>` : ''}
  ${linkHtml}
</div>`
}

// ─── deep link ────────────────────────────────────────────────

function handleDeepLink() {
  const params = new URLSearchParams(window.location.search)
  const planUid = params.get('plan')
  if (!planUid) return

  // Find the plan card across all products
  setTimeout(() => {
    // Cards are identified by plan.plan_uid, not plan.id
    // We need to find which rendered card corresponds to planUid
    let targetCard = null
    for (const product of _products) {
      const plan = (product.plans || []).find(p => p.plan_uid === planUid)
      if (plan) {
        targetCard = document.getElementById(`prd-plan-card-${plan.id}`)
        break
      }
    }
    if (!targetCard) return
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
    targetCard.classList.add('highlighted')
    targetCard.addEventListener('animationend', () => targetCard.classList.remove('highlighted'), { once: true })
  }, 300)
}

// ─── helpers ──────────────────────────────────────────────────
// esc defined globally in app.js

function normalizePlanSource(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const direct = SOURCE_NORMALIZE[raw]
  if (direct) return direct
  const lower = SOURCE_NORMALIZE[raw.toLowerCase()]
  return lower || raw
}

function formatPlanSource(value) {
  const normalized = normalizePlanSource(value)
  return SOURCE_LABELS[normalized] || String(value || '')
}

function toLegacyPaymentFields(planTypeValue, installmentsCount) {
  const raw = String(planTypeValue || '').trim().toLowerCase()
  if (raw === 'subscription') return { payment_type: 'subscription', installments_count: null }
  if (raw === 'installments') return { payment_type: 'installments', installments_count: installmentsCount ? parseInt(installmentsCount, 10) : null }
  return { payment_type: 'one-payment', installments_count: null }
}

function getProductById(id) {
  return _products.find(p => p.id === id) || null
}

function getPlanById(productId, planId) {
  const product = getProductById(productId)
  if (!product) return null
  return (product.plans || []).find(p => p.id === planId) || null
}

// ─── PRODUCT MODAL ────────────────────────────────────────────

let _pm_logoUrl = null

function openNewProductModal() {
  _editingProduct = null
  _pm_logoUrl = null

  document.getElementById('pm-title').textContent = 'New product'
  document.getElementById('pm-sub').textContent = ''
  document.getElementById('pm-id-badge').textContent = '(auto-assigned on save)'
  document.getElementById('pm-delete-btn').style.display = 'none'
  pmResetForm()
  document.getElementById('product-modal-overlay').classList.add('open')
}

function openEditProductModal(productId) {
  const product = getProductById(productId)
  if (!product) return
  _editingProduct = product
  _pm_logoUrl = product.logo_url || null

  document.getElementById('pm-title').textContent = 'Edit product'
  document.getElementById('pm-sub').textContent = product.name
  document.getElementById('pm-id-badge').textContent = product.prd_uid || product.id
  document.getElementById('pm-delete-btn').style.display = ''

  // Populate form
  document.getElementById('pm-name').value        = product.name || ''
  document.getElementById('pm-category').value    = product.category || ''
  document.getElementById('pm-status').value      = product.status || 'active'
  document.getElementById('pm-description').value = product.description || ''
  document.getElementById('pm-currency').value    = product.currency || 'USD'
  document.getElementById('pm-price-min').value   = product.price_min != null ? product.price_min : ''
  document.getElementById('pm-price-max').value   = product.price_max != null ? product.price_max : ''

  // Logo preview
  pmRefreshLogoPreview()

  // Computed price line
  pmUpdatePriceComputed(product)

  // Links
  pmRenderLinks(Array.isArray(product.links) ? product.links : [])

  document.getElementById('product-modal-overlay').classList.add('open')
}

function closeProductModal() {
  document.getElementById('product-modal-overlay').classList.remove('open')
  _editingProduct = null
  _pm_logoUrl = null
}

function pmResetForm() {
  document.getElementById('pm-name').value        = ''
  document.getElementById('pm-category').value    = ''
  document.getElementById('pm-status').value      = 'active'
  document.getElementById('pm-description').value = ''
  document.getElementById('pm-currency').value    = 'USD'
  document.getElementById('pm-price-min').value   = ''
  document.getElementById('pm-price-max').value   = ''
  document.getElementById('pm-price-computed').textContent = 'Computed from active plans'
  pmRenderLinks([])
  pmRefreshLogoPreview()
}

function pmRefreshLogoPreview() {
  const el = document.getElementById('pm-logo-preview')
  if (_pm_logoUrl) {
    el.innerHTML = `<img src="${esc(_pm_logoUrl)}" alt="logo">`
  } else {
    el.innerHTML = '🖼'
  }
}

function pmUpdatePriceComputed(product) {
  const el = document.getElementById('pm-price-computed')
  const plans = (product.plans || []).filter(p => p.status === 'active' || !p.status)
  if (!plans.length) {
    el.textContent = 'No active plans yet'
    return
  }
  const amounts = plans.map(p => Number(p.amount)).filter(a => !isNaN(a) && a > 0)
  if (!amounts.length) { el.textContent = 'No amounts set on plans'; return }
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  const avg = (amounts.reduce((s, a) => s + a, 0) / amounts.length).toFixed(0)
  const cur = product.currency || plans[0]?.currency || ''
  el.textContent = `Computed from active plans · avg ${cur}${avg} · ${plans.length} plan${plans.length !== 1 ? 's' : ''} · range ${cur}${min}–${cur}${max}`
}

function pmUploadLogo() {
  document.getElementById('pm-logo-file').click()
}

async function pmHandleLogoFile(input) {
  const file = input.files[0]
  if (!file) return
  try {
    const url = await uploadVendorAvatar('product-logos', file)
    _pm_logoUrl = url
    pmRefreshLogoPreview()
  } catch (e) {
    // Fallback: use local object URL for preview, warn user
    _pm_logoUrl = URL.createObjectURL(file)
    pmRefreshLogoPreview()
    showToast('Upload failed — preview only. Save a URL manually.', 'warn')
  }
}

function pmPasteLogoUrl() {
  const url = prompt('Paste image URL:')
  if (!url) return
  _pm_logoUrl = url.trim()
  pmRefreshLogoPreview()
}

// Links
function pmRenderLinks(links) {
  const list = document.getElementById('pm-links-list')
  list.innerHTML = links.map((link, i) => `
    <div class="link-row" data-idx="${i}">
      <input type="text" class="fi link-row-label" value="${esc(link.label || '')}" placeholder="Label" data-field="label">
      <input type="url"  class="fi link-row-url"   value="${esc(link.url   || '')}" placeholder="https://…" data-field="url">
      <button class="link-row-rm" onclick="pmRemoveLink(${i})">✕</button>
    </div>`).join('')
}

function pmAddLink() {
  const links = pmGetLinks()
  links.push({ label: '', url: '' })
  pmRenderLinks(links)
}

function pmRemoveLink(idx) {
  const links = pmGetLinks()
  links.splice(idx, 1)
  pmRenderLinks(links)
}

function pmGetLinks() {
  const rows = document.querySelectorAll('#pm-links-list .link-row')
  return Array.from(rows).map(row => ({
    label: row.querySelector('[data-field="label"]').value.trim(),
    url:   row.querySelector('[data-field="url"]').value.trim(),
  })).filter(l => l.label || l.url)
}

async function pmSave() {
  const name = document.getElementById('pm-name').value.trim()
  if (!name) { showToast('Product name is required', 'warn'); return }

  const fields = {
    name,
    category:    document.getElementById('pm-category').value    || null,
    status:      document.getElementById('pm-status').value      || 'active',
    description: document.getElementById('pm-description').value.trim() || null,
    logo_url:    _pm_logoUrl || null,
    currency:    document.getElementById('pm-currency').value    || null,
    price_min:   parseFloat(document.getElementById('pm-price-min').value) || null,
    price_max:   parseFloat(document.getElementById('pm-price-max').value) || null,
    links:       pmGetLinks(),
  }

  try {
    if (_editingProduct) {
      await updateProductFull(_editingProduct.id, fields)
      showToast('Product saved', 'info')
    } else {
      await createProductFull(fields)
      showToast('Product created', 'info')
    }
    closeProductModal()
    _products = await getAllProductsWithPlans()
    renderStack()
  } catch (e) {
    console.error('[products] save product', e)
    showToast('Save failed: ' + e.message, 'error')
  }
}

async function pmDeleteProduct() {
  if (!_editingProduct) return
  const name = _editingProduct.name
  showConfirm(`Delete product "${name}"? This cannot be undone.`, async () => {
    try {
      await deleteProductFull(_editingProduct.id)
      showToast('Product deleted', 'info')
      closeProductModal()
      _products = await getAllProductsWithPlans()
      renderStack()
    } catch (e) {
      console.error('[products] delete product', e)
      showToast('Delete failed: ' + e.message, 'error')
    }
  })
}

// ─── PLAN MODAL ───────────────────────────────────────────────

function openNewPlanModal(productId) {
  const product = getProductById(productId)
  if (!product) return
  _editingPlan = null
  _editingPlanProductId = productId

  document.getElementById('plm-title').textContent = 'New plan'
  document.getElementById('plm-sub').textContent   = product.name
  document.getElementById('plm-uid-text').textContent = '(auto-assigned)'
  document.getElementById('plm-delete-btn').style.display = 'none'

  plmResetForm(product)
  document.getElementById('plan-modal-overlay').classList.add('open')
}

function openEditPlanModal(planId, productId) {
  const product = getProductById(productId)
  if (!product) return
  const plan = getPlanById(productId, planId)
  if (!plan) return

  _editingPlan = plan
  _editingPlanProductId = productId

  document.getElementById('plm-title').textContent = 'Edit plan'
  document.getElementById('plm-sub').textContent   = product.name + ' · ' + (plan.plan_type || plan.payment_type || '')
  document.getElementById('plm-uid-text').textContent = plan.plan_uid || plan.id
  document.getElementById('plm-delete-btn').style.display = ''

  document.getElementById('plm-type').value        = plan.payment_type || 'one-payment'
  document.getElementById('plm-status').value      = plan.status   || 'active'
  document.getElementById('plm-amount').value      = plan.amount   != null ? plan.amount : ''
  document.getElementById('plm-currency').value    = plan.currency || 'USD'
  document.getElementById('plm-description').value = plan.description || ''
  document.getElementById('plm-installments').value = plan.installments_count || ''
  plmUpdateTypeLabel()

  const source = normalizePlanSource(plan.link_source || plan.payment_rail || '')
  plmSetSource(source, true)
  document.getElementById('plm-link-id').value  = plan.link_id || plan.external_id || ''
  document.getElementById('plm-link-url').value = plan.link_url || plan.payment_link_url || ''

  document.getElementById('plan-modal-overlay').classList.add('open')
}

function closePlanModal() {
  document.getElementById('plan-modal-overlay').classList.remove('open')
  _editingPlan = null
  _editingPlanProductId = null
}

function plmResetForm(product) {
  document.getElementById('plm-type').value         = 'one-payment'
  document.getElementById('plm-installments').value = ''
  document.getElementById('plm-status').value       = 'active'
  document.getElementById('plm-amount').value       = ''
  document.getElementById('plm-currency').value     = product?.currency || 'USD'
  document.getElementById('plm-description').value  = ''
  document.getElementById('plm-link-id').value      = ''
  document.getElementById('plm-link-url').value     = ''
  plmSetSource('', true)
  plmUpdateTypeLabel()
}

function plmSetSource(source, silent) {
  const normalized = normalizePlanSource(source)
  document.querySelectorAll('.source-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.source === normalized)
  })
  const label = SOURCE_ID_LABELS[normalized] || 'ID'
  document.getElementById('plm-link-id-label').textContent = label
  if (!silent) {
    document.getElementById('plm-link-id').focus()
  }
}

function plmUpdateTypeLabel() {
  const type = document.getElementById('plm-type').value
  const wrap = document.getElementById('plm-installments-wrap')
  if (wrap) wrap.style.display = type === 'installments' ? '' : 'none'
}

function plmCopyLink() {
  if (!_editingPlan?.plan_uid) { showToast('No plan UID assigned yet', 'warn'); return }
  const url = window.location.origin + window.location.pathname + '?plan=' + _editingPlan.plan_uid
  navigator.clipboard.writeText(url).then(() => showToast('Deep link copied', 'info'))
    .catch(() => showToast('Copy failed', 'warn'))
}

async function plmSave() {
  const amount = parseFloat(document.getElementById('plm-amount').value)
  if (isNaN(amount) || amount <= 0) { showToast('Amount is required', 'warn'); return }

  const activePill = document.querySelector('.source-pill.active')
  const selectedPlanType = document.getElementById('plm-type').value || 'one-payment'
  const selectedInstallments = document.getElementById('plm-installments').value
  const legacyPayment = toLegacyPaymentFields(selectedPlanType, selectedInstallments)

  const fields = {
    product_id:        _editingPlanProductId,
    name:              selectedPlanType || 'Plan',
    plan_type:         selectedPlanType,
    status:            document.getElementById('plm-status').value   || 'active',
    amount,
    currency:          document.getElementById('plm-currency').value || 'USD',
    description:       document.getElementById('plm-description').value.trim() || null,
    link_source:       normalizePlanSource(activePill?.dataset.source) || null,
    link_id:           document.getElementById('plm-link-id').value.trim()  || null,
    link_url:          document.getElementById('plm-link-url').value.trim() || null,
    payment_type:      legacyPayment.payment_type,
    installments_count: legacyPayment.installments_count,
    payment_rail:      normalizePlanSource(activePill?.dataset.source) || null,
    payment_link_url:  document.getElementById('plm-link-url').value.trim() || null,
    external_id:       document.getElementById('plm-link-id').value.trim() || null,
  }

  try {
    if (_editingPlan) {
      await updatePlanFull(_editingPlan.id, fields)
      showToast('Plan saved', 'info')
    } else {
      await createPlanFull(fields)
      showToast('Plan created', 'info')
    }
    closePlanModal()
    _products = await getAllProductsWithPlans()
    renderStack()
  } catch (e) {
    console.error('[products] save plan', e)
    showToast('Save failed: ' + e.message, 'error')
  }
}

async function plmDelete() {
  if (!_editingPlan) return
  const planName = _editingPlan.name || 'this plan'
  showConfirm(`Delete plan "${planName}"? This cannot be undone.`, async () => {
    try {
      await deletePlanFull(_editingPlan.id)
      showToast('Plan deleted', 'info')
      closePlanModal()
      _products = await getAllProductsWithPlans()
      renderStack()
    } catch (e) {
      console.error('[products] delete plan', e)
      showToast('Delete failed: ' + e.message, 'error')
    }
  })
}

async function plmDuplicate() {
  if (!_editingPlan) return
  const original = _editingPlan
  const duplicatePlanType = original.payment_type || original.plan_type || 'one-payment'
  const legacyPayment = toLegacyPaymentFields(duplicatePlanType, original.installments_count)
  const fields = {
    product_id:       original.product_id,
    name:             original.name || duplicatePlanType || 'Plan',
    plan_type:        duplicatePlanType,
    status:           'draft',
    amount:           original.amount,
    currency:         original.currency,
    description:      original.description ? original.description + ' (copy)' : null,
    link_source:      normalizePlanSource(original.link_source || original.payment_rail) || null,
    link_id:          original.link_id     || original.external_id  || null,
    link_url:         original.link_url    || original.payment_link_url || null,
    payment_type:     legacyPayment.payment_type,
    installments_count: legacyPayment.installments_count,
    payment_rail:     normalizePlanSource(original.link_source || original.payment_rail) || null,
    payment_link_url: original.link_url    || original.payment_link_url || null,
    external_id:      original.link_id     || original.external_id  || null,
  }
  try {
    await createPlanFull(fields)
    showToast('Plan duplicated as draft', 'info')
    closePlanModal()
    _products = await getAllProductsWithPlans()
    renderStack()
  } catch (e) {
    console.error('[products] duplicate plan', e)
    showToast('Duplicate failed: ' + e.message, 'error')
  }
}

// ─── close overlays on backdrop click ─────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('product-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeProductModal()
  })
  document.getElementById('plan-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePlanModal()
  })
})
