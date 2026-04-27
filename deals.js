// deals.js — Quill rich text editor instances only
// All other logic has been split into deals-state.js, deals-dashboard.js,
// deals-kanban.js, deals-modal.js, deals-clients.js, deals-vendors.js,
// deals-products.js, and deals-init.js

let _ndNotesQuill = null   // New deal modal

function _initNdNotesQuill() {
  if (!_ndNotesQuill) {
    _ndNotesQuill = new Quill('#nd-notes-editor', {
      theme: 'snow',
      placeholder: 'Add notes…',
      modules: { toolbar: [['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['link'],['clean']] },
    })
  }
  _ndNotesQuill.root.innerHTML = ''
}

function _quillValue(q) {
  if (!q) return null
  const html = q.root.innerHTML
  return html === '<p><br></p>' ? null : html
}
