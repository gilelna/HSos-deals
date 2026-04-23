// v2/spaces/payments/payments-registry.js — Master data CRUD.
// Sub-tabs: Companies | Accounts | Exchange rates | Categories | Tags | Settings.
// Each sub-tab is driven by a small config (columns + form fields).

const PayRegistry = (() => {
  const SUBS = [
    { key: 'companies',  label: 'Companies' },
    { key: 'accounts',   label: 'Accounts' },
    { key: 'fx',         label: 'Exchange rates' },
    { key: 'categories', label: 'Categories' },
    { key: 'tags',       label: 'Tags' },
    { key: 'settings',   label: 'Settings' }
  ]

  function render(mount) {
    const wrap = document.createElement('div')
    wrap.className = 'v2-pay-registry'
    mount.appendChild(wrap)

    const tabBar = document.createElement('nav')
    tabBar.className = 'v2-subtabs'
    wrap.appendChild(tabBar)

    let active = 'companies'
    for (const s of SUBS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'v2-tab'
      b.dataset.sub = s.key
      b.textContent = s.label
      b.addEventListener('click', () => { active = s.key; _swap(active, tabBar, body) })
      tabBar.appendChild(b)
    }

    const body = document.createElement('div')
    body.className = 'v2-pay-registry-body'
    wrap.appendChild(body)

    _swap(active, tabBar, body)
  }

  function _swap(active, tabBar, body) {
    for (const b of tabBar.querySelectorAll('.v2-tab')) {
      b.classList.toggle('v2-tab-active', b.dataset.sub === active)
    }
    while (body.firstChild) body.removeChild(body.firstChild)
    if (active === 'companies')  _renderCompanies(body)
    if (active === 'accounts')   _renderAccounts(body)
    if (active === 'fx')         _renderFx(body)
    if (active === 'categories') _renderCategories(body)
    if (active === 'tags')       _renderTags(body)
    if (active === 'settings')   _renderSettings(body)
  }

  // ─── Companies ─────────────────────────────────────────────────
  // Real DB columns: name, currency, entity_type, status, notes. No country,
  // no vat_number, no active boolean.
  function _renderCompanies(mount) {
    _renderCrud(mount, {
      entity: 'Company',
      load: () => DB.getCompanies(),
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'currency', label: 'Currency' },
        { key: 'entity_type', label: 'Entity type' },
        { key: 'status', label: 'Status' }
      ],
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'currency', label: 'Currency', type: 'select', options: Const.CURRENCIES.map(c => ({ value: c, label: c })) },
        { id: 'entity_type', label: 'Entity type', type: 'text' },
        { id: 'status', label: 'Status', type: 'select', options: [
          { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }
        ] },
        { id: 'notes', label: 'Notes', type: 'textarea', rows: 2 }
      ],
      create: DB.createCompany,
      update: DB.updateCompany,
      remove: DB.deleteCompany,
      afterWrite: async () => { await PaymentsInit.reloadLookups() }
    })
  }

  // ─── Accounts ──────────────────────────────────────────────────
  // Real DB columns: name, provider, account_type, currency, company_id,
  // is_active, notes. (Not: active/type/institution.)
  function _renderAccounts(mount) {
    _renderCrud(mount, {
      entity: 'Account',
      load: () => DB.getAllAccounts(),
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'account_type', label: 'Type' },
        { key: 'currency', label: 'Currency' },
        { key: 'provider', label: 'Provider' },
        { key: 'is_active', label: 'Active', render: r => r.is_active ? '✓' : '' }
      ],
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'account_type', label: 'Type', type: 'text' },
        { id: 'currency', label: 'Currency', type: 'select', options: Const.CURRENCIES.map(c => ({ value: c, label: c })) },
        { id: 'provider', label: 'Provider', type: 'text' },
        { id: 'is_active', label: 'Active', type: 'checkbox' }
      ],
      create: DB.createAccount,
      update: DB.updateAccount,
      remove: DB.deleteAccount,
      afterWrite: async () => { await PaymentsInit.reloadLookups() }
    })
  }

  // ─── Exchange rates ───────────────────────────────────────────
  // Real DB columns: month (date), from_currency, to_currency, rate, source.
  function _renderFx(mount) {
    _renderCrud(mount, {
      entity: 'Exchange rate',
      load: () => DB.getExchangeRates(),
      columns: [
        { key: 'from_currency', label: 'From' },
        { key: 'to_currency',   label: 'To' },
        { key: 'rate',          label: 'Rate' },
        { key: 'month',         label: 'Month', render: r => Utils.formatDate(r.month) }
      ],
      fields: [
        { id: 'from_currency', label: 'From', type: 'select', required: true, options: Const.CURRENCIES.map(c => ({ value: c, label: c })) },
        { id: 'to_currency',   label: 'To',   type: 'select', required: true, options: Const.CURRENCIES.map(c => ({ value: c, label: c })) },
        { id: 'rate',          label: 'Rate', type: 'number', required: true, step: '0.000001' },
        { id: 'month',         label: 'Month (any date in the month)', type: 'date', required: true }
      ],
      create: DB.upsertExchangeRate,
      update: (id, fields) => DB.upsertExchangeRate({ ...fields, id }),
      remove: null
    })
  }

  // ─── Categories ───────────────────────────────────────────────
  // Real DB columns: id, name, match_patterns, hebrew, tax_category, status, notes.
  // No `type` column; categories don't distinguish income/expense at this level.
  function _renderCategories(mount) {
    _renderCrud(mount, {
      entity: 'Category',
      load: () => DB.getTransactionCategories({ includeInactive: true }),
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'hebrew', label: 'Hebrew' },
        { key: 'tax_category', label: 'Tax category' },
        { key: 'status', label: 'Status' }
      ],
      fields: [
        { id: 'id', label: 'ID (slug)', type: 'text', required: true, hint: 'e.g. ca_software' },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'hebrew', label: 'Hebrew label', type: 'text' },
        { id: 'tax_category', label: 'Default tax category', type: 'select', options: [
          { value: '', label: '— none —' }
        ].concat(Const.TAX_TREATMENTS.map(t => ({ value: t, label: Const.TAX_TREATMENT_LABELS[t] }))) },
        { id: 'status', label: 'Status', type: 'select', options: [
          { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }
        ] }
      ],
      create: DB.createTransactionCategory,
      update: DB.updateTransactionCategory,
      remove: DB.deleteTransactionCategory,
      afterWrite: async () => { await PaymentsInit.reloadLookups() }
    })
  }

  // ─── Tags ─────────────────────────────────────────────────────
  // Real DB columns: id, name, status, notes, created_at. No color, no
  // active-boolean — status text drives visibility.
  function _renderTags(mount) {
    _renderCrud(mount, {
      entity: 'Tag',
      load: () => DB.getTransactionTags({ includeInactive: true }),
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' }
      ],
      fields: [
        { id: 'id', label: 'ID (slug)', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'status', label: 'Status', type: 'select', options: [
          { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }
        ] },
        { id: 'notes', label: 'Notes', type: 'textarea', rows: 2 }
      ],
      create: DB.createTransactionTag,
      update: DB.updateTransactionTag,
      remove: DB.deleteTransactionTag,
      afterWrite: async () => { await PaymentsInit.reloadLookups() }
    })
  }

  // ─── Settings ─────────────────────────────────────────────────
  function _renderSettings(mount) {
    const loading = document.createElement('div')
    loading.className = 'v2-empty'
    loading.textContent = 'Loading settings…'
    mount.appendChild(loading)

    DB.getSystemSettings().then(rows => {
      loading.remove()
      const header = document.createElement('div')
      header.className = 'v2-page-subheader'
      const h = document.createElement('h2')
      h.textContent = 'System settings'
      header.appendChild(h)
      const add = document.createElement('button')
      add.type = 'button'
      add.className = 'btn btn-primary'
      add.textContent = 'Add / update key'
      add.addEventListener('click', () => _openSettingEditor(null, () => _renderSettings(_swapParent(mount))))
      header.appendChild(add)
      mount.appendChild(header)

      if (!rows.length) {
        const empty = document.createElement('div')
        empty.className = 'v2-empty'
        empty.textContent = 'No settings configured.'
        mount.appendChild(empty)
        return
      }

      const tblMount = document.createElement('div')
      mount.appendChild(tblMount)
      Table.create({
        container: tblMount,
        columns: [
          { key: 'key', label: 'Key' },
          { key: 'value', label: 'Value' },
          { key: 'updated_at', label: 'Updated', render: r => Utils.formatDate(r.updated_at) }
        ],
        rows,
        onRowClick: r => _openSettingEditor(r, () => _renderSettings(_swapParent(mount))),
        exportFilename: 'system-settings.csv',
        pageSize: 50
      })
    }).catch(err => {
      loading.textContent = err.message || 'Failed to load'
    })
  }

  function _openSettingEditor(existing, after) {
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'key', label: 'Key', required: true, value: existing?.key || '', readonly: !!existing }))
    form.insertAdjacentHTML('beforeend', Form.textarea({ id: 'value', label: 'Value', rows: 3, value: existing?.value || '' }))

    const m = Modal.open({
      title: existing ? `Edit setting: ${existing.key}` : 'Add setting',
      size: 'md',
      body: form,
      actions: [
        { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
        { label: 'Save', variant: 'primary', onClick: async () => {
          const { valid, errors, values } = Form.validate(form)
          if (!valid) { Form.showErrors(form, errors); return }
          try {
            await DB.upsertSystemSetting(values.key, values.value)
            m.close()
            Utils.showToast('Saved', 'success')
            after && after()
          } catch (err) {
            Utils.showToast(err.message || 'Save failed', 'error')
          }
        } }
      ]
    })
  }

  function _swapParent(el) {
    // Clear + return same node so renderers can re-paint in place
    while (el.firstChild) el.removeChild(el.firstChild)
    return el
  }

  // ─── Generic CRUD renderer ────────────────────────────────────
  function _renderCrud(mount, cfg) {
    const header = document.createElement('div')
    header.className = 'v2-page-subheader'
    const h = document.createElement('h2')
    h.textContent = cfg.entity + 's'
    header.appendChild(h)

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn-primary'
    addBtn.textContent = `Add ${cfg.entity.toLowerCase()}`
    addBtn.addEventListener('click', () => _openCrudForm(null, cfg, () => _reload()))
    header.appendChild(addBtn)
    mount.appendChild(header)

    const body = document.createElement('div')
    body.className = 'v2-pay-registry-table'
    mount.appendChild(body)

    async function _reload() {
      while (body.firstChild) body.removeChild(body.firstChild)
      const loading = document.createElement('div')
      loading.className = 'v2-empty'
      loading.textContent = 'Loading…'
      body.appendChild(loading)
      try {
        const rows = await cfg.load()
        loading.remove()
        if (!rows.length) {
          const empty = document.createElement('div')
          empty.className = 'v2-empty'
          empty.textContent = `No ${cfg.entity.toLowerCase()}s yet.`
          body.appendChild(empty)
          return
        }
        Table.create({
          container: body,
          columns: cfg.columns,
          rows,
          onRowClick: r => _openCrudForm(r, cfg, _reload),
          exportFilename: `${cfg.entity.toLowerCase()}.csv`,
          pageSize: 50
        })
      } catch (err) {
        loading.textContent = err.message || 'Failed to load'
      }
    }
    _reload()
  }

  function _openCrudForm(existing, cfg, after) {
    const isNew = !existing
    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())

    for (const f of cfg.fields) {
      if (f.type === 'checkbox') {
        form.insertAdjacentHTML('beforeend', Form.checkbox({
          id: f.id, label: f.label, checked: !!existing?.[f.id], hint: f.hint
        }))
      } else if (f.type === 'select') {
        form.insertAdjacentHTML('beforeend', Form.select({
          id: f.id, label: f.label, required: !!f.required,
          options: f.options, value: existing?.[f.id] ?? '', hint: f.hint
        }))
      } else if (f.type === 'textarea') {
        form.insertAdjacentHTML('beforeend', Form.textarea({
          id: f.id, label: f.label, required: !!f.required,
          value: existing?.[f.id] ?? '', rows: f.rows || 3, hint: f.hint
        }))
      } else {
        form.insertAdjacentHTML('beforeend', Form.input({
          id: f.id, label: f.label, type: f.type || 'text',
          required: !!f.required, value: existing?.[f.id] ?? '',
          step: f.step, min: f.min, max: f.max, hint: f.hint,
          readonly: !!(f.readonlyOnEdit && !isNew)
        }))
      }
    }

    const actions = [
      { label: 'Cancel', variant: 'ghost', onClick: () => m.close() },
      { label: isNew ? 'Create' : 'Save', variant: 'primary', onClick: async () => {
        const { valid, errors, values } = Form.validate(form)
        if (!valid) { Form.showErrors(form, errors); return }
        const payload = {}
        for (const f of cfg.fields) {
          const v = values[f.id]
          if (f.type === 'checkbox') payload[f.id] = !!v
          else if (f.type === 'number') payload[f.id] = v === '' ? null : Number(v)
          else payload[f.id] = v === '' ? null : v
        }
        try {
          if (isNew) await cfg.create(payload)
          else await cfg.update(existing.id || existing.key, payload)
          if (cfg.afterWrite) await cfg.afterWrite()
          m.close()
          Utils.showToast('Saved', 'success')
          after && after()
        } catch (err) {
          Utils.showToast(err.message || 'Save failed', 'error')
        }
      } }
    ]
    if (!isNew && cfg.remove) {
      actions.splice(1, 0, {
        label: 'Delete', variant: 'ghost', onClick: () => {
          Utils.showConfirm(`Delete this ${cfg.entity.toLowerCase()}?`, async () => {
            try {
              await cfg.remove(existing.id || existing.key)
              if (cfg.afterWrite) await cfg.afterWrite()
              m.close()
              Utils.showToast('Deleted', 'success')
              after && after()
            } catch (err) { Utils.showToast(err.message || 'Delete failed', 'error') }
          }, { confirmLabel: 'Delete', danger: true })
        }
      })
    }

    const m = Modal.open({
      title: isNew ? `New ${cfg.entity.toLowerCase()}` : `Edit ${cfg.entity.toLowerCase()}`,
      size: 'md',
      body: form,
      actions
    })
  }

  return { render }
})()

window.PayRegistry = PayRegistry
