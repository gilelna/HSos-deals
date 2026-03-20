/**
 * ============================================================
 * onEdit_sessions.gs
 * Handles edits on the "Sessions Log" sheet.
 *
 * When a vendor enters/changes/clears a date in column C:
 *   → Appends a new row to the Activity Log in the Master
 *   → Sets the status column (E) in Sessions Log
 *
 * Activity Log is APPEND-ONLY — no rows are ever edited.
 *   - New date entered    → status "active"
 *   - Date changed        → status "updated"  (original row kept)
 *   - Date cleared        → status "deleted"   (original row kept)
 * ============================================================
 */

/**
 * onEdit trigger — must be installed as a simple trigger or
 * installable trigger on the vendor spreadsheet.
 *
 * IMPORTANT: This function name is `onEdit`. If you also have
 * onEdit_worklog.gs, combine both into a single onEdit() that
 * dispatches by sheet name. See the README for details.
 */
function onEditSessionsLog(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  if (sheet.getName() !== 'Sessions Log') return;

  var editedCol = e.range.getColumn();
  var editedRow = e.range.getRow();

  // Only react to edits in the DATE column (C = column 3)
  if (editedCol !== 3) return;
  // Ignore header row
  if (editedRow < 2) return;

  var newValue = e.range.getValue();
  var oldValue = e.oldValue || '';

  // Determine the entry status
  var entryStatus;
  if (newValue === '' || newValue === null || newValue === undefined) {
    // Date was cleared
    entryStatus = 'deleted';
  } else if (oldValue !== '' && oldValue !== null && oldValue !== undefined) {
    // Date was changed from one value to another
    entryStatus = 'updated';
  } else {
    // Date was newly entered (was blank before)
    entryStatus = 'active';
  }

  // Read the row data from Sessions Log
  var rowData = sheet.getRange(editedRow, 1, 1, 5).getValues()[0];
  var clientName  = rowData[0]; // col A
  var sessionType = rowData[1]; // col B
  var dateValue   = rowData[2]; // col C (the date just entered/changed)
  var notes       = rowData[3]; // col D

  // Get vendor info from Settings sheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var vendorConfig = _getVendorConfig(ss);

  if (!vendorConfig.masterSpreadsheetId ||
       vendorConfig.masterSpreadsheetId === '<PASTE_MASTER_SPREADSHEET_ID_HERE>') {
    // Update status column to show error
    sheet.getRange(editedRow, 5).setValue('⚠ master not linked');
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Please set the Master Spreadsheet ID in the Settings sheet.',
      '⚠️ Configuration Error', 5
    );
    return;
  }

  // Try to write to Master Activity Log
  try {
    var masterSs = SpreadsheetApp.openById(vendorConfig.masterSpreadsheetId);
    var activityLog = masterSs.getSheetByName('Activity Log');

    if (!activityLog) {
      sheet.getRange(editedRow, 5).setValue('⚠ Activity Log not found');
      return;
    }

    // Generate next activity_id
    var activityId = _getNextActivityId(activityLog);
    var now = new Date().toISOString();

    // Resolve client_id from Master Clients sheet
    var clientId = '';
    var linkedCompanyId = '';
    try {
      var clientsSheet = masterSs.getSheetByName('Clients');
      if (clientsSheet) {
        var clientData = clientsSheet.getDataRange().getValues();
        for (var i = 1; i < clientData.length; i++) {
          if (clientData[i][2] === clientName) { // display_name is col C (index 2)
            clientId = clientData[i][0];          // client_id
            linkedCompanyId = clientData[i][8];   // linked_company_id
            break;
          }
        }
      }
    } catch (lookupErr) {
      Logger.log('Could not look up client: ' + lookupErr.message);
    }

    // Format the date for Activity Log
    var formattedDate = '';
    if (dateValue instanceof Date) {
      formattedDate = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else if (dateValue) {
      formattedDate = String(dateValue);
    }

    // If status is "deleted", we still log the original date from oldValue
    if (entryStatus === 'deleted' && oldValue) {
      formattedDate = String(oldValue);
    }

    // Build the Activity Log row
    // activity_id | entry_type | person_id | person_name | client_id | client_name |
    // linked_company_id | session_type | activity_date | quantity | unit_type |
    // source_file_id | source_sheet | source_cell | status | notes | created_at | updated_at
    var logRow = [
      activityId,
      'session',
      vendorConfig.personId,
      vendorConfig.personName,
      clientId,
      clientName,
      linkedCompanyId,
      sessionType,
      formattedDate,
      1,                              // quantity — 1 session
      'session',                      // unit_type
      ss.getId(),                     // source_file_id
      'Sessions Log',                 // source_sheet
      'C' + editedRow,               // source_cell
      entryStatus,                    // status
      notes,                          // notes
      now,                            // created_at
      now                             // updated_at
    ];

    // Append to Activity Log
    activityLog.appendRow(logRow);

    // Update status column in Sessions Log
    var statusText = entryStatus === 'active' ? 'logged'
                   : entryStatus === 'updated' ? 'updated'
                   : 'deleted';
    sheet.getRange(editedRow, 5).setValue(statusText);
    sheet.getRange(editedRow, 5).setBackground(V_READONLY_BG || '#F5F5F5');

    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Session ' + statusText + ' → Activity Log (' + activityId + ')',
      '✅ Synced', 3
    );

  } catch (err) {
    Logger.log('Error writing to Master: ' + err.message);
    sheet.getRange(editedRow, 5).setValue('⚠ sync failed');
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Could not write to Master: ' + err.message,
      '❌ Sync Error', 5
    );
  }
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

/**
 * Read vendor configuration from the Settings sheet.
 */
function _getVendorConfig(ss) {
  var settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) {
    return { masterSpreadsheetId: '', personId: '', personName: '' };
  }
  var data = settingsSheet.getDataRange().getValues();
  var config = {};
  for (var i = 0; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var val = String(data[i][1]).trim();
    if (key === 'master_spreadsheet_id') config.masterSpreadsheetId = val;
    if (key === 'person_id')             config.personId = val;
    if (key === 'person_name')           config.personName = val;
  }
  return config;
}

/**
 * Generate the next activity ID (A001, A002, ...) by reading
 * the last row in the Activity Log.
 */
function _getNextActivityId(activityLogSheet) {
  var lastRow = activityLogSheet.getLastRow();
  if (lastRow <= 1) return 'A001';

  var lastId = activityLogSheet.getRange(lastRow, 1).getValue();
  if (!lastId || typeof lastId !== 'string') return 'A001';

  var num = parseInt(lastId.replace(/^A/, ''), 10);
  if (isNaN(num)) return 'A001';

  var next = num + 1;
  return 'A' + ('000' + next).slice(-3);
}
