/**
 * sync_roster.gs
 * Pulls client data from the Master Clients sheet
 * and pastes as values into the vendor Roster sheet.
 * No live IMPORTRANGE — just a one-time snapshot.
 *
 * Called via custom menu: 🔧 CRM Tools → Sync Roster from Master
 */

function syncRosterFromMaster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var vendorConfig = _getSyncConfig(ss);

  if (!vendorConfig.masterSpreadsheetId ||
       vendorConfig.masterSpreadsheetId === '<PASTE_MASTER_SPREADSHEET_ID_HERE>') {
    SpreadsheetApp.getUi().alert(
      '⚠️ Configuration Error',
      'Please set the Master Spreadsheet ID in your Settings sheet before syncing.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  var rosterSheet = ss.getSheetByName('Roster');
  if (!rosterSheet) {
    SpreadsheetApp.getUi().alert('Error', 'Roster sheet not found.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  try {
    var masterSs = SpreadsheetApp.openById(vendorConfig.masterSpreadsheetId);
    var clientsSheet = masterSs.getSheetByName('Clients');
    if (!clientsSheet) {
      SpreadsheetApp.getUi().alert('Error', 'Clients sheet not found in Master.', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }

    // Read all client data from Master
    var clientData = clientsSheet.getDataRange().getValues();
    if (clientData.length <= 1) {
      ss.toast('No client data found in Master.', '⚠️', 3);
      return;
    }

    // Also check Deals sheet to find which clients are assigned to this vendor
    var dealsSheet = masterSs.getSheetByName('Deals');
    var assignedClientIds = {};
    var clientSessionTypes = {};

    if (dealsSheet) {
      var dealsData = dealsSheet.getDataRange().getValues();
      // Deals headers: deal_id(0), client_id(1), client_type(2), linked_company_id(3),
      //   person_id(4), deal_type(5), description(6) ...
      for (var d = 1; d < dealsData.length; d++) {
        var dealPersonId = String(dealsData[d][4]).trim();
        var dealClientId = String(dealsData[d][1]).trim();
        var dealStatus   = String(dealsData[d][15]).trim();

        if (dealPersonId === vendorConfig.personId && dealStatus !== 'cancelled') {
          assignedClientIds[dealClientId] = true;
          // Use description as a rough session type indicator
          clientSessionTypes[dealClientId] = String(dealsData[d][6]).trim();
        }
      }
    }

    // Also pull from Session Types for better matching
    var sessionTypesSheet = masterSs.getSheetByName('Session Types');
    var sessionTypeNames = {};
    if (sessionTypesSheet) {
      var stData = sessionTypesSheet.getDataRange().getValues();
      for (var s = 1; s < stData.length; s++) {
        sessionTypeNames[stData[s][0]] = stData[s][1]; // id → name
      }
    }

    // Build roster rows: client_id | display_name | email | company | session_type | status
    // Client headers: client_id(0), client_type(1), display_name(2), first_name(3),
    //   last_name(4), company_name(5), email(6), phone(7), linked_company_id(8), status(9)
    var rosterRows = [];
    for (var i = 1; i < clientData.length; i++) {
      var cid = String(clientData[i][0]).trim();
      var clientStatus = String(clientData[i][9]).trim();

      // Include if: client is assigned to this vendor via deals, OR include all active clients
      var isAssigned = assignedClientIds[cid] || false;
      if (!isAssigned) continue;

      var displayName = clientData[i][2];
      var email       = clientData[i][6];
      var company     = clientData[i][5] || '';
      var sessionType = clientSessionTypes[cid] || '';
      var status      = clientStatus;

      // If client is linked to a company, try to get company name
      var linkedCo = String(clientData[i][8]).trim();
      if (linkedCo && !company) {
        for (var j = 1; j < clientData.length; j++) {
          if (String(clientData[j][0]).trim() === linkedCo) {
            company = clientData[j][5] || clientData[j][2];
            break;
          }
        }
      }

      rosterRows.push([cid, displayName, email, company, sessionType, status]);
    }

    // Clear existing roster data (keep header)
    var lastRow = rosterSheet.getLastRow();
    if (lastRow > 1) {
      rosterSheet.getRange(2, 1, lastRow - 1, 6).clearContent();
      rosterSheet.getRange(2, 1, lastRow - 1, 6).setBackground('#F5F5F5');
    }

    // Write new data
    if (rosterRows.length > 0) {
      rosterSheet.getRange(2, 1, rosterRows.length, 6).setValues(rosterRows);
      rosterSheet.getRange(2, 1, rosterRows.length, 6).setBackground('#F5F5F5');
    }

    ss.toast('Roster synced: ' + rosterRows.length + ' clients.', '✅ Sync Complete', 3);

  } catch (err) {
    Logger.log('Sync error: ' + err.message);
    SpreadsheetApp.getUi().alert(
      '❌ Sync Failed',
      'Could not read from Master spreadsheet.\n\nError: ' + err.message +
      '\n\nMake sure you have read access to the Master file.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function _getSyncConfig(ss) {
  var s = ss.getSheetByName('Settings');
  if (!s) return { masterSpreadsheetId: '', personId: '', personName: '' };
  var data = s.getDataRange().getValues();
  var cfg = {};
  for (var i = 0; i < data.length; i++) {
    var k = String(data[i][0]).trim(), v = String(data[i][1]).trim();
    if (k === 'master_spreadsheet_id') cfg.masterSpreadsheetId = v;
    if (k === 'person_id') cfg.personId = v;
    if (k === 'person_name') cfg.personName = v;
  }
  return cfg;
}
