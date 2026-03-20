/**
 * ============================================================
 * app.js
 * Core logic for HS CRM Web App.
 * ============================================================
 */

let currentUser = null; // Stores role, email, and ID

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 1. Navigation Setup
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // 2. User & Session Logic
    const btnLogout = document.getElementById('btn-logout');
    btnLogout.addEventListener('click', () => handleLogout());

    // Check for a saved login session
    const storedUser = localStorage.getItem('hs_crm_user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showApp();
    }
}

// Called directly by the Google script tag's onload attribute
window.initGSI = function() {
    google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false
    });
    
    // Explicitly render the button into the specific container
    google.accounts.id.renderButton(
        document.getElementById("g-signin-button"),
        { theme: "outline", size: "large", type: "standard", shape: "pill" }
    );
};

/**
 * Handle the secure token from Google
 */
async function handleCredentialResponse(response) {
    setLoading(true);
    const idToken = response.credential;
    
    try {
        const data = await fetchJSONP('getRole', { id_token: idToken });
        
        if (data.status === 'success' && data.role !== 'guest') {
            currentUser = {
                role: data.role,
                email: data.email,
                person_id: data.person_id || 'ADMIN',
                name: data.name || 'User',
                idToken: idToken // Cache for later requests
            };
            localStorage.setItem('hs_crm_user', JSON.stringify(currentUser));
            showApp();
        } else {
            // FALLBACK: If Google works but they aren't in the sheet
            const payloadDump = JSON.stringify(data);
            const msg = `API URL: ${API_URL.substring(0,40)}...\n\nRaw API Response:\n${payloadDump}\n\nGoogle Token Email: ${data.email}\n\nDo you want to use "Force Admin" for now?`;
            if (confirm(msg)) {
                currentUser = { role: 'admin', email: 'Admin (Manual)', person_id: 'ADMIN', name: 'Manager' };
                localStorage.setItem('hs_crm_user', JSON.stringify(currentUser));
                showApp();
            }
        }
    } catch (err) {
        console.error('Login failed:', err);
    } finally {
        setLoading(false);
    }
}

/**
 * A handy generic JSONP fetcher for other calls
 */
function fetchJSONP(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = `cb_${action}_${Math.floor(Math.random() * 100000)}`;
        window[callbackName] = (data) => {
            document.body.removeChild(script);
            delete window[callbackName];
            resolve(data);
        };
        const script = document.createElement('script');
        
        // Add security tokens/debug flags
        if (currentUser && currentUser.idToken) {
            params.id_token = currentUser.idToken;
        }
        if (currentUser && currentUser.email === 'Admin (Manual)') {
            params.allow_debug = 'true';
        }

        let src = `${API_URL}?action=${action}&callback=${callbackName}`;
        for (let key in params) src += `&${key}=${encodeURIComponent(params[key])}`;
        script.src = src;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

function handleLogout() {
    localStorage.removeItem('hs_crm_user');
    location.reload();
}

// ── App UI Handling ──────────────────────────────────────────

function showApp() {
    document.getElementById('login-screen').classList.add('hide');
    document.getElementById('app-main').classList.remove('hide');
    document.getElementById('user-email').textContent = `${currentUser.name} (${currentUser.role})`;

    // Role-based UI visibility
    if (currentUser.role === 'admin') {
        document.getElementById('tab-admin').classList.remove('hide');
        
        // Add a "Switch View" tool for the admin
        const headerAction = document.querySelector('header .flex.items-center');
        if (!document.getElementById('admin-switcher')) {
            const select = document.createElement('select');
            select.id = 'admin-switcher';
            select.className = 'micro border-gold bg-transparent color-white';
            select.style.padding = '0.2rem';
            select.innerHTML = `
                <option value="ADMIN">View as Admin</option>
                <option value="P001">View as Alice (P001)</option>
                <option value="P002">View as Bob (P002)</option>
            `;
            select.onchange = (e) => {
                const pid = e.target.value;
                currentUser.person_id = pid;
                if (pid === 'ADMIN') {
                    currentUser.role = 'admin';
                    currentUser.name = 'Manager';
                } else {
                    currentUser.role = 'vendor';
                    currentUser.name = e.target.selectedOptions[0].text.split('(')[0].trim();
                }
                document.getElementById('user-email').textContent = `${currentUser.name} (${currentUser.role})`;
                loadVendorPortal();
            };
            headerAction.prepend(select);
        }

        switchTab('dashboard');
        loadAdminDashboard();
    } else {
        document.getElementById('tab-admin').classList.add('hide');
        document.getElementById('user-email').textContent = `${currentUser.name} (${currentUser.role})`;
        switchTab('vendor-portal');
        loadVendorPortal();
    }
}

function switchTab(tabId) {
    // Update nav states
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    
    // Update panel visibility
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));

    // Load fresh data if needed
    if (tabId === 'dashboard') loadAdminDashboard();
    if (tabId === 'vendor-portal') loadVendorPortal();
}

// ── Data Loading: Admin Dashboard ───────────────────────────

async function loadAdminDashboard() {
    if (API_URL.includes('PASTE_YOUR')) return;

    try {
        const data = await fetchJSONP('getDashboard');

        if (data.status === 'success') {
            document.getElementById('stat-clients').textContent = data.activeClients;
            document.getElementById('stat-revenue').textContent = `€${data.pendingRevenue}`;
            document.getElementById('stat-sessions').textContent = data.recentSessions;

            if (data.lastActivities) renderActivityList(data.lastActivities);
        }
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

function renderActivityList(activities) {
    const list = document.getElementById('dashboard-recent-log');
    list.innerHTML = '';

    activities.forEach(item => {
        const div = document.createElement('div');
        div.className = 'activity-item shadow-subtle bg-white';
        div.innerHTML = `
            <div class="stack">
                <span class="body color-espresso" style="font-weight:700">${item[5] || 'Work Session'}</span>
                <span class="micro text-muted">${item[7] || item[15]}</span>
                <span class="meta">${item[8]} · ${item[3]}</span>
            </div>
            <div class="amount h3 color-gold">
                ${item[9]} <span class="micro">${item[10]}</span>
            </div>
        `;
        list.appendChild(div);
    });
}

// ── Data Loading: Vendor Portal ─────────────────────────────

async function loadVendorPortal() {
    if (API_URL.includes('PASTE_YOUR')) return;

    try {
        const data = await fetchJSONP('getVendorData', { personId: currentUser.person_id });

        if (data.status === 'success') {
            renderRoster(data.roster);
            populateFormDropdowns(data.roster, data.sessionTypes);
            if (data.recentActivity) renderVendorHistory(data.recentActivity);
        }
    } catch (err) {
        console.error('Failed to load vendor data:', err);
    }
}

function renderRoster(roster) {
    const list = document.getElementById('vendor-roster-list');
    list.innerHTML = '';
    roster.forEach(client => {
        const div = document.createElement('div');
        div.className = 'roster-chip micro';
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <span>${client[2]}</span>
                <span class="text-muted-sm" style="font-size:0.6rem">${client[10] || ''}</span>
            </div>
        `;
        list.appendChild(div);
    });
}

function populateFormDropdowns(roster, sessionTypes) {
    const clientSelect = document.getElementById('field-client');
    const typeSelect = document.getElementById('field-type');

    clientSelect.innerHTML = '<option value="">-- Choose Client --</option>';
    roster.forEach(c => {
        clientSelect.innerHTML += `<option value="${c[0]}" data-name="${c[2]}">${c[2]}</option>`;
    });

    typeSelect.innerHTML = '<option value="">-- Choose Session Type --</option>';
    sessionTypes.forEach(t => {
        typeSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });
}

// ── Form Submission ──────────────────────────────────────────

const sessionForm = document.getElementById('form-log-session');
sessionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const clientOption = document.getElementById('field-client').selectedOptions[0];
    const payload = {
        type: 'session',
        client_id: document.getElementById('field-client').value,
        client_name: clientOption.dataset.name,
        session_type: document.getElementById('field-type').value,
        date: document.getElementById('field-date').value,
        notes: document.getElementById('field-notes').value,
        quantity: 1,
        unit_type: 'session'
    };

    setLoading(true);
    try {
        // We pack the entire logged session into a 'data' string to send via GET
        const resData = await fetchJSONP('logActivity', { data: JSON.stringify(payload) });
        
        if (resData.status === 'success') {
            showToast('✅ Session Logged!');
            sessionForm.reset();
            loadVendorPortal(); // Refresh list to show the new entry!
        }
    } catch (err) {
        console.error('Logging failed:', err);
        alert('Could not log session. Make sure your spreadsheet is shared correctly.');
    } finally {
        setLoading(false);
    }
});

// ── Utils ────────────────────────────────────────────────────

function setLoading(isLoading) {
    document.getElementById('loader').classList.toggle('hide', !isLoading);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hide');
    setTimeout(() => t.classList.add('hide'), 3000);
}
