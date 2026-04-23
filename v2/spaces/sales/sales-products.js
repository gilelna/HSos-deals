// v2/spaces/sales/sales-products.js — Products admin page + Panel handler.
// Grouped by program. Inline add/edit/archive for products and plans.
// Canonical plan fields: plan_type, link_url, link_source, link_id.

const SalesProducts = (() => {
  function render(mount) {
    const header = document.createElement('header')
    header.className = 'v2-page-header'
    const title = document.createElement('h1')
    title.textContent = 'Products'
    header.appendChild(title)

    const controls = document.createElement('div')
    controls.className = 'v2-page-controls'
    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-primary'
    addBtn.textContent = 'Add product'
    addBtn.addEventListener('click', _openAddProduct)
    controls.appendChild(addBtn)
    header.appendChild(controls)
    mount.appendChild(header)

    const body = document.createElement('div')
    body.className = 'v2-products-body'
    mount.appendChild(body)

    _paintList(body)
    State.on('sales.products', () => _paintList(body))
    State.on('sales.programs', () => _paintList(body))
  }

  function _paintList(container) {
    while (container.firstChild) container.removeChild(container.firstChild)
    const products = State.get('sales.products') || []
    const programs = State.get('sales.programs') || []
    const programById = new Map(programs.map(p => [p.id, p]))

    // Group by program (unassigned goes to "Other")
    const groups = new Map()
    for (const p of products) {
      const key = p.program_id || '_other'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(p)
    }

    if (!groups.size) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No products yet'
      container.appendChild(empty)
      return
    }

    for (const [programId, items] of groups) {
      const section = document.createElement('section')
      section.className = 'v2-product-group'
      const h = document.createElement('h2')
      h.className = 'v2-product-group-title'
      const progName = programId === '_other' ? 'Other' : (programById.get(programId)?.name || 'Other')
      h.textContent = `${progName} (${items.length})`
      section.appendChild(h)
      for (const p of items) section.appendChild(_productCard(p))
      container.appendChild(section)
    }
  }

  function _productCard(p) {
    const card = document.createElement('article')
    card.className = 'v2-product-card'
    card.dataset.id = p.id

    const head = document.createElement('header')
    head.className = 'v2-product-card-head'
    const name = document.createElement('button')
    name.type = 'button'
    name.className = 'v2-product-card-name'
    name.textContent = p.name
    name.addEventListener('click', () => Router.open({ entity: 'product', id: p.id }))
    head.appendChild(name)

    if (p.status && p.status !== 'active') {
      const badge = document.createElement('span')
      badge.className = `v2-pill v2-pill-grey`
      badge.textContent = p.status
      head.appendChild(badge)
    }

    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'btn btn-ghost btn-sm'
    editBtn.textContent = 'Edit'
    editBtn.addEventListener('click', () => _openEditProduct(p))
    head.appendChild(editBtn)

    card.appendChild(head)

    // Plans list
    const plans = (p.plans || []).filter(pl => pl.status !== 'archived')
    if (plans.length) {
      const list = document.createElement('ul')
      list.className = 'v2-plan-list'
      for (const pl of plans) list.appendChild(_planRow(p, pl))
      card.appendChild(list)
    }

    const addPlan = document.createElement('button')
    addPlan.type = 'button'
    addPlan.className = 'btn btn-ghost btn-sm'
    addPlan.textContent = '+ Add plan'
    addPlan.addEventListener('click', () => _openEditPlan(p, null))
    card.appendChild(addPlan)

    return card
  }

  function _planRow(product, plan) {
    const li = document.createElement('li')
    li.className = 'v2-plan-row'

    const name = document.createElement('div')
    name.className = 'v2-plan-name'
    name.textContent = plan.name || plan.plan_type || '(unnamed)'

    const meta = document.createElement('div')
    meta.className = 'v2-plan-meta'
    const price = Utils.formatCurrency(plan.amount, plan.currency)
    meta.textContent = [plan.plan_type, price, plan.link_source].filter(Boolean).join(' · ')

    const actions = document.createElement('div')
    actions.className = 'v2-plan-actions'
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'btn btn-ghost btn-sm'
    edit.textContent = 'Edit'
    edit.addEventListener('click', () => _openEditPlan(product, plan))
    actions.appendChild(edit)

    li.append(name, meta, actions)
    return li
  }

  // ─── Add/edit product ──────────────────────────────────────────
  function _openAddProduct() { _openEditProduct(null) }

  function _openEditProduct(product) {
    const isNew = !product
    const programs = State.get('sales.programs') || []
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())

    form.insertAdjacentHTML('beforeend', Form.input({ id: 'name', label: 'Name', required: true, value: product?.name || '' }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'description', label: 'Description', value: product?.description || '' }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'program_id', label: 'Program',
      options: [{ value: '', label: '— none —' }].concat(programs.map(p => ({ value: p.id, label: p.name }))),
      value: product?.program_id || ''
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'category', label: 'Category',
      options: [
        { value: 'Coaching program', label: 'Coaching program' },
        { value: 'Online course', label: 'Online course' },
        { value: 'Group coaching', label: 'Group coaching' },
        { value: 'Workshop', label: 'Workshop' },
        { value: 'Custom', label: 'Custom' }
      ],
      value: product?.category || 'Coaching program'
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'type', label: 'Type',
      options: [
        { value: 'PROGRAM', label: 'Program' },
        { value: 'PACKAGE', label: 'Package (session-based)' }
      ],
      value: product?.type || 'PROGRAM'
    }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'sessions_included', label: 'Sessions included (if Package)', type: 'number', value: product?.sessions_included ?? '' }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'currency', label: 'Currency',
      options: Const.CURRENCIES.map(c => ({ value: c, label: c })),
      value: product?.currency || 'USD'
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'status', label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'draft', label: 'Draft' },
        { value: 'archived', label: 'Archived' }
      ],
      value: product?.status || 'active'
    }))

    const actions = [
      { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
      { label: isNew ? 'Create' : 'Save', variant: 'primary', onClick: async () => {
        const { valid, errors, values } = Form.validate(form)
        if (!valid) { Form.showErrors(form, errors); return }
        const payload = {
          name: values.name,
          description: values.description || null,
          program_id: values.program_id || null,
          category: values.category,
          type: values.type,
          sessions_included: values.sessions_included === '' ? null : Number(values.sessions_included),
          currency: values.currency,
          status: values.status
        }
        try {
          if (isNew) {
            const created = await DB.createProduct(payload)
            created.plans = []
            const products = State.get('sales.products') || []
            State.set('sales.products', [created, ...products])
            Utils.showToast('Product created', 'success')
          } else {
            const updated = await DB.updateProduct(product.id, payload)
            updated.plans = product.plans || []
            const products = State.get('sales.products') || []
            State.set('sales.products', products.map(p => p.id === updated.id ? updated : p))
            Utils.showToast('Product saved', 'success')
          }
          m.close()
        } catch (err) {
          Utils.showToast(err.message || 'Save failed', 'error')
        }
      } }
    ]
    if (!isNew && Guard.action('product.edit')) {
      actions.splice(1, 0, {
        label: 'Delete', variant: 'ghost', onClick: () => {
          Utils.showConfirm(`Delete ${product.name}?`, async () => {
            try {
              await DB.deleteProduct(product.id)
              const products = State.get('sales.products') || []
              State.set('sales.products', products.filter(p => p.id !== product.id))
              m.close()
              Utils.showToast('Product deleted', 'success')
            } catch (err) { Utils.showToast(err.message || 'Delete failed', 'error') }
          }, { confirmLabel: 'Delete', danger: true })
        }
      })
    }

    const m = Modal.open({
      title: isNew ? 'New product' : `Edit ${product.name}`,
      size: 'md',
      body: form,
      actions
    })
  }

  // ─── Add/edit plan ─────────────────────────────────────────────
  function _openEditPlan(product, plan) {
    const isNew = !plan
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())

    form.insertAdjacentHTML('beforeend', Form.input({ id: 'name', label: 'Plan name', required: true, value: plan?.name || '' }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'plan_type', label: 'Plan type',
      options: Const.PLAN_TYPES.map(t => ({ value: t, label: t })),
      value: plan?.plan_type || 'One payment'
    }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'amount', label: 'Amount', type: 'number', required: true, value: plan?.amount ?? '', step: '0.01' }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'currency', label: 'Currency',
      options: Const.CURRENCIES.map(c => ({ value: c, label: c })),
      value: plan?.currency || product.currency || 'USD'
    }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'link_source', label: 'Payment link source',
      options: [
        { value: '', label: '— none —' },
        { value: 'ThriveCart', label: 'ThriveCart' },
        { value: 'Green Invoice', label: 'Green Invoice' },
        { value: 'Stripe', label: 'Stripe' },
        { value: 'PayPal', label: 'PayPal' },
        { value: 'Manual URL', label: 'Manual URL' }
      ],
      value: plan?.link_source || ''
    }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'link_url', label: 'Payment link URL', value: plan?.link_url || '' }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'link_id', label: 'Source-specific ID', value: plan?.link_id || '' }))
    form.insertAdjacentHTML('beforeend', Form.textarea({ id: 'description', label: 'Internal note', value: plan?.description || '', rows: 2 }))
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'status', label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'draft', label: 'Draft' },
        { value: 'archived', label: 'Archived' }
      ],
      value: plan?.status || 'active'
    }))

    const actions = [
      { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
      { label: isNew ? 'Create plan' : 'Save plan', variant: 'primary', onClick: async () => {
        const { valid, errors, values } = Form.validate(form)
        if (!valid) { Form.showErrors(form, errors); return }
        const payload = {
          product_id: product.id,
          name: values.name,
          plan_type: values.plan_type,
          amount: Number(values.amount),
          currency: values.currency,
          link_source: values.link_source || null,
          link_url: values.link_url || null,
          link_id: values.link_id || null,
          description: values.description || null,
          status: values.status
        }
        try {
          if (isNew) {
            const created = await DB.createPlan(payload)
            _updateProductInState(product.id, prod => ({ ...prod, plans: [...(prod.plans || []), created] }))
            Utils.showToast('Plan created', 'success')
          } else {
            const updated = await DB.updatePlan(plan.id, payload)
            _updateProductInState(product.id, prod => ({
              ...prod, plans: (prod.plans || []).map(p => p.id === updated.id ? updated : p)
            }))
            Utils.showToast('Plan saved', 'success')
          }
          m.close()
        } catch (err) {
          Utils.showToast(err.message || 'Save failed', 'error')
        }
      } }
    ]
    if (!isNew) {
      actions.splice(1, 0, {
        label: 'Delete', variant: 'ghost', onClick: () => {
          Utils.showConfirm(`Delete plan "${plan.name}"?`, async () => {
            try {
              await DB.deletePlan(plan.id)
              _updateProductInState(product.id, prod => ({
                ...prod, plans: (prod.plans || []).filter(p => p.id !== plan.id)
              }))
              m.close()
              Utils.showToast('Plan deleted', 'success')
            } catch (err) { Utils.showToast(err.message || 'Delete failed', 'error') }
          }, { confirmLabel: 'Delete', danger: true })
        }
      })
    }

    const m = Modal.open({
      title: isNew ? `New plan for ${product.name}` : `Edit plan — ${plan.name}`,
      size: 'md',
      body: form,
      actions
    })
  }

  function _updateProductInState(productId, fn) {
    const products = State.get('sales.products') || []
    State.set('sales.products', products.map(p => p.id === productId ? fn(p) : p))
  }

  // ─── Panel handler ─────────────────────────────────────────────
  const panelHandler = {
    async load(id) {
      const products = State.get('sales.products') || []
      const local = products.find(p => p.id === id)
      if (local) return local
      const fresh = await DB.getAllProductsWithPlans()
      State.set('sales.products', fresh)
      return fresh.find(p => p.id === id) || null
    },
    render(entity, ctx) {
      const programs = State.get('sales.programs') || []
      const prog = programs.find(p => p.id === entity.program_id)
      return {
        title: entity.name,
        subtitle: prog?.name || '—',
        tabs: [
          { label: 'Overview', content: _productOverview(entity) },
          { label: 'Plans', content: _productPlans(entity) }
        ]
      }
    }
  }

  function _productOverview(p) {
    const wrap = document.createElement('div')
    const fields = [
      ['Description', p.description],
      ['Category', p.category],
      ['Type', p.type],
      ['Sessions included', p.sessions_included],
      ['Currency', p.currency],
      ['Status', p.status]
    ]
    for (const [label, value] of fields) {
      const row = document.createElement('div')
      row.className = 'v2-panel-field'
      const l = document.createElement('div')
      l.className = 'v2-panel-field-label'
      l.textContent = label
      const v = document.createElement('div')
      v.className = 'v2-panel-field-value'
      v.textContent = value || '—'
      row.append(l, v)
      wrap.appendChild(row)
    }
    return wrap
  }

  function _productPlans(p) {
    const wrap = document.createElement('div')
    const plans = (p.plans || [])
    if (!plans.length) { wrap.textContent = 'No plans.'; return wrap }
    const list = document.createElement('ul')
    list.className = 'v2-panel-list'
    for (const pl of plans) {
      const li = document.createElement('li')
      li.textContent = `${pl.name || pl.plan_type} — ${Utils.formatCurrency(pl.amount, pl.currency)} (${pl.status})`
      list.appendChild(li)
    }
    wrap.appendChild(list)
    return wrap
  }

  return { render, panelHandler }
})()

window.SalesProducts = SalesProducts
