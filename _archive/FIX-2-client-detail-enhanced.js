// ════════════════════════════════════════════════════════════════
// FIX #2: Enhanced Client Detail View
// ════════════════════════════════════════════════════════════════
// 
// FILE: workload.js
// LINE: ~330 (search for "function showClientDetail")
// ACTION: REPLACE the entire showClientDetail function with this version
//
// WHAT THIS ADDS:
// - Deals section (shows which deal the client is under)
// - Packages section (shows all packages with progress bars)
// - Better visual hierarchy
//
// ════════════════════════════════════════════════════════════════

async function showClientDetail(clientId, evt) {
  document.querySelectorAll('.client-list-item').forEach(el => el.classList.remove('sel'))
  if (evt?.currentTarget) evt.currentTarget.classList.add('sel')

  const client = _clients.find(c => c.id === clientId)
  if (!client) return

  // 🆕 Load deals and packages for this client
  let clientDeals = []
  let clientPackages = []
  try {
    const [deals, packages] = await Promise.all([
      getDeals({ client_id: clientId }),
      getPackages({ client_id: clientId, vendor_id: _vendor.id })
    ])
    clientDeals = deals || []
    clientPackages = packages || []
  } catch(e) {
    console.error('[HSos] load client deals/packages error:', e)
  }

  const clientSessions = _sessions.filter(s => s.client_id === clientId)
  const month = new Date().toISOString().slice(0, 7)
  const thisMonthSessions = clientSessions.filter(s => s.session_date?.startsWith(month))
  const totalMin = clientSessions.reduce((s, x) => s + (parseInt(x.duration_min) || 0), 0)
  const totalH   = totalMin / 60
  const pkg      = client.active_package
  const detail   = document.getElementById('client-detail')

  detail.innerHTML = `
    <div style="padding:20px 20px 16px;border-bottom:1px solid var(--border2);display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div style="font-family:var(--font-serif);font-size:20px;font-weight:700;color:var(--ink);line-height:1.15">${client.full_name}</div>
        ${client.email ? `<div style="font-size:12px;color:var(--mu2);margin-top:2px">${client.email}</div>` : ''}
      </div>
      <div class="av av-lg" style="background:${avatarBg(client.full_name)};color:${avatarFg(client.full_name)}">
        ${initials(client.full_name)}
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:16px 20px">

      ${clientDeals.length ? `
        <div class="sp-section-title">Deals</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${clientDeals.map(d => `
            <div style="padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface)">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${d.products?.name || 'Custom Deal'}</div>
              <div style="display:flex;gap:8px;font-size:11px;align-items:center">
                <span class="pill">${d.sales_status}</span>
                <span class="pill">${d.billing_status}</span>
                <span style="color:var(--mu2);font-family:var(--font-mono)">€${parseFloat(d.price || 0).toLocaleString('en', {minimumFractionDigits:2})}</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${clientPackages.length ? `
        <div class="sp-section-title">Packages</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${clientPackages.map(p => {
            const pct = (p.sessions_used / p.total_sessions) * 100
            const statusColor = p.status === 'active' ? 'var(--green)' : p.status === 'completed' ? 'var(--mu2)' : 'var(--red)'
            return `
              <div style="padding:10px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span style="font-weight:600;font-size:13px">${p.sessions_used} / ${p.total_sessions} sessions</span>
                  <span style="font-size:11px;color:${statusColor};text-transform:capitalize">${p.status}</span>
                </div>
                <div style="height:4px;background:var(--border2);border-radius:4px;overflow:hidden">
                  <div style="height:100%;background:${statusColor};width:${pct}%"></div>
                </div>
              </div>
            `
          }).join('')}
        </div>
      ` : ''}

      <div class="sp-section-title">Overview</div>
      <div style="display:flex;gap:10px;margin-bottom:12px">
        <div class="stat-card" style="flex:1;padding:12px 14px">
          <div class="stat-val" style="font-size:28px">${totalH % 1 === 0 ? totalH : totalH.toFixed(1)}</div>
          <div class="stat-label">Total hours</div>
        </div>
        <div class="stat-card" style="flex:1;padding:12px 14px">
          <div class="stat-val" style="font-size:28px">${clientSessions.length}</div>
          <div class="stat-label">Sessions</div>
        </div>
        ${pkg ? `
        <div class="stat-card" style="flex:1;padding:12px 14px">
          <div class="stat-val" style="font-size:28px;color:var(--green)">${pkg.sessions_used}/${pkg.total_sessions}</div>
          <div class="stat-label">Package used</div>
        </div>
        ` : ''}
      </div>

      <div class="sp-section-title">This month</div>
      ${thisMonthSessions.length ? `
        <div class="block">
          <table class="tbl">
            <thead>
              <tr><th>Date</th><th>Duration</th><th>Type</th><th>Package</th><th>Notes</th></tr>
            </thead>
            <tbody>
              ${thisMonthSessions.map(s => `
                <tr onclick="openEditSession('${s.id}')" title="Click to edit" style="cursor:pointer">
                  <td class="mono">${formatDate(s.session_date)}</td>
                  <td class="mono">${_fmtDuration(s.duration_min)}</td>
                  <td>${s.session_type || '—'}</td>
                  <td>${_pkgBadge(s)}</td>
                  <td style="color:var(--mu2);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.notes || '<span style="color:var(--border)">add note…</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div style="font-size:12px;color:var(--mu2);padding:8px 0">No sessions this month</div>`}

      ${client.notes ? `
        <div class="sp-section-title">Notes</div>
        <div style="font-size:13px;color:var(--ink);line-height:1.5">${client.notes}</div>
      ` : ''}
    </div>
  `
}
window.showClientDetail = showClientDetail
