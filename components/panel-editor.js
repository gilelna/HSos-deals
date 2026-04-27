// components/panel-editor.js — inline-edit framework for entity side panels.
//
// Public API:
//   window.PanelEditor.field({
//     container,    // DOM node to mount into
//     label,        // visible label (e.g. "Amount")
//     value,        // current value
//     type,         // 'text' | 'email' | 'money' | 'date' | 'select' | 'textarea'
//     saveMode,     // 'blur' | 'explicit'
//     options,      // for select: [{value,label}]
//     format,       // optional (value) => string for read-mode display
//     onSave,       // async (newValue) => updatedEntity. Throws on failure.
//     currency,     // for type='money' (defaults to USD)
//   })
;(function (global) {
  'use strict'

  function defaultFormat(value, type, currency) {
    if (value == null || value === '') return '—'
    if (type === 'money') {
      const n = Number(value)
      if (Number.isNaN(n)) return '—'
      const cur = (currency || 'USD').toUpperCase()
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n)
      } catch (_) { return cur + ' ' + n.toFixed(2) }
    }
    if (type === 'date') {
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return '—'
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    }
    return String(value)
  }

  function buildEditor(type, value, options) {
    if (type === 'textarea') {
      const ta = document.createElement('textarea')
      ta.className = 'pe-input pe-textarea'
      ta.value = value == null ? '' : String(value)
      ta.rows = 4
      return ta
    }
    if (type === 'select') {
      const sel = document.createElement('select')
      sel.className = 'pe-input'
      const opts = Array.isArray(options) ? options : []
      opts.forEach(o => {
        const opt = document.createElement('option')
        opt.value = o.value
        opt.textContent = o.label != null ? o.label : o.value
        sel.appendChild(opt)
      })
      if (value != null) sel.value = String(value)
      return sel
    }
    const input = document.createElement('input')
    input.className = 'pe-input'
    if (type === 'money')      input.type = 'number'
    else if (type === 'date')  input.type = 'date'
    else if (type === 'email') input.type = 'email'
    else                       input.type = 'text'
    if (type === 'money') input.step = '0.01'
    input.value = value == null ? '' : String(value)
    return input
  }

  function readEditorValue(editor, type) {
    if (type === 'money') {
      const v = editor.value
      if (v === '' || v == null) return null
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    }
    // Empty string isn't a valid value for date or for nullable FK selects —
    // Postgres rejects '' for date columns and treats '' as a missing match
    // for uuid/text FKs. Normalize to null so the DB sees a clear "unset".
    if (type === 'date' || type === 'select') {
      return editor.value === '' ? null : editor.value
    }
    return editor.value
  }

  function field(opts) {
    const { container, label, value, type, saveMode, onSave, options, format, currency } = opts
    if (!container) throw new Error('PanelEditor.field: container required')
    if (!type) throw new Error('PanelEditor.field: type required')
    if (saveMode !== 'blur' && saveMode !== 'explicit') {
      throw new Error('PanelEditor.field: saveMode must be "blur" or "explicit"')
    }

    let currentValue = value
    let editing = false
    let saving = false

    const wrapper = document.createElement('div'); wrapper.className = 'pe-field'
    const labelEl = document.createElement('div'); labelEl.className = 'pe-field-label'; labelEl.textContent = label
    const display = document.createElement('div'); display.className = 'pe-field-display'
    display.textContent = (format || defaultFormat)(currentValue, type, currency)

    const editorWrap = document.createElement('div'); editorWrap.className = 'pe-field-editor'; editorWrap.style.display = 'none'
    const editor = buildEditor(type, currentValue, options)
    const saveBtn = document.createElement('button')
    saveBtn.type = 'button'; saveBtn.className = 'pe-save-btn'; saveBtn.textContent = 'Save'; saveBtn.style.display = 'none'
    const status = document.createElement('span'); status.className = 'pe-field-status'

    editorWrap.appendChild(editor)
    if (saveMode === 'explicit') editorWrap.appendChild(saveBtn)
    editorWrap.appendChild(status)
    wrapper.appendChild(labelEl); wrapper.appendChild(display); wrapper.appendChild(editorWrap)
    container.appendChild(wrapper)

    function enterEdit() {
      if (editing || saving) return
      editing = true
      display.style.display = 'none'
      editorWrap.style.display = ''
      if (type === 'select') editor.value = currentValue == null ? '' : String(currentValue)
      else editor.value = currentValue == null ? '' : String(currentValue)
      editor.focus()
      if (editor.select) editor.select()
    }

    function exitEdit() {
      editing = false
      display.textContent = (format || defaultFormat)(currentValue, type, currency)
      display.style.display = ''
      editorWrap.style.display = 'none'
      saveBtn.style.display = 'none'
      status.textContent = ''
      status.className = 'pe-field-status'
    }

    async function commit() {
      if (saving) return
      const next = readEditorValue(editor, type)
      if (next === currentValue) { exitEdit(); return }
      saving = true
      status.textContent = '…'
      status.className = 'pe-field-status pe-saving'
      try {
        const updated = await onSave(next)
        currentValue = next
        saving = false
        status.textContent = '✓'
        status.className = 'pe-field-status pe-saved'
        if (typeof global.showToast === 'function') global.showToast('Saved', 'success')
        setTimeout(exitEdit, 600)
        return updated
      } catch (err) {
        console.error('[panel-editor] save failed', err)
        saving = false
        status.textContent = ''
        status.className = 'pe-field-status'
        if (typeof global.showToast === 'function') global.showToast('Could not save', 'error')
      }
    }

    display.addEventListener('click', enterEdit)

    if (saveMode === 'blur') {
      editor.addEventListener('blur', () => { if (editing) commit() })
    } else {
      editor.addEventListener('input', () => { if (editing) saveBtn.style.display = '' })
      saveBtn.addEventListener('click', e => { e.preventDefault(); commit() })
      editor.addEventListener('blur', e => {
        if (e.relatedTarget === saveBtn) return
        exitEdit()
      })
    }

    editor.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); exitEdit() }
      if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); commit() }
    })

    return {
      refresh(newValue) {
        currentValue = newValue
        if (!editing) display.textContent = (format || defaultFormat)(currentValue, type, currency)
      },
    }
  }

  global.PanelEditor = { field }
})(typeof window !== 'undefined' ? window : globalThis)
