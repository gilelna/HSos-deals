// v2/spaces/operations/operations-log.js — Log session tab.
// Client picker (vendor's assigned clients) + form (date, duration, task type, notes).
// Recent sessions list below.

const OpsLog = (() => {
  function render(mount) {
    const vendor = State.get('ops.vendor')
    const clients = State.get('ops.clients') || []
    const taskTypes = State.get('ops.taskTypes') || []

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
    form.insertAdjacentHTML('beforeend', Form.select({
      id: 'task_type_id', label: 'Task type', required: true,
      options: taskTypes.map(t => ({ value: t.id, label: t.name }))
    }))
    form.insertAdjacentHTML('beforeend', Form.textarea({ id: 'notes', label: 'Notes', rows: 3 }))

    const submit = document.createElement('button')
    submit.type = 'button'
    submit.className = 'btn btn-primary'
    submit.textContent = 'Log session'
    submit.addEventListener('click', () => _submit(form, selectedClientId, vendor, taskTypes, mount))
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

  async function _submit(form, clientId, vendor, taskTypes, mount) {
    const { valid, errors, values } = Form.validate(form)
    if (!valid) { Form.showErrors(form, errors); return }
    if (!clientId) { Utils.showToast('Pick a client', 'warn'); return }
    const duration_min = Number(values.duration_min)
    if (!Number.isFinite(duration_min) || duration_min <= 0) {
      Utils.showToast('Duration must be a positive number', 'warn'); return
    }

    // Rate comes from the chosen task_type (each task_type row carries its own
    // rate_usd). The legacy `rates` table keys on session_type, not task_type,
    // and is not consulted at log time.
    let rate_usd = null
    const tt = taskTypes.find(t => t.id === values.task_type_id)
    if (tt && Number.isFinite(Number(tt.rate_usd))) {
      rate_usd = Number(tt.rate_usd) * (duration_min / 60) || null
    }

    const payload = {
      vendor_id: vendor.id,
      client_id: clientId,
      session_date: values.session_date,
      duration_min,
      hours: Number((duration_min / 60).toFixed(2)),
      task_type_id: values.task_type_id,
      notes: values.notes || null,
      status: 'done',
      billed: false,
      rate_usd
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
    const taskTypes = State.get('ops.taskTypes') || []
    const clientById = new Map(clients.map(c => [c.id, c]))
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
        { key: '_task',        label: 'Task' },
        { key: 'duration_min', label: 'Minutes' },
        { key: 'billed',       label: 'Billed', raw: true, render: s => s.billed ? Badges.make('Billed', { color: 'green' }) : Badges.make('Unbilled', { color: 'amber' }) }
      ],
      rows: sessions.map(s => ({
        ...s,
        _client: clientById.get(s.client_id)?.full_name || '(unknown)',
        _task: ttById.get(s.task_type_id)?.name || '(unknown)'
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
