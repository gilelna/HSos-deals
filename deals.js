// deals.js — HSos Deals module logic
// Depends on: supabase-client.js (loaded before this file)

// ═══════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════
// ── Data (loaded from Supabase) ──────────────────────────────────────────────
let CLIENTS  = []
let VENDORS  = []
let VENDORS_EXT = []   // same array — kept for compatibility with render functions
let MANAGERS = []
let PRODUCTS = []
let DEALS    = []
let PAYCHECKS = []
let MONTH_SESSIONS = {}  // populated from vendor_hours per-vendor per-month

const SESSION_TYPE_ICONS = {
  coaching:   '🎓',
  consulting: '💼',
  editing:    '✏️',
  design:     '🎨',
  admin:      '📋',
  other:      '⚡',
}

const STAGES=[
  {key:'lead',      label:'Lead',      color:'#888888'},
  {key:'qualified', label:'Qualified', color:'#5a9de0'},
  {key:'active',    label:'Active',    color:'#4caf82'},
  {key:'delivered', label:'Delivered', color:'#3dbfb0'},
  {key:'closed',    label:'Closed',    color:'#5a5a66'},
];
const BILLING=['pending','invoiced','partial','paid','overdue'];
const SYM={EUR:'€',USD:'$',GBP:'£',ILS:'₪',CHF:'₣'};
const fmt=(p,c)=>`${SYM[c]||c}${Number(p).toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:2})}`;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const getC=id=>CLIENTS.find(x=>x.id===id)||{name:id,company:null,initials:'?',color:'#888',bg:'#222'};
const getV=id=>VENDORS.find(x=>x.id===id)||{name:id,initials:'?',color:'#888',bg:'#222'};
const getM=id=>MANAGERS.find(x=>x.id===id)||VENDORS.find(x=>x.id===id)||null; // TEMP COMPAT: manager lookup; falls back to vendor record
const getP=id=>PRODUCTS.find(x=>x.id===id)||null;
const getS=k=>STAGES.find(x=>x.key===k);
const finalAmt=(price,vat,mode)=>{
  const p=parseFloat(price)||0, v=parseFloat(vat)||0;
  if(mode==='excl') return p*(1+v/100);
  return p; // incl: final = base
};
const baseAmt=(price,vat,mode)=>{
  const p=parseFloat(price)||0, v=parseFloat(vat)||0;
  if(mode==='incl') return v>0?p/(1+v/100):p;
  return p;
};

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let view='kanban', filters=new Set(), search='', movingId=null, selProc_='', vatMode='excl', dpDealId=null, dpTab='info', nextN=8, page='deals';
let SALES_CLIENT_FILTERS = { search:'', stage:'all', billing:'all' }
let selectedSalesClientId = null
let selectedSalesClientDetail = null
let salesClientEditMode = false
let pendingSalesClientId = null

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════
function showToast(msg,type='success'){
  const t=document.getElementById('toast'), m=document.getElementById('toast-msg');
  t.className='toast '+(type||'success');
  m.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2800);
}

// ═══════════════════════════════════════════════════════════
// PAGE SWITCHING
// ═══════════════════════════════════════════════════════════
function switchPage(p,btn){
  if (p === 'students') p = 'clients'
  page=p;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('cur'));
  const targetBtn = btn || document.querySelector(`.nav-btn[data-page="${p}"]`)
  if (targetBtn) targetBtn.classList.add('cur');
  document.getElementById('deals-toolbar').classList.toggle('hidden', p!=='deals');
  document.getElementById('kanban-view').classList.toggle('hidden', p!=='deals'||view!=='kanban');
  document.getElementById('list-view').classList.toggle('hidden', p!=='deals'||view!=='list');
  document.getElementById('clients-view').classList.toggle('hidden', p!=='clients');
  document.getElementById('products-view').classList.toggle('hidden', p!=='products');
  document.getElementById('settings-view').classList.toggle('hidden', p!=='settings');
  document.getElementById('od-bar').classList.toggle('hidden', p!=='deals');
  document.getElementById('vendors-view').classList.toggle('hidden', p!=='vendors');
  if(p==='deals') render();
  else if(p==='clients') renderSalesClients()
  else if(p==='products') renderProducts();
  else if(p==='vendors') renderVendors();
  else if(p==='settings') renderSettings();
}

// ═══════════════════════════════════════════════════════════
// RENDER DEALS
// ═══════════════════════════════════════════════════════════
function filtered(){
  return DEALS.filter(d=>{
    if(search){
      const c=getC(d.clientId), p=getP(d.productId);
      if(![c.name,c.company||'',p?p.name:'',d.id].join(' ').toLowerCase().includes(search.toLowerCase())) return false;
    }
    if(filters.has('overdue') && d.billing!=='overdue') return false;
    if(filters.has('active')  && d.fulfillment!=='active') return false;
    if(filters.has('unpaid')  && d.billing==='paid') return false;
    return true;
  });
}

function render(){
  renderOD();
  view==='kanban'?renderKanban():renderList();
}

function renderOD(){
  const bar=document.getElementById('od-bar');
  const od=DEALS.filter(d=>d.billing==='overdue');
  if(!od.length){bar.innerHTML='';bar.style.display='none';return;}
  bar.style.display='flex';
  bar.innerHTML=`<span class="od-lbl">⚠ Overdue (${od.length})</span>
  <div class="od-chips">${od.map(d=>{
    const c=getC(d.clientId), fa=finalAmt(d.price,d.vat,d.vatMode);
    return `<div class="od-chip" onclick="openCp('${d.clientId}')">
      <span class="od-cn">${c.name}</span>
      <span class="od-ca">${fmt(fa,d.currency)}</span>
    </div>`;
  }).join('')}</div>`;
}

function renderKanban(){
  const deals=filtered();
  document.getElementById('kanban-view').innerHTML=STAGES.map(st=>{
    const sd=deals.filter(d=>d.fulfillment===st.key);
    const tot=sd.reduce((s,d)=>s+finalAmt(d.price,d.vat,d.vatMode),0);
    return `<div class="k-col">
      <div class="k-hd">
        <div class="k-title"><div class="k-dot" style="background:${st.color}"></div>${st.label}</div>
        <div class="k-stats">
          ${tot>0?`<span class="k-amt">${fmt(tot,'EUR')}</span>`:''}
          <span class="k-cnt">${sd.length}</span>
        </div>
      </div>
      <div class="k-body">
        ${sd.map(d=>dealCard(d)).join('')||`<div style="padding:14px 4px;text-align:center;color:var(--mu2);font-size:11px">Empty</div>`}
      </div>
    </div>`;
  }).join('');
}

function dealCard(d){
  const c=getC(d.clientId), v=getV(d.vendorId), m=getM(d.managerId), p=getP(d.productId);
  const st=getS(d.fulfillment);
  const fa=finalAmt(d.price,d.vat,d.vatMode);
  const vatLabel=d.vat>0?(d.vatMode==='excl'?`+${d.vat}% VAT`:`incl. ${d.vat}% VAT`):'';
  return `<div class="dc card-anim" onclick="openDp('${d.id}')">
    <button class="move-btn" onclick="event.stopPropagation();openMove('${d.id}')" title="Move">→</button>
    <div class="dc-top">
      <div>
        <div class="dc-client clickable" onclick="event.stopPropagation();openCp('${d.clientId}')">${c.name}</div>
        ${c.company?`<div class="dc-co">${c.company}</div>`:''}
      </div>
      <div>
        <div class="dc-amt">${fmt(fa,d.currency)}</div>
        ${vatLabel?`<div style="font-size:9px;color:var(--mu2);text-align:right">${vatLabel}</div>`:''}
      </div>
    </div>
    <div class="dc-prod">${p?p.name:'Custom'}</div>
    <div class="dc-mid">
      ${m?`<div class="mgr-chip"><div class="mgr-av" style="background:${m.bg};color:${m.color}">${m.initials}</div>${m.name.split(' ')[0]}</div>`:''}
      <div style="margin-left:auto;display:flex;align-items:center;gap:4px">
        <div class="vdot" style="background:${v.bg};color:${v.color}">${v.initials}</div>
      </div>
    </div>
    <div class="dc-bot">
      <div class="dc-badges">
        <span class="bb ${d.billing}"><span class="bbd"></span>${d.billing}</span>
        ${d.processor?`<span style="font-size:9px;color:var(--mu2);padding:2px 5px;background:var(--sf2);border-radius:10px;border:1px solid var(--b)">${d.processor.replace('-',' ')}</span>`:''}
      </div>
      ${d.billing==='invoiced'||d.billing==='overdue'?`<div class="notif-hint"><div style="width:5px;height:5px;border-radius:50%;background:var(--am);animation:pulse 2s infinite"></div>notif</div>`:''}
    </div>
  </div>`;
}

function renderList(){
  document.getElementById('list-tbody').innerHTML=filtered().map(d=>{
    const c=getC(d.clientId), v=getV(d.vendorId), m=getM(d.managerId), p=getP(d.productId);
    const fa=finalAmt(d.price,d.vat,d.vatMode);
    return `<tr onclick="openDp('${d.id}')">
      <td><div style="font-weight:500" class="clickable" onclick="event.stopPropagation();openCp('${d.clientId}')">${c.name}</div>${c.company?`<div style="font-size:10px;color:var(--mu2)">${c.company}</div>`:''}</td>
      <td style="color:var(--mu)">${p?p.name:'Custom'}</td>
      <td>${m?`<div style="display:flex;align-items:center;gap:5px"><div class="mgr-av" style="background:${m.bg};color:${m.color};width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700">${m.initials}</div><span style="font-size:11px">${m.name}</span></div>`:'—'}</td>
      <td class="mono" style="color:var(--mu)">${fmt(d.price,d.currency)}</td>
      <td style="color:var(--mu2);font-size:11px">${d.vat>0?d.vat+'% '+(d.vatMode==='excl'?'+':' incl.'):'—'}</td>
      <td class="mono" style="color:var(--ac)">${fmt(fa,d.currency)}</td>
      <td style="font-size:11px;color:var(--mu2)">${d.processor||'—'}</td>
      <td><span class="fs-badge ${d.fulfillment}">${d.fulfillment}</span></td>
      <td><span class="bb ${d.billing}"><span class="bbd"></span>${d.billing}</span></td>
    </tr>`;
  }).join('')||`<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--mu2)">No deals match filters</td></tr>`;
}

function esc(v){
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function normalizeClientBillingStatus(client){
  const explicit = client.paymentStatus || client.payment_status
  if (explicit) {
    const s = String(explicit).toLowerCase()
    if (s.includes('overdue')) return 'overdue'
    if (s.includes('pending') || s.includes('invoiced') || s.includes('partial')) return 'pending'
    if (s.includes('paid') || s.includes('active')) return 'paid'
  }
  const deals = client.deals || []
  const statuses = deals.map(d => d.billing_status || d.billing).filter(Boolean)
  if (statuses.includes('overdue')) return 'overdue'
  if (statuses.some(s => s !== 'paid')) return 'pending'
  if (statuses.includes('paid')) return 'paid'
  return 'pending'
}

function clientMatchesStage(client, stage){
  if (stage === 'all') return true
  const deals = client.deals || []
  if (stage === 'none') return deals.length === 0
  return deals.some(d => (d.sales_status || d.fulfillment_stage || d.fulfillment) === stage)
}

function setSalesClientsSearch(value){
  SALES_CLIENT_FILTERS.search = value || ''
  renderSalesClients()
}

function setSalesStageFilter(value){
  SALES_CLIENT_FILTERS.stage = value || 'all'
  renderSalesClients()
}

function setSalesBillingFilter(value){
  SALES_CLIENT_FILTERS.billing = value || 'all'
  renderSalesClients()
}

function filteredSalesClients(){
  const q = SALES_CLIENT_FILTERS.search.trim().toLowerCase()
  return CLIENTS.filter(c => {
    if (q) {
      const blob = [c.name, c.email, c.company, c.phone].filter(Boolean).join(' ').toLowerCase()
      if (!blob.includes(q)) return false
    }
    if (!clientMatchesStage(c, SALES_CLIENT_FILTERS.stage)) return false
    if (SALES_CLIENT_FILTERS.billing !== 'all' && normalizeClientBillingStatus(c) !== SALES_CLIENT_FILTERS.billing) return false
    return true
  })
}

function renderSalesClients(){
  const list = document.getElementById('sales-clients-list')
  if (!list) return
  const clients = filteredSalesClients()
  const count = document.getElementById('sales-clients-count')
  if (count) count.textContent = `${clients.length}`

  list.innerHTML = clients.map(c => {
    const cur = selectedSalesClientId === c.id
    const total = c.totalValue || 0
    const metaCurrency = c.deals?.[0]?.currency || 'EUR'
    return `<div class="sales-client-card${cur ? ' cur' : ''}" onclick="selectSalesClient('${c.id}')">
      <div class="sales-client-av" style="background:${c.bg};color:${c.color}">${esc(c.initials)}</div>
      <div class="sales-client-main">
        <div class="sales-client-name">${esc(c.name)}</div>
        <div class="sales-client-email">${esc(c.email || 'No email')}</div>
        <div class="sales-client-meta"><span>${c.dealCount || 0} deals</span><strong>${fmt(total, metaCurrency)}</strong></div>
      </div>
    </div>`
  }).join('') || `<div style="padding:20px;text-align:center;color:var(--mu2);font-size:12px;background:#FFFFFF">No clients match current filters</div>`

  renderSalesClientDetail()
}

async function selectSalesClient(clientId, options = {}){
  selectedSalesClientId = clientId
  salesClientEditMode = false
  if (!options.keepPage) switchPage('clients')
  renderSalesClients()

  try {
    selectedSalesClientDetail = await getClientDetail(clientId)
    renderSalesClientDetail()
  } catch (err) {
    showToast('Failed loading client detail: ' + err.message, 'warn')
    selectedSalesClientDetail = null
    renderSalesClientDetail()
  }
}

function renderSalesClientDetail(){
  const empty = document.getElementById('sales-client-empty')
  const detail = document.getElementById('sales-client-detail')
  const body = document.getElementById('sales-client-detail-body')
  if (!empty || !detail || !body) return

  if (!selectedSalesClientId) {
    empty.style.display = 'flex'
    detail.classList.add('hidden')
    return
  }

  empty.style.display = 'none'
  detail.classList.remove('hidden')
  const base = CLIENTS.find(c => c.id === selectedSalesClientId)
  if (!base) {
    body.innerHTML = `<div class="clients-empty"><div class="empty-icon">⚠</div><div>Client not found</div></div>`
    return
  }
  if (!selectedSalesClientDetail) {
    body.innerHTML = `<div class="clients-empty"><div class="empty-icon">⌛</div><div>Loading client...</div></div>`
    return
  }

  const d = selectedSalesClientDetail
  const deals = (d.deals || []).map(mapDeal).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''))
  const totalValue = deals.reduce((s, x) => s + finalAmt(x.price, x.vat, x.vatMode), 0)
  const totalPaid = deals.filter(x => x.billing === 'paid').reduce((s, x) => s + finalAmt(x.price, x.vat, x.vatMode), 0)
  const outstanding = totalValue - totalPaid
  const baseCurrency = deals[0]?.currency || 'EUR'

  if (salesClientEditMode) {
    body.innerHTML = `
      <div class="sales-client-sec">
        <div class="sales-client-sec-hd"><span class="sales-client-sec-title">Edit Client</span></div>
        <div class="sales-edit-grid">
          <div class="fg ff"><label class="fl">Full name</label><input class="fi" id="sales-edit-name" value="${esc(base.name)}"></div>
          <div class="fg"><label class="fl">Email</label><input class="fi" id="sales-edit-email" value="${esc(base.email || '')}"></div>
          <div class="fg"><label class="fl">Phone</label><input class="fi" id="sales-edit-phone" value="${esc(base.phone || '')}"></div>
          <div class="fg"><label class="fl">Client kind</label>
            <select class="fsel" id="sales-edit-kind">
              <option value="private"${(base.clientKind || 'private') === 'private' ? ' selected' : ''}>Private</option>
              <option value="corporate"${(base.clientKind || 'private') === 'corporate' ? ' selected' : ''}>Corporate</option>
            </select>
          </div>
          <div class="fg"><label class="fl">Company</label><input class="fi" id="sales-edit-company" value="${esc(base.company || '')}"></div>
          <div class="fg"><label class="fl">Source</label><input class="fi" id="sales-edit-source" value="${esc(base.source || '')}"></div>
          <div class="fg ff"><label class="fl">Notes</label><textarea class="fi" id="sales-edit-notes" style="min-height:76px;resize:vertical">${esc(base.notes || '')}</textarea></div>
        </div>
        <div class="sales-edit-actions">
          <button class="btn-cancel" onclick="salesClientEditMode=false;renderSalesClientDetail()">Cancel</button>
          <button class="btn-create" onclick="saveSalesClientEdits()">Save</button>
        </div>
      </div>`
    return
  }

  body.innerHTML = `
    <div class="sales-client-head">
      <div class="sales-client-head-av" style="background:${base.bg};color:${base.color}">${esc(base.initials)}</div>
      <div style="flex:1">
        <div class="sales-client-head-name">${esc(base.name)}</div>
        <div class="sales-client-head-sub">${esc(base.email || 'No email')}</div>
        <div class="sales-client-head-sub">${esc((base.clientKind || 'private') + (base.company ? ` · ${base.company}` : ''))}</div>
      </div>
    </div>

    <div class="sales-client-sec">
      <div class="sales-client-sec-hd"><span class="sales-client-sec-title">All Deals (${deals.length})</span></div>
      <table class="sales-deals-table">
        <thead><tr><th>ID</th><th>Product</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          ${deals.length ? deals.map(x => `<tr class="click" onclick="openDp('${x.id}')">
            <td class="mono" style="font-size:11px;color:var(--mu)">#${esc(x.id)}</td>
            <td>${esc(getP(x.productId)?.name || x.products?.name || 'Custom')}</td>
            <td class="mono" style="color:var(--ac)">${fmt(finalAmt(x.price, x.vat, x.vatMode), x.currency)}</td>
            <td>${esc(x.fulfillment || '—')}</td>
          </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--mu2)">No deals yet</td></tr>`}
        </tbody>
      </table>
      <div class="sales-client-sum">
        <div class="row"><div class="lbl">Total value</div><div class="val">${fmt(totalValue, baseCurrency)}</div></div>
        <div class="row"><div class="lbl">Total paid</div><div class="val">${fmt(totalPaid, baseCurrency)}</div></div>
        <div class="row"><div class="lbl">Outstanding</div><div class="val">${fmt(outstanding, baseCurrency)}</div></div>
      </div>
    </div>

    <div class="sales-client-sec">
      <div class="sales-client-sec-hd"><span class="sales-client-sec-title">Payment Integrations</span></div>
      <div class="dp-row"><span class="dp-rl">Stripe</span><span class="dp-rv">${esc(d.stripe_customer_id ? `connected (${d.stripe_customer_id})` : 'not connected')}</span></div>
      <div class="dp-row"><span class="dp-rl">Green Invoice</span><span class="dp-rv">${esc(d.green_invoice_client_id ? `client #${d.green_invoice_client_id}` : 'not set')}</span></div>
    </div>

    <div class="sales-client-actions">
      <button class="btn-create" onclick="openCreateDealForClient('${selectedSalesClientId}')">+ Create Deal</button>
      <button class="btn-cancel" onclick="salesClientEditMode=true;renderSalesClientDetail()">Edit Client</button>
      <button class="btn-cancel" onclick="viewClientInOperations()">View in Operations</button>
    </div>`
}

async function saveSalesClientEdits(){
  if (!selectedSalesClientId) return
  const full_name = document.getElementById('sales-edit-name')?.value.trim()
  if (!full_name) {
    showToast('Client name is required', 'info')
    return
  }
  const payload = {
    full_name,
    email: document.getElementById('sales-edit-email')?.value.trim() || null,
    phone: document.getElementById('sales-edit-phone')?.value.trim() || null,
    client_kind: document.getElementById('sales-edit-kind')?.value || 'private',
    company: document.getElementById('sales-edit-company')?.value.trim() || null,
    source: document.getElementById('sales-edit-source')?.value.trim() || null,
    notes: document.getElementById('sales-edit-notes')?.value.trim() || null,
  }
  try {
    const updated = await updateClient(selectedSalesClientId, payload)
    salesClientEditMode = false
    if (isDummyMode()) {
      CLIENTS = CLIENTS.map(c => c.id === selectedSalesClientId ? mapClient({ ...c, ...updated, ...payload }) : c)
      selectedSalesClientDetail = { ...selectedSalesClientDetail, ...payload }
      renderSalesClients()
    } else {
      await loadData()
    }
    showToast('Client updated', 'success')
  } catch (err) {
    showToast('Failed to update client: ' + err.message, 'warn')
  }
}

function openCreateDealForClient(clientId){
  openNewDeal()
  const clientField = document.getElementById('f-client')
  if (clientField) clientField.value = clientId
}

function viewClientInOperations(){
  if (!selectedSalesClientId) return
  window.open(`workload.html?page=clients&clientId=${encodeURIComponent(selectedSalesClientId)}`, '_self')
}

function openSalesClientModal(){
  document.getElementById('sales-new-full-name').value = ''
  document.getElementById('sales-new-email').value = ''
  document.getElementById('sales-new-phone').value = ''
  document.getElementById('sales-new-kind').value = 'private'
  document.getElementById('sales-new-company').value = ''
  document.getElementById('sales-new-source').value = ''
  document.getElementById('sales-new-notes').value = ''
  toggleSalesNewCompany('private')
  document.getElementById('sales-client-modal').classList.add('open')
}

function closeSalesClientModal(){
  document.getElementById('sales-client-modal').classList.remove('open')
}

function toggleSalesNewCompany(kind){
  const wrap = document.getElementById('sales-new-company-wrap')
  if (!wrap) return
  wrap.style.display = kind === 'corporate' ? 'block' : 'none'
}

async function submitSalesClient(){
  const full_name = document.getElementById('sales-new-full-name')?.value.trim()
  if (!full_name) {
    showToast('Full name is required', 'info')
    return
  }
  const payload = {
    full_name,
    email: document.getElementById('sales-new-email')?.value.trim() || null,
    phone: document.getElementById('sales-new-phone')?.value.trim() || null,
    client_kind: document.getElementById('sales-new-kind')?.value || 'private',
    company: document.getElementById('sales-new-company')?.value.trim() || null,
    source: document.getElementById('sales-new-source')?.value || null,
    notes: document.getElementById('sales-new-notes')?.value.trim() || null,
    active: true,
  }
  try {
    const created = await createClient(payload)
    closeSalesClientModal()
    switchPage('clients')
    if (isDummyMode()) {
      const localClient = mapClient({ ...created, ...payload, deals: [], dealCount: 0, totalValue: 0, paidValue: 0, vendors: [] })
      CLIENTS = [localClient, ...CLIENTS]
      selectedSalesClientId = localClient.id
      selectedSalesClientDetail = { ...localClient, deals: [], vendor_clients: [], sessions: [] }
      renderSalesClients()
    } else {
      await loadData()
      await selectSalesClient(created.id, { keepPage: true })
    }
    openCreateDealForClient(created.id)
    showToast('Client created', 'success')
  } catch (err) {
    showToast('Failed to create client: ' + err.message, 'warn')
  }
}

async function openSalesClientFromNavigation(clientId){
  if (!clientId) return
  switchPage('clients')
  if (!CLIENTS.find(c => c.id === clientId)) {
    showToast('Client not found in Sales list', 'info')
    return
  }
  await selectSalesClient(clientId, { keepPage: true })
}

// ═══════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════
function renderProducts(){
  const typeClass={session:'session',lesson:'session',package:'package',workshop:'workshop',custom:'custom'};
  document.getElementById('prod-tbody').innerHTML=PRODUCTS.map(p=>`<tr onclick="showToast('Edit product — Phase 2','info')">
    <td style="font-weight:500">${p.name}</td>
    <td><span class="type-pill ${typeClass[p.type]||'custom'}">${p.type}</span></td>
    <td class="mono" style="color:var(--ac)">${fmt(p.price,p.currency)}</td>
    <td style="color:var(--mu)">${p.currency}</td>
    <td style="color:var(--mu2);font-size:11px">${p.units}</td>
    <td style="color:var(--mu2);font-size:11px">${p.notes||'—'}</td>
  </tr>`).join('');
}

// ═══════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════
function renderSettings(){
  document.getElementById('mgr-list').innerHTML=MANAGERS.map(m=>`
    <div class="mgr-card">
      <div class="mgr-av-lg" style="background:${m.bg};color:${m.color}">${m.initials}</div>
      <div class="mgr-info">
        <div class="mgr-name">${m.name}</div>
        <div class="mgr-role">${m.role}</div>
        <div class="mgr-slack">
          <span style="font-size:10px">💬</span>
          <span class="slack-pill">${m.slack||'not set'}</span>
          ${m.webhook?`<span style="font-size:9px;color:var(--gn)">webhook ✓</span>`:`<span style="font-size:9px;color:var(--mu2)">no webhook</span>`}
        </div>
      </div>
      <button class="btn-sm" onclick="showToast('Edit team member — Phase 2','info')">Edit</button>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════
// NEW DEAL
// ═══════════════════════════════════════════════════════════
function openNewDeal(){
  document.getElementById('f-client').innerHTML ='<option value="">— Select client —</option>'+CLIENTS.map(c=>`<option value="${c.id}">${c.name}${c.company?' · '+c.company:''}</option>`).join('');
  document.getElementById('f-vendor').innerHTML ='<option value="">— Select vendor —</option>'+VENDORS.map(v=>`<option value="${v.id}">${v.name}</option>`).join('');
  // TEMP COMPAT: MANAGERS still loaded from legacy table; displayed as owners
  document.getElementById('f-owner').innerHTML='<option value="">— Assign owner —</option>'+MANAGERS.map(m=>`<option value="${m.id}">${m.name} (${m.role})</option>`).join('');
  document.getElementById('f-product').innerHTML='<option value="">— Select product —</option>'+PRODUCTS.map(p=>`<option value="${p.id}">${p.name} — ${fmt(p.price,p.currency)}</option>`).join('');
  selProc_=''; vatMode='excl';
  document.querySelectorAll('.proc-card').forEach(c=>c.classList.remove('sel'));
  document.getElementById('proc-fields').classList.add('hidden');
  document.getElementById('proc-fields').innerHTML='';
  document.getElementById('vat-excl').classList.add('on');
  document.getElementById('vat-incl').classList.remove('on');
  ['f-price','f-vat','f-notes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('vat-final').textContent='—';
  document.getElementById('vat-breakdown').textContent='Base: — + VAT: —';
  document.getElementById('modal-new').classList.add('open');
}

function onProductChange(pid){
  const p=PRODUCTS.find(x=>x.id===pid);
  if(!p) return;
  document.getElementById('f-price').value=p.price||'';
  document.getElementById('f-currency').value=p.currency||'EUR';
  calcVAT();
}

function setVatMode(m){
  vatMode=m;
  document.getElementById('vat-excl').classList.toggle('on',m==='excl');
  document.getElementById('vat-incl').classList.toggle('on',m==='incl');
  calcVAT();
}

function calcVAT(){
  const price=parseFloat(document.getElementById('f-price').value)||0;
  const vat=parseFloat(document.getElementById('f-vat').value)||0;
  const cur=document.getElementById('f-currency').value||'EUR';
  let final, base, vatAmt;
  if(vatMode==='excl'){
    base=price; vatAmt=price*vat/100; final=price+vatAmt;
  } else {
    final=price; base=vat>0?price/(1+vat/100):price; vatAmt=final-base;
  }
  document.getElementById('vat-final').textContent=price>0?fmt(final,cur):'—';
  document.getElementById('vat-breakdown').textContent=price>0?`Base: ${fmt(base,cur)} + VAT: ${fmt(vatAmt,cur)}`:'Base: — + VAT: —';
}

function selProc(p){
  selProc_=p;
  document.querySelectorAll('.proc-card').forEach(c=>c.classList.remove('sel'));
  const ids={'green-invoice':'pc-gi',stripe:'pc-str',wise:'pc-wise',thrive:'pc-thr'};
  if(ids[p]) document.getElementById(ids[p]).classList.add('sel');
  const fld=document.getElementById('proc-fields');
  fld.classList.remove('hidden');
  const fields={
    'green-invoice':`<div class="fg"><label class="fl">Green Invoice Client ID</label><input class="fi" placeholder="Client profile ID"></div><div class="fg"><label class="fl">Invoice Series</label><input class="fi" placeholder="INV-2025"></div>`,
    stripe:`<div class="fg"><label class="fl">Stripe Customer ID</label><input class="fi" placeholder="cus_xxxxx (optional)"></div><div style="font-size:10px;color:var(--mu);padding:4px 0">Payment link generated after deal creation</div>`,
    wise:`<div class="fg"><label class="fl">IBAN / Account</label><input class="fi" placeholder="IL62-0108-0000-0009-9999-999"></div><div class="fg"><label class="fl">Bank Reference</label><input class="fi" placeholder="Bank name or transfer ref"></div>`,
    thrive:`<div class="fg"><label class="fl">Thrive Card Reference</label><input class="fi" placeholder="Card or account ref"></div>`,
  };
  fld.innerHTML=fields[p]||'';
}

async function submitNewDeal(){
  const cid=document.getElementById('f-client').value;
  const vid=document.getElementById('f-vendor').value;
  if(!cid||!vid){
    ['f-client','f-vendor'].forEach(id=>{const el=document.getElementById(id);if(!el.value){el.classList.add('err');setTimeout(()=>el.classList.remove('err'),800);}});
    showToast('Please fill in Client and Vendor','warn');
    return;
  }
  const price=parseFloat(document.getElementById('f-price').value)||0;
  const vat=parseFloat(document.getElementById('f-vat').value)||0;
  const dealData={
    client_id:         cid,
    primary_vendor_id: vid,
    owner_vendor_id:   document.getElementById('f-owner').value||null,
    product_id:        document.getElementById('f-product').value||null,
    price,
    currency:          document.getElementById('f-currency').value||'EUR',
    vat_pct:           vat,
    vat_mode:          vatMode,
    payment_processor: selProc_||null,
    sales_status:      document.getElementById('f-fulfill').value,
    billing_status:    document.getElementById('f-billing').value,
    notes:             document.getElementById('f-notes').value.trim(),
  };
  try {
    await createDeal(dealData)
    closeModal('modal-new')
    await loadData()
    showToast(`Deal created for ${getC(cid).name}`,'success')
  } catch(err) {
    showToast('Error creating deal: '+err.message,'warn')
  }
}

// ═══════════════════════════════════════════════════════════
// MOVE
// ═══════════════════════════════════════════════════════════
function openMove(id){
  movingId=id;
  const d=DEALS.find(x=>x.id===id), c=getC(d.clientId);
  document.getElementById('move-info').textContent=`${c.name} — ${getP(d.productId)?.name||'Deal'}`;
  document.getElementById('move-opts').innerHTML=STAGES.map(st=>`
    <button class="move-opt ${st.key===d.fulfillment?'cur':''}" onclick="moveDeal('${st.key}')">
      <div class="move-dot-lg" style="background:${st.color}"></div>${st.label}
      ${st.key===d.fulfillment?'<span style="margin-left:auto;font-size:10px;color:var(--mu2)">current</span>':''}
    </button>`).join('');
  document.getElementById('modal-move').classList.add('open');
}
async function moveDeal(stage){
  try {
    await setDealFulfillment(movingId, stage)
    await loadData()
    const st=getS(stage)
    showToast(`Moved to ${st?.label||stage}`,'success')
    closeModal('modal-move')
    if(dpDealId===movingId) refreshDp()
  } catch(err) {
    showToast('Error: '+err.message,'warn')
  }
}

// ═══════════════════════════════════════════════════════════
// DEAL SIDE PANEL
// ═══════════════════════════════════════════════════════════
function openDp(id){
  dpDealId=id; dpTab='info';
  document.querySelectorAll('.dp-tab').forEach((t,i)=>t.classList.toggle('cur',i===0));
  renderDpBody();
  document.getElementById('dp-ov').classList.add('open');
  document.getElementById('dp').classList.add('open');
}
function closeDp(){
  document.getElementById('dp-ov').classList.remove('open');
  document.getElementById('dp').classList.remove('open');
  dpDealId=null;
}
function refreshDp(){if(dpDealId) renderDpBody();}
function switchDpTab(tab,btn){
  dpTab=tab;
  document.querySelectorAll('.dp-tab').forEach(t=>t.classList.remove('cur'));
  btn.classList.add('cur');
  renderDpBody();
}

function renderDpBody(){
  const d=DEALS.find(x=>x.id===dpDealId);
  if(!d) return;
  const c=getC(d.clientId), v=getV(d.vendorId), m=getM(d.managerId), p=getP(d.productId);
  const fa=finalAmt(d.price,d.vat,d.vatMode), ba=baseAmt(d.price,d.vat,d.vatMode);
  const vatAmt=fa-ba;
  document.getElementById('dp-title').textContent=`${c.name} — ${p?.name||'Deal'}`;
  const body=document.getElementById('dp-body');

  if(dpTab==='info'){
    body.innerHTML=`
    <div class="dp-sec">
      <div class="dp-sec-t">Basic Info</div>
      <div class="dp-row"><span class="dp-rl">Client</span><span class="dp-rv clickable" onclick="openCp('${d.clientId}')">${c.name}${c.company?' · '+c.company:''}</span></div>
      <div class="dp-row"><span class="dp-rl">Vendor</span><span class="dp-rv"><span style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><div style="width:18px;height:18px;border-radius:50%;background:${v.bg};color:${v.color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700">${v.initials}</div>${v.name}</span></span></div>
      <div class="dp-row"><span class="dp-rl">Product</span><span class="dp-rv">${p?.name||'Custom'}</span></div>
      <div class="dp-row"><span class="dp-rl">Currency</span><span class="dp-rv">${d.currency}</span></div>
      <div class="dp-row"><span class="dp-rl">Processor</span><span class="dp-rv">${d.processor||'—'}</span></div>
    </div>
    <div class="dp-sec">
      <div class="dp-sec-t">Owner</div>
      ${m?`<div class="dp-row">
        <span class="dp-rl">Assigned to</span>
        <span class="dp-rv" style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
          <div style="width:20px;height:20px;border-radius:50%;background:${m.bg};color:${m.color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700">${m.initials}</div>
          ${m.name}
        </span>
      </div>
      <div class="dp-row"><span class="dp-rl">Role</span><span class="dp-rv" style="color:var(--mu)">${m.role}</span></div>
      <div class="dp-row"><span class="dp-rl">Slack</span><span class="dp-rv"><span class="slack-pill">${m.slack||'—'}</span></span></div>`
      :`<div class="dp-row"><span class="dp-rl">Assigned to</span><span class="dp-rv" style="color:var(--mu2)">Unassigned</span></div>`}
    </div>`;
  }

  else if(dpTab==='billing'){
    body.innerHTML=`
    <div class="dp-sec">
      <div class="dp-sec-t">Pricing</div>
      <div class="dp-row"><span class="dp-rl">Base price</span><span class="dp-rv mono">${fmt(d.vatMode==='incl'?ba:d.price, d.currency)}</span></div>
      <div class="dp-row"><span class="dp-rl">VAT</span><span class="dp-rv">${d.vat>0?`${d.vat}% (${d.vatMode==='excl'?'added on top':'included'})`: 'No VAT'}</span></div>
      ${d.vat>0?`<div class="dp-row"><span class="dp-rl">VAT amount</span><span class="dp-rv mono" style="color:var(--mu)">${fmt(vatAmt,d.currency)}</span></div>`:''}
      <div class="dp-row" style="background:rgba(200,184,122,.05)"><span class="dp-rl" style="font-weight:600;color:var(--tx)">Final amount</span><span class="dp-rv mono" style="color:var(--ac);font-size:15px">${fmt(fa,d.currency)}</span></div>
    </div>
    <div class="dp-sec">
      <div class="dp-sec-t">Billing Status</div>
      <div class="status-pills">
        ${BILLING.map(b=>`<button class="sp s-${b} ${b===d.billing?'on':''}" onclick="changeBilling('${d.id}','${b}')">${b}</button>`).join('')}
      </div>
    </div>
    <div class="dp-sec">
      <div class="dp-sec-t">Payment Processor</div>
      <div class="dp-row"><span class="dp-rl">Method</span><span class="dp-rv">${d.processor||'Not set'}</span></div>
    </div>`;
  }

  else if(dpTab==='workflow'){
    const st=getS(d.fulfillment);
    body.innerHTML=`
    <div class="dp-sec">
      <div class="dp-sec-t">Sales Status</div>
      <div class="status-pills">
        ${STAGES.map(s=>`<button class="sp" style="border-color:${s.key===d.fulfillment?s.color:'var(--b)'};color:${s.key===d.fulfillment?s.color:'var(--mu)'};background:${s.key===d.fulfillment?s.color+'22':'none'}" onclick="changeFulfillment('${d.id}','${s.key}')">${s.label}</button>`).join('')}
      </div>
      <div class="notif-row">
        <div class="notif-icon">💬</div>
        <span>Moving to a new stage — owner notification flow planned for <strong>${m?.name||'owner'}</strong></span>
      </div>
    </div>
    <div class="dp-sec">
      <div class="dp-sec-t">Activity</div>
      ${(d.activity||[]).length>0
        ?(d.activity).slice(-6).reverse().map(a=>`<div class="dp-row"><span style="color:var(--mu2);font-family:'DM Mono',monospace;font-size:10px">${a.time}</span><span style="color:var(--mu)">${a.text}</span></div>`).join('')
        :`<div class="dp-row"><span style="color:var(--mu2);font-size:11px">No activity yet</span></div>`}
    </div>`;
  }

  else if(dpTab==='docs'){
    body.innerHTML=`
    <div class="dp-sec">
      <div class="dp-sec-t">Documents</div>
      <div class="drop-zone" onclick="showToast('File upload — Phase 2','info')" ondragover="event.preventDefault();this.style.borderColor='var(--ac2)'" ondragleave="this.style.borderColor=''" ondrop="event.preventDefault();this.style.borderColor='';showToast('File drop — Phase 2','info')">
        <div class="drop-icon">📎</div>
        <div>Drag & drop files here, or click to browse</div>
        <div style="font-size:10px;color:var(--mu2);margin-top:4px">Invoice · Agreement · Receipt · Other</div>
        <div style="font-size:10px;color:var(--mu2);margin-top:2px">Will sync to Google Drive folder</div>
      </div>
      ${d.docs.length>0?`<div class="doc-list">${d.docs.map(doc=>`
        <div class="doc-item">
          <div class="doc-icon ${doc.type}">${doc.type==='pdf'?'📄':doc.type==='link'?'🔗':'📎'}</div>
          <div>
            <div class="doc-name">${doc.name}</div>
            ${doc.date?`<div class="doc-meta">${doc.date}</div>`:''}
            ${doc.url?`<div class="doc-meta" style="color:var(--bl)">${doc.url}</div>`:''}
          </div>
          <button class="btn-sm" onclick="showToast('Open document — Phase 2','info')">↗</button>
        </div>`).join('')}
      </div>`:''}
    </div>
    <div class="dp-sec">
      <div class="dp-sec-t">External Links</div>
      <div class="url-add">
        <input class="fi" placeholder="Paste Google Drive or external URL…" style="font-size:12px">
        <button class="btn-primary" onclick="showToast('Link saved — Phase 2','info')">Add</button>
      </div>
    </div>`;
  }

  else if(dpTab==='notes'){
    body.innerHTML=`
    <div class="dp-sec">
      <div class="dp-sec-t">Internal Notes</div>
      <div style="padding:12px">
        <textarea style="width:100%;background:var(--sf2);border:1px solid var(--b);border-radius:var(--rs);padding:10px;font-size:12px;color:var(--tx);font-family:inherit;resize:vertical;min-height:100px;outline:none" placeholder="Internal comments, context, reminders…">${d.notes||''}</textarea>
        <button class="btn-primary" style="margin-top:8px" onclick="(async()=>{try{await updateDealNotes('${d.id}',document.querySelector('#dp-body textarea').value);showToast('Notes saved','success')}catch(e){showToast(e.message,'warn')}})()">Save Notes</button>
      </div>
    </div>
    <div class="dp-sec">
      <div class="dp-sec-t">Next Steps / Reminders</div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:7px">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px"><input type="checkbox" style="accent-color:var(--ac2)"><span style="color:var(--mu)">Send invoice to client</span></div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px"><input type="checkbox" checked style="accent-color:var(--ac2)"><span style="color:var(--mu2);text-decoration:line-through">Schedule first session</span></div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px"><input type="checkbox" style="accent-color:var(--ac2)"><span style="color:var(--mu)">Follow up on payment</span></div>
        <button class="btn-sm" style="margin-top:4px;align-self:flex-start" onclick="showToast('Add reminder — Phase 2','info')">+ Add reminder</button>
      </div>
    </div>`;
  }
}

async function changeFulfillment(id,stage){
  try {
    await setDealFulfillment(id, stage)
    await loadData()
    refreshDp()
    showToast(`Sales status: ${stage}`,'success')
  } catch(err) {
    showToast('Error: '+err.message,'warn')
  }
}
async function changeBilling(id,status){
  try {
    await setDealBilling(id, status)
    await loadData()
    refreshDp()
    showToast(`Billing updated: ${status}`,'success')
  } catch(err) {
    showToast('Error: '+err.message,'warn')
  }
}

// ═══════════════════════════════════════════════════════════
// CLIENT PROFILE PANEL
// ═══════════════════════════════════════════════════════════
function openCp(cid){
  const c=getC(cid);
  const cDeals=DEALS.filter(d=>d.clientId===cid);
  document.getElementById('cp-body').innerHTML=`
    <div class="cp-av-row">
      <div class="cp-av" style="background:${c.bg};color:${c.color}">${c.initials}</div>
      <div><div style="font-size:15px;font-weight:600">${c.name}</div>
      ${c.company?`<div style="font-size:11px;color:var(--mu)">${c.company}</div>`:''}
      <div style="font-size:11px;color:var(--mu2);font-family:'DM Mono',monospace">${c.email}</div></div>
    </div>
    <div class="cp-sec">
      <div class="cp-sec-t">Deals (${cDeals.length})</div>
      ${cDeals.map(d=>{const p=getP(d.productId);const fa=finalAmt(d.price,d.vat,d.vatMode);return`<div class="cp-row">
        <span style="color:var(--mu);font-size:11px">${p?.name||'Deal'}</span>
        <span style="display:flex;align-items:center;gap:5px">
          <span class="bb ${d.billing}"><span class="bbd"></span>${d.billing}</span>
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--ac)">${fmt(fa,d.currency)}</span>
        </span>
      </div>`}).join('')||`<div class="cp-row"><span style="color:var(--mu2)">No deals</span></div>`}
    </div>
    <div class="cp-sec">
      <div class="cp-sec-t">Integrations</div>
      <div class="int-row"><div class="int-l"><div class="int-d" style="background:#e05a5a"></div>ActiveCampaign</div><span class="ist conn">connected</span></div>
      <div class="int-row"><div class="int-l"><div class="int-d" style="background:#5a9de0"></div>Stripe</div><span class="ist pend">pending</span></div>
      <div class="int-row"><div class="int-l"><div class="int-d" style="background:#e0a040"></div>Mighty Network</div><span class="ist na">not set</span></div>
    </div>
    <div class="cp-sec">
      <div class="cp-sec-t" style="border-bottom:none;padding-bottom:0"></div>
      <div style="padding:10px;display:flex;flex-direction:column;gap:5px">
        <button class="cp-btn" onclick="showToast('ActiveCampaign — Phase 2','info')">↗ Open in ActiveCampaign</button>
        <button class="cp-btn" onclick="showToast('Stripe — Phase 2','info')">↗ View in Stripe</button>
        <button class="cp-btn" onclick="showToast('Mighty Network — Phase 2','info')">↗ Mighty Network</button>
      </div>
    </div>`;
  document.getElementById('cp-ov').classList.add('open');
  document.getElementById('cp').classList.add('open');
}
function closeCp(){
  document.getElementById('cp-ov').classList.remove('open');
  document.getElementById('cp').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════
// VENDORS DATA (loaded from Supabase via loadData)
// ═══════════════════════════════════════════════════════════

const PC_FLOW = ['draft','ready','pending','paid'];
const PC_LABELS = {draft:'Draft',ready:'Ready',pending:'Pending',paid:'Paid'};

function pcNextAction(status) {
  if(status==='draft')   return {label:'Mark Ready',next:'ready'};
  if(status==='ready')   return {label:'Send to Pending',next:'pending'};
  if(status==='pending') return {label:'Mark as Paid',next:'paid'};
  return null;
}
async function advancePaycheck(id) {
  await advancePc(id);
  renderVpBody();
}

let vpVendorId = null, vpTab = 'profile';

// ── Render vendors table ──────────────────────────────────
function renderVendors() {
  const tbody = document.getElementById('vendors-tbody');
  tbody.innerHTML = VENDORS_EXT.map(v => {
    const activeDeals = DEALS.filter(d => d.vendorId === v.id && d.fulfillment === 'active').length;
    const stuNames = v.students.map(sid => {const c=getC(sid);return c.name;}).join(', ') || '—';
    const rateChips = v.rates.map(r=>{const t=r.session_type||r.type||'other';return `<span class="rate-chip">${SESSION_TYPE_ICONS[t]||'⚡'} ${t} · ${r.currency} ${r.rate}/hr</span>`;}).join('');
    return `<tr>
      <td><div class="vnd-name-cell">
        <div class="vnd-av" style="background:${v.bg};color:${v.color}">${v.initials}</div>
        <div>
          <div style="font-weight:600">${v.name}</div>
          <div style="font-size:10px;color:var(--mu);margin-top:1px">${v.email}</div>
        </div>
      </div></td>
      <td style="color:var(--mu)">${v.role}</td>
      <td>${rateChips}</td>
      <td style="font-size:11px;color:var(--mu);font-family:'DM Mono',monospace">${v.bank||'—'}</td>
      <td style="font-family:'DM Mono',monospace;text-align:center">${activeDeals}</td>
      <td style="font-size:11px;color:var(--mu);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${stuNames}</td>
      <td><button class="edit-btn" onclick="openVendorPanel('${v.id}')">Edit</button></td>
    </tr>`;
  }).join('');
}

// ── Vendor panel open/close ───────────────────────────────
function openVendorPanel(id) {
  vpVendorId = id;
  vpTab = 'profile';
  document.querySelectorAll('.vp-tab').forEach((t,i)=>t.classList.toggle('cur',i===0));
  if(id) {
    const v = VENDORS_EXT.find(x=>x.id===id);
    document.getElementById('vp-title').textContent = v ? v.name : 'Vendor';
    renderVpBody();
  } else {
    document.getElementById('vp-title').textContent = 'New Vendor';
    renderVpNewBody();
  }
  document.getElementById('vp-ov').classList.add('open');
  document.getElementById('vp').classList.add('open');
}
function closeVendorPanel() {
  document.getElementById('vp-ov').classList.remove('open');
  document.getElementById('vp').classList.remove('open');
}
function switchVpTab(tab, btn) {
  vpTab = tab;
  document.querySelectorAll('.vp-tab').forEach(t=>t.classList.remove('cur'));
  btn.classList.add('cur');
  renderVpBody();
}

function renderVpBody() {
  const v = VENDORS_EXT.find(x=>x.id===vpVendorId);
  if(!v) return;
  const el = document.getElementById('vp-body');

  if(vpTab === 'profile') {
    el.innerHTML = `
      <div class="vp-hero">
        <div class="vp-av-lg" style="background:${v.bg};color:${v.color}">${v.initials}</div>
        <div>
          <div class="vp-name">${v.name}</div>
          <div class="vp-role-lbl">${v.role}</div>
          <div class="vp-email-lbl">${v.email}</div>
        </div>
      </div>
      <div class="vp-sec">
        <div class="vp-sec-t"><span>Personal Details</span></div>
        <div class="vp-row"><span class="vp-rl">Name</span><input class="vp-input" id="vp-name" value="${v.name}"></div>
        <div class="vp-row"><span class="vp-rl">Role</span><input class="vp-input" id="vp-role" value="${v.role}"></div>
        <div class="vp-row"><span class="vp-rl">Email</span><input class="vp-input" id="vp-email" value="${v.email}" style="min-width:0;overflow:hidden;text-overflow:ellipsis"></div>
        <div class="vp-row"><span class="vp-rl">Phone</span><input class="vp-input" id="vp-phone" value="${v.phone||''}"></div>
        <div class="vp-row"><span class="vp-rl">Cal / Booking</span><input class="vp-input" id="vp-cal" value="${v.calLink||''}"></div>
      </div>
      <div class="vp-sec">
        <div class="vp-sec-t"><span>Bank &amp; Payment</span></div>
        <div class="vp-row"><span class="vp-rl">Bank</span><input class="vp-input" id="vp-bank" value="${v.bank||''}"></div>
        <div class="vp-row"><span class="vp-rl">IBAN</span><input class="vp-input" id="vp-iban" value="${v.iban||''}"></div>
        <div class="vp-row"><span class="vp-rl">Currency</span>
          <select class="vp-select" id="vp-currency" style="width:90px">
            ${['EUR','USD','ILS','GBP','CHF'].map(c=>`<option${(v.currency||'EUR')===c?' selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="vp-row"><span class="vp-rl">Salary method</span>
          <select class="vp-select" id="vp-salary" style="width:110px">
            ${['hourly','monthly','fixed'].map(m=>`<option value="${m}"${(v.salaryMethod||'hourly')===m?' selected':''}>${m.charAt(0).toUpperCase()+m.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="vp-sec">
        <div class="vp-sec-t"><span>Contract &amp; Notes</span></div>
        <div class="vp-row"><span class="vp-rl">Agreement</span><input class="vp-input" id="vp-contract" value="${v.contract||''}" placeholder="Free text or description"></div>
        <div class="vp-row" style="align-items:flex-start"><span class="vp-rl" style="padding-top:6px">Link</span><textarea class="vp-input" id="vp-contractLink" rows="2" style="font-family:'DM Mono',monospace;font-size:11px;resize:vertical;min-height:44px">${v.contractLink||''}</textarea></div>
        <div class="vp-row" style="align-items:flex-start"><span class="vp-rl" style="padding-top:6px">Internal notes</span><textarea class="vp-input" id="vp-notes" style="min-height:56px;resize:vertical">${v.notes||''}</textarea></div>
      </div>`;
  }

  else if(vpTab === 'rates') {
    const SESSION_TYPES = ['coaching','consulting','editing','design','admin','other'];
    const rows = v.rates.map((r,i) => {
      const st = r.session_type || r.type || '';
      const icon = SESSION_TYPE_ICONS[st] || '⚡';
      return `
      <div class="rate-edit-row" data-rate-id="${r.id||''}">
        <span class="rate-type-lbl">
          <select class="vp-select rate-type-inp" data-ri="${i}" style="width:140px">
            ${SESSION_TYPES.map(t=>`<option value="${t}"${st===t?' selected':''}>${SESSION_TYPE_ICONS[t]||'⚡'} ${t}</option>`).join('')}
          </select>
        </span>
        <div class="rate-input-wrap">
          <select class="vp-select" data-ri="${i}" data-field="currency" style="width:72px">
            ${['EUR','USD','GBP','ILS'].map(c=>`<option${r.currency===c?' selected':''}>${c}</option>`).join('')}
          </select>
          <input class="vp-input rate-num" type="number" data-ri="${i}" data-field="rate" value="${r.rate}" min="0" step="1">
          <span style="font-size:11px;color:var(--mu)">/hr</span>
        </div>
        <button class="edit-btn" style="color:var(--rd);border-color:transparent" onclick="removeRate('${v.id}',${i})">✕</button>
      </div>`}).join('');
    el.innerHTML = `
      <div class="vp-sec">
        <div class="vp-sec-t"><span>Rates</span><button class="edit-btn" onclick="addRate('${v.id}')">+ Add</button></div>
        <div id="rate-rows">${rows}</div>
      </div>
      <div style="font-size:11px;color:var(--mu2);padding:6px 2px">Changes apply to future sessions. Existing sessions are not affected.</div>`;
  }

  else if(vpTab === 'students') {
    const all = CLIENTS;
    const assigned = v.students;
    el.innerHTML = `
      <div class="vp-sec">
        <div class="vp-sec-t"><span>Assigned Clients</span></div>
        <div style="padding:10px 13px;display:flex;flex-wrap:wrap">
          ${assigned.length ? assigned.map(sid=>{const c=getC(sid);return `<span class="student-chip">
            <span class="student-chip-av" style="background:${c.bg};color:${c.color}">${c.initials}</span>${c.name}
            <span style="cursor:pointer;color:var(--mu2);margin-left:2px" onclick="unassignStudent('${v.id}','${sid}')">✕</span>
          </span>`;}).join('') : `<span style="font-size:12px;color:var(--mu2)">No clients assigned</span>`}
        </div>
      </div>
      <div class="vp-sec">
        <div class="vp-sec-t"><span>Assign Client</span></div>
        ${all.filter(c=>!assigned.includes(c.id)).map(c=>`
        <div class="vp-row" style="cursor:pointer" onclick="assignStudent('${v.id}','${c.id}')">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:26px;height:26px;border-radius:50%;background:${c.bg};color:${c.color};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${c.initials}</div>
            <span>${c.name}${c.company?` <span style="color:var(--mu)">· ${c.company}</span>`:''}</span>
          </div>
          <span style="font-size:12px;color:var(--mu2)">+ Assign</span>
        </div>`).join('') || `<div style="padding:12px 13px;font-size:12px;color:var(--mu2)">All clients assigned</div>`}
      </div>`;
  }

  else if(vpTab === 'payments') {
    const pcs = PAYCHECKS.filter(x=>x.vendorId===v.id).sort((a,b)=>b.month.localeCompare(a.month));
    const unpaid = pcs.filter(x=>x.status!=='paid');
    const totalOwed = unpaid.reduce((s,x)=>s+x.amount,0);

    const rows = pcs.map(pc => {
      const act = pcNextAction(pc.status);
      const monthLabel = (() => {
        const [y,m] = pc.month.split('-');
        return new Date(+y,+m-1,1).toLocaleDateString('en',{month:'long',year:'numeric'});
      })();
      return `<tr>
        <td style="font-weight:500">${monthLabel}</td>
        <td style="color:var(--mu);font-family:'DM Mono',monospace">${pc.totalHours}h</td>
        <td style="color:var(--mu2);font-size:11px">${pc.currency} ${pc.rate}/hr</td>
        <td style="font-family:'DM Mono',monospace;color:var(--ac);font-weight:500">${pc.currency} ${pc.amount.toLocaleString()}</td>
        <td><span class="pc-status ${pc.status}">${PC_LABELS[pc.status]}</span></td>
        <td style="color:var(--mu2);font-size:11px">${pc.paymentDate||'—'}</td>
        <td style="text-align:right">${act
          ? `<button class="pc-action${act.next==='paid'?' primary':''}" onclick="advancePaycheck('${pc.id}')">${act.label}</button>`
          : `<span style="font-size:10px;color:var(--mu2)">✓ done</span>`
        }</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="vp-sec" style="overflow:visible">
        <div class="vp-sec-t"><span>Paychecks</span></div>
        ${pcs.length
          ? `<table class="pc-table"><thead><tr>
              <th>Month</th><th>Hours</th><th>Rate</th><th>Amount</th><th>Status</th><th>Paid on</th><th></th>
             </tr></thead><tbody>${rows}</tbody></table>`
          : `<div style="padding:16px 13px;font-size:12px;color:var(--mu2)">No paychecks yet</div>`
        }
      </div>
      ${unpaid.length ? `
      <div style="background:rgba(200,184,122,.06);border:1px solid rgba(200,184,122,.2);border-radius:var(--rs);padding:12px 14px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:10px;font-weight:600;color:var(--mu2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Outstanding balance</div>
          <div style="font-family:'DM Mono',monospace;font-size:18px;font-weight:400;color:var(--ac)">${pcs[0]?.currency||'EUR'} ${totalOwed.toLocaleString()}</div>
        </div>
        <div style="font-size:11px;color:var(--mu)">${unpaid.length} paycheck${unpaid.length>1?'s':''} pending</div>
      </div>` : `
      <div style="background:var(--gn-b);border:1px solid rgba(76,175,130,.2);border-radius:var(--rs);padding:10px 14px;font-size:12px;color:var(--gn)">
        ✓ All paychecks settled
      </div>`}`;
  }
}

function renderVpNewBody() {
  const el = document.getElementById('vp-body');
  el.innerHTML = `
    <div class="vp-sec">
      <div class="vp-sec-t"><span>Personal Details</span></div>
      <div class="vp-row"><span class="vp-rl">Name</span><input class="vp-input" id="vp-name" placeholder="Full name"></div>
      <div class="vp-row"><span class="vp-rl">Role</span><input class="vp-input" id="vp-role" placeholder="e.g. English Teacher"></div>
      <div class="vp-row"><span class="vp-rl">Email</span><input class="vp-input" id="vp-email" placeholder="email@example.com"></div>
      <div class="vp-row"><span class="vp-rl">Phone</span><input class="vp-input" id="vp-phone" placeholder="+1-..."></div>
    </div>
    <div class="vp-sec">
      <div class="vp-sec-t"><span>Bank &amp; Payment</span></div>
      <div class="vp-row"><span class="vp-rl">Bank</span><input class="vp-input" id="vp-bank" placeholder="Bank name"></div>
      <div class="vp-row"><span class="vp-rl">IBAN</span><input class="vp-input" id="vp-iban" placeholder="IBAN / account number"></div>
    </div>`;
}

async function saveVendor() {
  if(!vpVendorId) { showToast('New vendor — coming soon','info'); return; }
  const v = VENDORS_EXT.find(x=>x.id===vpVendorId);
  if(!v) return;
  if(vpTab === 'profile') {
    const updates = {
      name:          document.getElementById('vp-name')?.value || v.name,
      role:          document.getElementById('vp-role')?.value || v.role,
      email:         document.getElementById('vp-email')?.value || v.email,
      phone:         document.getElementById('vp-phone')?.value || v.phone,
      cal_link:      document.getElementById('vp-cal')?.value ?? v.cal_link,
      bank:          document.getElementById('vp-bank')?.value || v.bank,
      iban:          document.getElementById('vp-iban')?.value || v.iban,
      currency:      document.getElementById('vp-currency')?.value || v.currency,
      salary_method: document.getElementById('vp-salary')?.value || v.salary_method,
      contract:      document.getElementById('vp-contract')?.value ?? v.contract,
      contract_link: document.getElementById('vp-contractLink')?.value ?? v.contract_link,
      notes:         document.getElementById('vp-notes')?.value ?? v.notes,
    }
    try {
      await updateVendor(vpVendorId, updates)
      await loadData()
      renderVendors()
      showToast(`${v.name} — saved`, 'success')
    } catch(err) {
      showToast('Error saving vendor: ' + err.message, 'warn')
    }
  } else if(vpTab === 'rates') {
    const rateRows = document.querySelectorAll('.rate-edit-row')
    const ratePromises = []
    rateRows.forEach((row, i) => {
      const typeEl = row.querySelector('.rate-type-inp')
      const rateEl = row.querySelector('[data-field="rate"]')
      const currEl = row.querySelector('[data-field="currency"]')
      if(typeEl && rateEl) {
        const rateId = row.dataset.rateId
        ratePromises.push(upsertRate(vpVendorId, {
          id:           rateId || undefined,
          session_type: typeEl.value,
          rate:         parseFloat(rateEl.value)||0,
          currency:     currEl?.value || 'EUR',
        }))
      }
    })
    try {
      await Promise.all(ratePromises)
      await loadData()
      showToast(`Rates saved`, 'success')
    } catch(err) {
      showToast('Error saving rates: ' + err.message, 'warn')
    }
  } else {
    showToast('Saved', 'success')
  }
}

function addRate(vid) {
  const v = VENDORS_EXT.find(x=>x.id===vid);
  if(!v) return;
  v.rates.push({session_type:'other',rate:0,currency:'EUR'});
  renderVpBody();
}
function removeRate(vid, idx) {
  const v = VENDORS_EXT.find(x=>x.id===vid);
  if(!v) return;
  v.rates.splice(idx,1);
  renderVpBody();
}
async function assignClient(vid, cid) {
  try {
    await assignClientToVendor(vid, cid)
    await loadData()
    renderVpBody()
    showToast(`${getC(cid).name} assigned to ${getV(vid).name}`, 'success')
  } catch(err) {
    showToast('Error: ' + err.message, 'warn')
  }
}
async function unassignClient(vid, cid) {
  try {
    await unassignClientFromVendor(vid, cid)
    await loadData()
    renderVpBody()
    showToast(`${getC(cid).name} unassigned`, 'info')
  } catch(err) {
    showToast('Error: ' + err.message, 'warn')
  }
}
// TEMP COMPAT aliases
async function assignStudent(vid, cid)   { return assignClient(vid, cid) }
async function unassignStudent(vid, cid) { return unassignClient(vid, cid) }

// ═══════════════════════════════════════════════════════════
// PAYCHECK HELPERS
// ═══════════════════════════════════════════════════════════
function fmtMonth(m) {
  const [y,mo]=m.split('-');
  return new Date(+y,+mo-1,1).toLocaleDateString('en',{month:'long',year:'numeric'});
}

async function advancePc(id) {
  try {
    const updated = await advancePaycheckStatus(id)
    await loadData()
    if(document.getElementById('bd').classList.contains('open')) renderBdBody(id)
    showToast(updated.status==='paid'?'Marked as paid':'Status updated to '+PC_LABELS[updated.status], 'success')
  } catch(err) {
    showToast('Error: ' + err.message, 'warn')
  }
}

// breakdown panel
let bdPcId = null;
async function openBd(pcId) {
  bdPcId = pcId;
  const pc = PAYCHECKS.find(x=>x.id===pcId);
  const v = VENDORS_EXT.find(x=>x.id===pc?.vendor_id);
  document.getElementById('bd-title').textContent = `${v?.name||'Vendor'} — ${fmtMonth(pc?.month||'')}`;

  // load sessions for this vendor/month on demand
  try {
    const hours = await getVendorHours(pc.vendor_id, pc.month)
    const key = `${pc.vendor_id}__${pc.month}`
    MONTH_SESSIONS[key] = hours
  } catch(e) {}

  renderBdBody(pcId);
  document.getElementById('bd-ov').classList.add('open');
  document.getElementById('bd').classList.add('open');
}
function closeBd() {
  document.getElementById('bd-ov').classList.remove('open');
  document.getElementById('bd').classList.remove('open');
  bdPcId = null;
}
function renderBdBody(pcId) {
  const pc = PAYCHECKS.find(x=>x.id===pcId);
  if(!pc) return;
  const v = VENDORS_EXT.find(x=>x.id===pc.vendor_id);
  const cachedKey = `${pc.vendor_id}__${pc.month}`
  const sessions = (MONTH_SESSIONS[cachedKey] || []).map(s => ({
    date:   s.session_date,
    entity: s.entity_name,
    type:   s.session_type,
    hours:  s.duration_hours,
  }))

  // group sessions by type
  const byType = {};
  sessions.forEach(s=>{
    if(!byType[s.type]) byType[s.type]={count:0,hours:0};
    byType[s.type].count++;
    byType[s.type].hours+=s.hours;
  });

  const act = pcNextAction(pc.status);
  const typeClass = {Private:'private',Group:'group',Service:'service','Design Work':'service','Workshop':'service','1:1 Session':'private','Office':'service'};

  document.getElementById('bd-body').innerHTML = `
    <div class="bd-sec">
      <div class="bd-sec-t">Summary</div>
      <div class="bd-row"><span class="bd-rl">Vendor</span><span style="font-weight:500">${v?.name||'—'}</span></div>
      <div class="bd-row"><span class="bd-rl">Month</span><span>${fmtMonth(pc.month)}</span></div>
      <div class="bd-row"><span class="bd-rl">Total hours</span><span style="font-family:'DM Mono',monospace">${pc.totalHours}h</span></div>
      <div class="bd-row"><span class="bd-rl">Rate</span><span style="font-family:'DM Mono',monospace">${pc.currency} ${pc.rate}/hr</span></div>
      <div class="bd-row" style="background:rgba(200,184,122,.05)"><span class="bd-rl" style="font-weight:600;color:var(--tx)">Total amount</span><span style="font-family:'DM Mono',monospace;color:var(--ac);font-size:15px;font-weight:500">${pc.currency} ${pc.amount.toLocaleString()}</span></div>
      <div class="bd-row"><span class="bd-rl">Status</span><span class="pc-status ${pc.status}">${PC_LABELS[pc.status]}</span></div>
      ${pc.paymentDate?`<div class="bd-row"><span class="bd-rl">Paid on</span><span style="font-family:'DM Mono',monospace">${pc.paymentDate}</span></div>`:''}
    </div>
    <div class="bd-sec">
      <div class="bd-sec-t">Breakdown by type</div>
      ${Object.entries(byType).map(([type,d])=>`
        <div class="bd-row">
          <span class="bd-rl"><span class="type-pill ${typeClass[type]||'service'}" style="font-size:9px">${type}</span></span>
          <span style="font-family:'DM Mono',monospace">${d.count} session${d.count>1?'s':''} · ${d.hours}h</span>
        </div>`).join('') || `<div class="bd-row"><span style="color:var(--mu2)">No session data</span></div>`}
    </div>
    ${sessions.length?`
    <div class="bd-sec">
      <div class="bd-sec-t">Sessions (${sessions.length})</div>
      ${sessions.map(s=>`
        <div class="bd-row">
          <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--mu2)">${s.date}</span>
          <span style="flex:1;padding:0 10px;color:var(--mu)">${s.entity}</span>
          <span><span class="type-pill ${typeClass[s.type]||'service'}" style="font-size:9px">${s.type}</span></span>
          <span style="font-family:'DM Mono',monospace;margin-left:8px;color:var(--mu)">${s.hours}h</span>
        </div>`).join('')}
    </div>`:''}
    ${pc.notes?`<div style="padding:10px 13px;font-size:11px;color:var(--mu);background:var(--sf2);border:1px solid var(--b);border-radius:var(--rs)">📝 ${pc.notes}</div>`:''}`;

  document.getElementById('bd-footer').innerHTML = act
    ? `<button class="btn-primary${act.next==='paid'?'':''}" style="flex:1" onclick="advancePc('${pcId}')">${act.label}</button>
       <button class="btn-cancel" onclick="closeBd()">Close</button>`
    : `<div style="flex:1;font-size:12px;color:var(--gn);display:flex;align-items:center;gap:5px">✓ All settled</div>
       <button class="btn-cancel" onclick="closeBd()">Close</button>`;
}


// ═══════════════════════════════════════════════════════════
// FILTERS & NAV
// ═══════════════════════════════════════════════════════════
function toggleF(k,btn){filters.has(k)?filters.delete(k):filters.add(k);btn.classList.toggle('on',filters.has(k));render();}
function doSearch(q){search=q;render();}
function setView(v){
  view=v;
  document.getElementById('vb-k').classList.toggle('cur',v==='kanban');
  document.getElementById('vb-l').classList.toggle('cur',v==='list');
  document.getElementById('kanban-view').classList.toggle('hidden',v!=='kanban');
  document.getElementById('list-view').classList.toggle('hidden',v!=='list');
  render();
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function toggleMod(){document.getElementById('mod-dd').classList.toggle('open');}
function goModule(m){
  document.getElementById('mod-dd').classList.remove('open');
  if(m==='workload') window.open('workload.html','_self');
  else if(m==='payments') window.open('payments.html','_self');
  else if(m==='portal') window.open('clients-portal.html','_self');
  else showToast(`${m.charAt(0).toUpperCase()+m.slice(1)} — coming soon`,'info');
}
document.addEventListener('click',e=>{if(!e.target.closest('.logo-wrap'))document.getElementById('mod-dd').classList.remove('open');});

// ═══════════════════════════════════════════════════════════
// SUPABASE MAPPING & INIT
// ═══════════════════════════════════════════════════════════
function mapDeal(d) {
  return {
    ...d,
    clientId:        d.client_id,
    vendorId:        d.primary_vendor_id,
    managerId:       d.owner_vendor_id,
    productId:       d.product_id,
    fulfillment:     d.sales_status,
    billing:         d.billing_status,
    // Normalise vat_pct → vat so render helpers using d.vat still work
    vat:             d.vat_pct ?? d.vat ?? 0,
    vatMode:         d.vat_mode || 'excl',
    processor:       d.payment_processor || d.processor || null,
  }
}

function mapVendor(v) {
  const colors = ['#c8b87a','#4caf82','#5a9de0','#a07de0','#e0a040','#3dbfb0','#e05a5a']
  const bgs    = ['#2a2410','#1a2e24','#1a2233','#221a33','#2e2210','#0f2826','#2e1a1a']
  // Prefer full_name; fallback to name for compatibility
  const displayName = v.full_name || v.name || ''
  const idx = displayName.charCodeAt(0) % colors.length
  return {
    ...v,
    name:     displayName,
    initials: displayName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2),
    color:    colors[idx],
    bg:       bgs[idx],
    salaryMethod: v.salary_method,
    calLink:  v.cal_link,
    contractLink: v.contract_url || v.contract_link,
    // Prefer new field names from getVendors() mapping
    clients:  v.clients || v.students || [],
    // TEMP COMPAT: normalise to array of IDs so renderVendors can call getC(id)
    students: (v.clients || v.students || []).map(x => typeof x === 'object' && x !== null ? x.id : x),
  }
}

function mapClient(c) {
  const colors = ['#4caf82','#5a9de0','#c06edd','#e0a040','#e05a5a','#3dbfb0','#a07de0']
  const bgs    = ['#1a2e24','#1a2233','#2a1a33','#2e2210','#2e1a1a','#0f2826','#221a33']
  // Prefer full_name; fallback to name
  const displayName = c.full_name || c.name || ''
  const idx = (displayName.charCodeAt(0) || 0) % colors.length
  const deals = c.deals || []
  const totalValue = c.totalValue != null
    ? c.totalValue
    : deals.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0)
  const paidValue = c.paidValue != null
    ? c.paidValue
    : deals
      .filter(d => (d.billing_status || d.billing) === 'paid')
      .reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0)
  return {
    ...c,
    name:     displayName,
    initials: displayName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2),
    color:    colors[idx],
    bg:       bgs[idx],
    deals,
    dealCount: c.dealCount != null ? c.dealCount : deals.length,
    totalValue,
    paidValue,
    outstandingValue: c.outstandingValue != null ? c.outstandingValue : (totalValue - paidValue),
    clientKind: c.client_kind || c.clientKind || 'private',
    paymentStatus:   c.payment_status,
    packageSize:     c.package_size,
    sessionsUsed:    c.sessions_used    || c.lessons_used    || 0,
    sessionsRemaining: (c.package_size  || 0) - (c.sessions_used || c.lessons_used || 0),
    // TEMP COMPAT aliases
    lessonsUsed:      c.sessions_used   || c.lessons_used    || 0,
    lessonsRemaining: (c.package_size   || 0) - (c.sessions_used || c.lessons_used || 0),
  }
}

function mapPaycheck(pc) {
  return {
    ...pc,
    vendorId:    pc.vendor_id,
    totalHours:  parseFloat(pc.total_hours),
    paymentDate: pc.payment_date,
  }
}

async function loadData() {
  try {
    const [clients, vendors, managers, products, deals, paychecks] = await Promise.all([
      getClientsWithMeta(),
      getVendors(),
      getManagers(), // TEMP COMPAT: legacy managers table; owner logic migrating to vendor records
      getProducts(),
      getDeals(),
      getPaychecks(),
    ])
    CLIENTS     = clients.map(mapClient)
    VENDORS     = vendors.map(mapVendor)
    VENDORS_EXT = VENDORS
    MANAGERS    = managers.map(m => {
      const colors = ['#c8b87a','#4caf82','#5a9de0','#a07de0','#e0a040','#3dbfb0','#e05a5a']
      const bgs    = ['#2a2410','#1a2e24','#1a2233','#221a33','#2e2210','#0f2826','#2e1a1a']
      const n = m.full_name || m.name || ''
      const idx = (n.charCodeAt(0) || 0) % colors.length
      return {
        ...m,
        name: n,
        initials: n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2),
        color: colors[idx],
        bg: bgs[idx],
        role: m.system_role || m.role || '',
        slack: m.slack || null,
      }
    })
    PRODUCTS    = products
    DEALS       = deals.map(mapDeal)
    PAYCHECKS   = paychecks.map(mapPaycheck)
    if (page === 'clients') renderSalesClients()
    else if (page === 'products') renderProducts()
    else if (page === 'vendors') renderVendors()
    else if (page === 'settings') renderSettings()
    else render()

    if (selectedSalesClientId && page === 'clients') {
      await selectSalesClient(selectedSalesClientId, { keepPage: true })
    }
    if (pendingSalesClientId) {
      await openSalesClientFromNavigation(pendingSalesClientId)
      pendingSalesClientId = null
    }
  } catch(err) {
    showToast('Failed to load data: ' + err.message, 'warn')
  }
}

function readSalesRouteContext(){
  const params = new URLSearchParams(window.location.search)
  const pageParam = (params.get('page') || '').toLowerCase()
  if (['deals','clients','products','vendors','vp','settings'].includes(pageParam)) page = pageParam
  const clientId = params.get('clientId')
  if (clientId) pendingSalesClientId = clientId
}

document.addEventListener('DOMContentLoaded', async () => {
  readSalesRouteContext()
  if (page !== 'deals') switchPage(page)
  const clientModal = document.getElementById('sales-client-modal')
  if (clientModal) {
    clientModal.addEventListener('click', e => {
      if (e.target === clientModal) closeSalesClientModal()
    })
  }
  await requireAuth()
  await loadData()
})
