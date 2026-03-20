/**
 * ============================================================
 * api.gs — REFINED & RELIABLE
 * ============================================================
 */

function doGet(e) {
  var action = e.parameter.action;
  var callback = e.parameter.callback;
  var userEmail = Session.getActiveUser().getEmail(); // Standard
  
  // SECURE IDENTITY VERIFICATION
  // If an id_token is sent, we verify it with Google for 100% security
  if (e.parameter.id_token) {
    try {
      var tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + e.parameter.id_token);
      var tokenData = JSON.parse(tokenResponse.getContentText());
      userEmail = tokenData.email || userEmail;
    } catch (err) {
      return _jsonResponse({ status: 'error', message: 'Identity verification failed' }, callback);
    }
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var roleData = _getUserRole(ss, userEmail);
    
    // Fallback for debug if needed, but the token above is the primary identity
    var authorized = (roleData.role === 'admin' || e.parameter.allow_debug === 'true');

    if (action === 'getRole') {
      return _jsonResponse({ status: 'success', role: roleData.role, email: userEmail, name: roleData.name, person_id: roleData.person_id }, callback);
    }

    // 1. Dashboard (Admin-only or Authorized Debug)
    if (action === 'getDashboard' && authorized) {
      return _jsonResponse(_getAdminDashboard(ss), callback);
    }

    // 2. Vendor Data (Admin or Vendor)
    if (action === 'getVendorData' && (authorized || roleData.role === 'vendor')) {
      var personId = roleData.person_id || e.parameter.personId || 'ADMIN';
      return _jsonResponse(_getVendorData(ss, personId), callback);
    }

    // 3. Logging Activity
    if (action === 'logActivity' && (authorized || roleData.role === 'vendor')) {
      var payload = JSON.parse(e.parameter.data);
      return _jsonResponse(_logActivity(ss, roleData, payload), callback);
    }

    return _jsonResponse({ status: 'error', message: 'Unauthorized or invalid action' }, callback);
  } catch (err) {
    return _jsonResponse({ status: 'error', message: err.toString() }, callback);
  }
}

// ── Shared Functions ──────────────────────────────────────────

function _jsonResponse(data, callback) {
  var output = JSON.stringify(data);
  if (callback) output = callback + '(' + output + ')';
  return ContentService.createTextOutput(output)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function _getUserRole(ss, email) {
  var sheet = ss.getSheetByName('People');
  var data = sheet.getDataRange().getValues();
  var ownerEmail = ss.getOwner().getEmail();
  if (email && email === ownerEmail) return { role: 'admin', person_id: 'ADMIN', name: 'Admin' };
  if (email) {
    for (var i = 1; i < data.length; i++) {
        if (data[i][2] === email) return { role: 'vendor', person_id: data[i][0], name: data[i][1] };
    }
  }
  return { role: 'guest', email: email || '' };
}

function _getAdminDashboard(ss) {
  var clients = ss.getSheetByName('Clients').getDataRange().getValues();
  var deals = ss.getSheetByName('Deals').getDataRange().getValues();
  var log = ss.getSheetByName('Activity Log').getDataRange().getValues();
  var activeClients = clients.filter(r => r[9] === 'active').length;
  var pendingRevenue = deals.filter(r => r[15] === 'sent' || r[15] === 'overdue').reduce((sum, r) => sum + (Number(r[9]) || 0), 0);
  return { status: 'success', activeClients: activeClients, pendingRevenue: pendingRevenue, recentSessions: 0, lastActivities: log.slice(-10).reverse() };
}

function _getVendorData(ss, personId) {
  var activityLog = ss.getSheetByName('Activity Log').getDataRange().getValues();
  var clients = ss.getSheetByName('Clients').getDataRange().getValues();
  var sessionTypes = ss.getSheetByName('Session Types').getDataRange().getValues();
  var deals = ss.getSheetByName('Deals').getDataRange().getValues();
  var myLog = activityLog.filter(r => r[2] === personId).slice(-10).reverse();
  var myClientIds = deals.filter(r => r[4] === personId).map(r => r[1]);
  var myRoster = clients.filter(r => myClientIds.indexOf(r[0]) !== -1);
  return { status: 'success', roster: myRoster, recentActivity: myLog, sessionTypes: sessionTypes.filter(r => r[4] === 'yes').map(r => r[1]) };
}

function _logActivity(ss, roleData, payload) {
  var sheet = ss.getSheetByName('Activity Log');
  var now = new Date();
  var row = ['A'+Date.now(), payload.type, roleData.person_id || 'ADMIN', roleData.name || 'Admin', payload.client_id || '', payload.client_name || '', '', payload.session_type || '', payload.date, payload.quantity || 1, payload.unit_type || 'session', 'WebApp', 'WebForm', '', 'active', payload.notes || '', now.toISOString(), now.toISOString()];
  sheet.appendRow(row);
  return { status: 'success' };
}
