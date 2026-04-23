// v2/components/form.js — Form field builders + validation.
// Builders return HTML strings (escaped), so callers can concatenate into
// larger templates. validate() reads a <form> DOM element and returns
// { valid, errors:[{id,label,message}] }. No submit handling — callers own it.
// Deps: Utils.

const Form = (() => {
  // Shared shell: .fg (group) > .fl (label) + .fi (input-like)
  function _wrap({ id, label, control, required, hint, error }) {
    const reqStar = required ? ' <span class="v2-form-req">*</span>' : ''
    const labelHtml = label
      ? `<label class="fl" for="${Utils.escHtmlAttr(id)}">${Utils.escHtml(label)}${reqStar}</label>`
      : ''
    const hintHtml = hint ? `<div class="v2-form-hint">${Utils.escHtml(hint)}</div>` : ''
    const errHtml = error ? `<div class="v2-form-error">${Utils.escHtml(error)}</div>` : ''
    return `<div class="fg" data-field="${Utils.escHtmlAttr(id)}">${labelHtml}${control}${hintHtml}${errHtml}</div>`
  }

  function input({ id, label, type = 'text', value = '', placeholder = '', required = false, hint, min, max, step, readonly = false }) {
    const attrs = [
      `type="${Utils.escHtmlAttr(type)}"`,
      `id="${Utils.escHtmlAttr(id)}"`,
      `name="${Utils.escHtmlAttr(id)}"`,
      `class="fi"`,
      `value="${Utils.escHtmlAttr(value)}"`,
      placeholder ? `placeholder="${Utils.escHtmlAttr(placeholder)}"` : '',
      required ? 'required' : '',
      readonly ? 'readonly' : '',
      min !== undefined ? `min="${Utils.escHtmlAttr(min)}"` : '',
      max !== undefined ? `max="${Utils.escHtmlAttr(max)}"` : '',
      step !== undefined ? `step="${Utils.escHtmlAttr(step)}"` : ''
    ].filter(Boolean).join(' ')
    return _wrap({ id, label, control: `<input ${attrs}>`, required, hint })
  }

  function textarea({ id, label, value = '', placeholder = '', required = false, rows = 3, hint }) {
    const attrs = [
      `id="${Utils.escHtmlAttr(id)}"`,
      `name="${Utils.escHtmlAttr(id)}"`,
      `class="fi"`,
      `rows="${Number(rows) || 3}"`,
      placeholder ? `placeholder="${Utils.escHtmlAttr(placeholder)}"` : '',
      required ? 'required' : ''
    ].filter(Boolean).join(' ')
    return _wrap({ id, label, control: `<textarea ${attrs}>${Utils.escHtml(value)}</textarea>`, required, hint })
  }

  function select({ id, label, options = [], value = '', required = false, placeholder, hint }) {
    const opts = []
    if (placeholder !== undefined) {
      opts.push(`<option value="">${Utils.escHtml(placeholder)}</option>`)
    }
    for (const opt of options) {
      const v = opt.value !== undefined ? opt.value : opt
      const l = opt.label !== undefined ? opt.label : String(v)
      const sel = String(v) === String(value) ? ' selected' : ''
      opts.push(`<option value="${Utils.escHtmlAttr(v)}"${sel}>${Utils.escHtml(l)}</option>`)
    }
    const attrs = [
      `id="${Utils.escHtmlAttr(id)}"`,
      `name="${Utils.escHtmlAttr(id)}"`,
      `class="fi"`,
      required ? 'required' : ''
    ].filter(Boolean).join(' ')
    return _wrap({ id, label, control: `<select ${attrs}>${opts.join('')}</select>`, required, hint })
  }

  function checkbox({ id, label, checked = false, hint }) {
    const attrs = [
      `type="checkbox"`,
      `id="${Utils.escHtmlAttr(id)}"`,
      `name="${Utils.escHtmlAttr(id)}"`,
      `class="v2-form-check"`,
      checked ? 'checked' : ''
    ].filter(Boolean).join(' ')
    const hintHtml = hint ? `<div class="v2-form-hint">${Utils.escHtml(hint)}</div>` : ''
    return `<div class="fg v2-form-checkrow" data-field="${Utils.escHtmlAttr(id)}"><label class="fl" for="${Utils.escHtmlAttr(id)}"><input ${attrs}> ${Utils.escHtml(label || '')}</label>${hintHtml}</div>`
  }

  // ─── Validation ─────────────────────────────────────────────
  // Returns { valid, errors:[{ id, label, message }], values:{ id: value } }
  // Ignores checkbox groups for required (caller validates those manually).
  function validate(formEl) {
    const errors = []
    const values = {}
    if (!formEl || !(formEl instanceof Element)) {
      return { valid: false, errors: [{ id: '_form', label: 'Form', message: 'Form element missing' }], values }
    }
    const fields = formEl.querySelectorAll('input[name], select[name], textarea[name]')
    for (const f of fields) {
      const id = f.name || f.id
      const label = _labelFor(formEl, id)
      const value = f.type === 'checkbox' ? f.checked : f.value
      values[id] = value
      if (f.required) {
        const empty = f.type === 'checkbox' ? !f.checked : String(value).trim() === ''
        if (empty) {
          errors.push({ id, label, message: `${label} is required` })
          continue
        }
      }
      if (f.type === 'email' && String(value).trim() !== '' && !_isEmail(value)) {
        errors.push({ id, label, message: `${label} must be a valid email` })
      }
      if (f.type === 'number' && value !== '' && !Number.isFinite(Number(value))) {
        errors.push({ id, label, message: `${label} must be a number` })
      }
    }
    return { valid: errors.length === 0, errors, values }
  }

  function _labelFor(formEl, id) {
    const lbl = formEl.querySelector(`[for="${CSS.escape(id)}"]`)
    if (lbl && lbl.textContent) return lbl.textContent.replace(/\*/g, '').trim()
    return id
  }

  function _isEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim())
  }

  // ─── Error display helpers ──────────────────────────────────
  // Given a form and validation errors, set/clear .v2-form-error messages
  // on the corresponding .fg[data-field="..."] blocks.
  function showErrors(formEl, errors) {
    if (!formEl) return
    for (const fg of formEl.querySelectorAll('.fg[data-field]')) {
      const existing = fg.querySelector('.v2-form-error')
      if (existing) existing.remove()
      fg.classList.remove('has-error')
    }
    for (const err of (errors || [])) {
      const fg = formEl.querySelector(`.fg[data-field="${CSS.escape(err.id)}"]`)
      if (!fg) continue
      fg.classList.add('has-error')
      const div = document.createElement('div')
      div.className = 'v2-form-error'
      div.textContent = err.message
      fg.appendChild(div)
    }
  }

  return { input, textarea, select, checkbox, validate, showErrors }
})()

window.Form = Form
