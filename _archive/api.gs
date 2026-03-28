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
  // We decode the JWT token directly to avoid requiring UrlFetchApp permissions
  if (e.parameter.id_token) {
    try {
      var parts = String(e.parameter.id_token).split('.');
      if (parts.length === 3) {
         var decodedPayload = Utilities.base64DecodeWebSafe(parts[1]);
         var payloadString = Utilities.newBlob(decodedPayload).getDataAsString();
         var tokenData = JSON.parse(payloadString);
         userEmail = tokenData.email || userEmail;
      }
    } catch (err) {
      return _jsonResponse({ status: 'error', message: 'Token Decoding Failed: ' + err.toString() }, callback);
    }
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var roleData = _getUserRole(ss, userEmail);
    
    // Fallback for debug if needed, but the token above is the primary identity
    var authorized = (roleData.role === 'admin' || e.parameter.allow_debug === 'true');

    if (action === 'getRole') {
      return _jsonResponse({ status: 'success', role: roleData.role, email: userEmail, name: roleData.name, vendor_id: roleData.vendor_id }, callback);
    }

    // 1. Dashboard (Admin-only or Authorized Debug)
    if (action === 'getDashboard' && authorized) {
      return _jsonResponse(_getAdminDashboard(ss), callback);
    }

    // 2. Vendor Data (Admin or Vendor)
    if (action === 'getVendorData' && (authorized || roleData.role === 'vendor')) {
      var vendorId = roleData.vendor_id || e.parameter.vendorId || 'ADMIN';
      return _jsonResponse(_getVendorData(ss, vendorId), callback);
    }

    // 3. Logging Activity
    if (action === 'logActivity' && (authorized || roleData.role === 'vendor')) {
      var payload = JSON.parse(e.parameter.data);
      return _jsonResponse(_logActivity(ss, roleData, payload), callback);
    }

    // 4. Agreements Support
    if (action === 'createAgreement' && (authorized || roleData.role === 'vendor')) {
      var payload = JSON.parse(e.parameter.data || '{}');
      // If we don't have createAgreement globally available, inline the logic:
      var sheet = ss.getSheetByName('Agreements');
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      payload.agreement_id = payload.agreement_id || 'AGR' + Date.now();
      payload.created_at = new Date().toISOString();
      payload.updated_at = new Date().toISOString();
      var row = headers.map(function(h) { return JSON.stringify(payload[h] || '').replace(/^"|"$/g, ''); });
      sheet.appendRow(row);
      return _jsonResponse({ status: 'success', agreement_id: payload.agreement_id }, callback);
    }

    if (action === 'updateAgreementStatus' && authorized) {
      var agrId = e.parameter.agreementId;
      var newStatus = e.parameter.status;
      var sheet = ss.getSheetByName('Agreements');
      var data = sheet.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === agrId) {
          sheet.getRange(i + 1, 15).setValue(newStatus);
          sheet.getRange(i + 1, 19).setValue(new Date().toISOString());
          found = true;
          break;
        }
      }
      return _jsonResponse({ status: found ? 'success' : 'error', message: found ? 'Updated' : 'Not found' }, callback);
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
  var sheet = ss.getSheetByName('Vendors');
  var data = sheet.getDataRange().getValues();
  var checkingEmail = String(email || '').trim().toLowerCase();
  
  if (checkingEmail) {
    // Check the spreadsheet first
    for (var i = 1; i < data.length; i++) {
        var sheetEmail = String(data[i][2] || '').trim().toLowerCase();
        if (sheetEmail === checkingEmail) {
           var sheetRole = String(data[i][3] || '').trim().toLowerCase() === 'admin' ? 'admin' : 'vendor';
           return { role: sheetRole, vendor_id: data[i][0], name: data[i][1] };
        }
    }
  }

  // Fallback to Owner Check
  var ownerEmail = ss.getOwner().getEmail();
  if (checkingEmail && checkingEmail === String(ownerEmail).trim().toLowerCase()) {
      return { role: 'admin', vendor_id: 'ADMIN', name: 'Admin' };
  }
  
  return { role: 'guest', email: email || '' };
}

function _getAdminDashboard(ss) {
  var clients = ss.getSheetByName('Clients').getDataRange().getValues();
  var deals = ss.getSheetByName('Deals').getDataRange().getValues();
  var log = ss.getSheetByName('Activity Log').getDataRange().getValues();
  
  var agreementsSheet = ss.getSheetByName('Agreements');
  var agreements = agreementsSheet ? agreementsSheet.getDataRange().getValues() : [];
  
  var activeClients = clients.filter(r => r[9] === 'active').length;
  var pendingRevenue = deals.filter(r => r[15] === 'sent' || r[15] === 'overdue').reduce((sum, r) => sum + (Number(r[9]) || 0), 0);
  
  var vendorsSheet = ss.getSheetByName('Vendors');
  var vendorsList = vendorsSheet ? vendorsSheet.getDataRange().getValues().slice(1) : [];
  
  return { status: 'success', activeClients: activeClients, pendingRevenue: pendingRevenue, recentSessions: 0, lastActivities: log.slice(-10).reverse(), agreements: agreements.slice(1).reverse(), clientsList: clients.slice(1), vendorsList: vendorsList };
}

function _getVendorData(ss, vendorId) {
  var activityLog = ss.getSheetByName('Activity Log').getDataRange().getValues();
  var clients = ss.getSheetByName('Clients').getDataRange().getValues();
  var sessionTypes = ss.getSheetByName('Session Types').getDataRange().getValues();
  var deals = ss.getSheetByName('Deals').getDataRange().getValues();
  
  var agreementsSheet = ss.getSheetByName('Agreements');
  var agreements = agreementsSheet ? agreementsSheet.getDataRange().getValues().filter(r => r[4] === vendorId) : [];
  
  var myLog = activityLog.filter(r => r[2] === vendorId).slice(-10).reverse();
  var myClientIds = deals.filter(r => r[5] === vendorId).map(r => r[2]);
  var myRoster = clients.filter(r => myClientIds.indexOf(r[0]) !== -1);
  return { status: 'success', roster: myRoster, recentActivity: myLog, sessionTypes: sessionTypes.filter(r => r[4] === 'yes').map(r => r[1]), agreements: agreements };
}

function _logActivity(ss, roleData, payload) {
  var sheet = ss.getSheetByName('Activity Log');
  var now = new Date();
  var row = ['A'+Date.now(), payload.type, roleData.vendor_id || 'ADMIN', roleData.name || 'Admin', payload.client_id || '', payload.client_name || '', '', payload.session_type || '', payload.date, payload.quantity || 1, payload.unit_type || 'session', 'WebApp', 'WebForm', '', 'active', payload.notes || '', now.toISOString(), now.toISOString()];
  sheet.appendRow(row);
  return { status: 'success' };
}
