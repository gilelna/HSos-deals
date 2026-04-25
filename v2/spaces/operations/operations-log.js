// v2/spaces/operations/operations-log.js — Log session tab.
// Client picker (vendor's assigned clients) + form (date, duration, rate, notes).
// Recent sessions list below.

const OpsLog = (() => {
  function render(mount) {
    const vendor = State.get('ops.vendor')
    const clients = State.get('ops.clients') || []
    const rates = State.get('ops.rates') || []

    if (!clients.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No clients assigned to this vendor yet. Ask an admin to assign clients before logging sessions.'
      mount.appendChild(empty)
      return
    }

    const wrap = document.createElement('div')
    wrap.className = 'v2-ops-log'

    const formWrap = document.createElement('div')
    formWrap.className = 'v2-ops-log-form'

    let selectedClientId = clients[0].id

    // Client picker (button grid; mobile-friendlier than a dropdown)
    const clientGrid = document.createElement('div')
    clientGrid.className = 'v2-ops-client-grid'
    for (const c of clients) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'v2-ops-client-btn'
      b.dataset.id = c.id
      b.textContent = c.full_name || c.id
      if (c.id === selectedClientId) b.classList.add('v2-selected')
      b.addEventListener('click', () => {
        selectedClientId = c.id
        for (const btn of clientGrid.querySelectorAll('.v2-ops-client-btn')) {
          btn.classList.toggle('v2-selected', btn.dataset.id === c.id)
        }
      })
      clientGrid.appendChild(b)
    }
    formWrap.appendChild(_labeled('Client', clientGrid))

    const form = document.createElement('form')
    form.noValidate = true
    form.addEventListener('submit', e => e.preventDefault())

    const today = new Date().toISOString().slice(0, 10)
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'session_date', label: 'Date', type: 'date', value: today, required: true }))
    form.insertAdjacentHTML('beforeend', Form.input({ id: 'duration_min', label: 'Duration (minutes)', type: 'number', value: '60', required: true, min: '1', step: '1' }))

    const defaultRate = rates.find(r => r.is_default) || null
    const rateOptions = [
      { value: '', label: 'No rate' },
      ...rates.map(r => ({ value: r.id, label: _rateLabel(r) }))
    ]
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'rate_id',
      label: 'Rate',
      options: rateOptions,
      value: defaultRate ? defaultRate.id : ''
    }))

    form.insertAdjacentHTML('beforeend', Form.textarea({ id: 'notes', label: 'Notes', rows: 3 }))

    const submit = document.createElement('button')
    submit.type = 'button'
    submit.className = 'btn btn-primary'
    submit.textContent = 'Log session'
    submit.addEventListener('click', () => _submit(form, selectedClientId, vendor, rates, mount))
    form.appendChild(submit)
    formWrap.appendChild(form)

    wrap.appendChild(formWrap)

    // Recent sessions
    const recent = document.createElement('div')
    recent.className = 'v2-ops-log-recent'
    _paintRecent(recent)
    wrap.appendChild(recent)

    mount.appendChild(wrap)
  }

  async function _submit(form, clientId, vendor, rates, mount) {
    const { valid, errors, values } = Form.validate(form)
    if (!valid) { Form.showErrors(form, errors); return }
    if (!clientId) { Utils.showToast('Pick a client', 'warn'); return }
    const duration_min = Number(values.duration_min)
    if (!Number.isFinite(duration_min) || duration_min <= 0) {
      Utils.showToast('Duration must be a positive number', 'warn'); return
    }

    // Rate: optional. If selected, rate_usd = (amount / 60) * duration_min.
    // If "No rate" picked, rate_id and rate_usd are both null.
    const rateId = values.rate_id || null
    let rate_usd = null
    if (rateId) {
      const r = rates.find(x => x.id === rateId)
      const amt = r ? Number(r.amount ?? r.rate) : NaN
      if (Number.isFinite(amt)) rate_usd = (amt / 60) * duration_min
    }

    const payload = {
      vendor_id: vendor.id,
      client_id: clientId,
      session_date: values.session_date,
      duration_min,
      hours: Number((duration_min / 60).toFixed(2)),
      rate_id: rateId,
      rate_usd,
      notes: values.notes || null,
      status: 'done',
      billed: false
    }

    try {
      await DB.createSession(payload)
      Utils.showToast('Session logged', 'success')
      await OpsInit.refresh()
      // Re-render the Log tab — this is the user's current view.
      while (mount.firstChild) mount.removeChild(mount.firstChild)
      render(mount)
    } catch (err) {
      Utils.showToast(err.message || 'Failed to log session', 'error')
    }
  }

  function _paintRecent(container) {
    const sessions = (State.get('ops.sessions') || []).slice().sort(_byDateDesc).slice(0, 10)
    const clients = State.get('ops.clients') || []
    const rates = State.get('ops.rates') || []
    const taskTypes = State.get('ops.taskTypes') || []
    const clientById = new Map(clients.map(c => [c.id, c]))
    const rateById = new Map(rates.map(r => [r.id, r]))
    const ttById = new Map(taskTypes.map(t => [t.id, t]))

    const h = document.createElement('h2')
    h.className = 'v2-ops-recent-title'
    h.textContent = 'Recent sessions'
    container.appendChild(h)

    if (!sessions.length) {
      const empty = document.createElement('div')
      empty.className = 'v2-empty'
      empty.textContent = 'No sessions yet.'
      container.appendChild(empty)
      return
    }

    const tblMount = document.createElement('div')
    container.appendChild(tblMount)
    Table.create({
      container: tblMount,
      columns: [
        { key: 'session_date', label: 'Date', render: s => Utils.formatDate(s.session_date) },
        { key: '_client',      label: 'Client' },
        { key: '_rate',        label: 'Rate' },
        { key: 'duration_min', label: 'Minutes' },
        { key: 'billed',       label: 'Billed', raw: true, render: s => s.billed ? Badges.make('Billed', { color: 'green' }) : Badges.make('Unbilled', { color: 'amber' }) }
      ],
      // Display: prefer the new rate_id (rates table) name; fall back to legacy
      // task_type_id name for historical rows logged before the refactor.
      rows: sessions.map(s => ({
        ...s,
        _client: clientById.get(s.client_id)?.full_name || '(unknown)',
        _rate: rateById.get(s.rate_id)?.name || ttById.get(s.task_type_id)?.name || '—'
      })),
      exportFilename: 'recent-sessions.csv',
      pageSize: 25
    })
  }

  function _byDateDesc(a, b) {
    const ad = new Date(a.session_date).getTime()
    const bd = new Date(b.session_date).getTime()
    return bd - ad
  }

  function _rateLabel(r) {
    const amt = Number(r.amount ?? r.rate)
    const cur = r.currency || 'USD'
    const sym = cur === 'USD' ? '$' : (cur === 'EUR' ? '€' : (cur === 'ILS' ? '₪' : ''))
    const amtTxt = Number.isFinite(amt) ? `${sym}${amt}/hr` : ''
    return `${r.name || 'Rate'}${amtTxt ? ` — ${amtTxt}` : ''}`
  }

  function _labeled(label, control) {
    const wrap = document.createElement('div')
    wrap.className = 'fg'
    const lbl = document.createElement('label')
    lbl.className = 'fl'
    lbl.textContent = label
    wrap.append(lbl, control)
    return wrap
  }

  return { render }
})()

window.OpsLog = OpsLog
