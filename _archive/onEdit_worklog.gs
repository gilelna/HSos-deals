/**
 * onEdit_worklog.gs
 * Handles edits on the "Work Log" sheet.
 * When vendor enters/changes/clears a date in column A:
 *   → Appends row to Activity Log in Master (append-only)
 *   → Sets status column (E) in Work Log
 *
 * Statuses: active (new), updated (changed), deleted (cleared)
 */

function onEditWorkLog(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== 'Work Log') return;

  var editedCol = e.range.getColumn();
  var editedRow = e.range.getRow();
  if (editedCol !== 1 || editedRow < 2) return;

  var newValue = e.range.getValue();
  var oldValue = e.oldValue || '';

  var entryStatus;
  if (!newValue && newValue !== 0) {
    entryStatus = 'deleted';
  } else if (oldValue !== '' && oldValue !== null) {
    entryStatus = 'updated';
  } else {
    entryStatus = 'active';
  }

  var rowData = sheet.getRange(editedRow, 1, 1, 5).getValues()[0];
  var dateValue = rowData[0];
  var workType  = rowData[1];
  var hours     = rowData[2];
  var notes     = rowData[3];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var vendorConfig = _getVendorConfigWL(ss);

  if (!vendorConfig.masterSpreadsheetId ||
       vendorConfig.masterSpreadsheetId === '<PASTE_MASTER_SPREADSHEET_ID_HERE>') {
    sheet.getRange(editedRow, 5).setValue('⚠ master not linked');
    ss.toast('Set Master Spreadsheet ID in Settings.', '⚠️ Error', 5);
    return;
  }

  try {
    var masterSs = SpreadsheetApp.openById(vendorConfig.masterSpreadsheetId);
    var activityLog = masterSs.getSheetByName('Activity Log');
    if (!activityLog) {
      sheet.getRange(editedRow, 5).setValue('⚠ Activity Log not found');
      return;
    }

    var activityId = _getNextActivityIdWL(activityLog);
    var now = new Date().toISOString();

    var formattedDate = '';
    if (dateValue instanceof Date) {
      formattedDate = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else if (dateValue) {
      formattedDate = String(dateValue);
    }
    if (entryStatus === 'deleted' && oldValue) formattedDate = String(oldValue);

    var logRow = [
      activityId, 'work', vendorConfig.vendorId, vendorConfig.vendorName,
      '', '', '', workType, formattedDate,
      hours || 0, 'hour', ss.getId(), 'Work Log', 'A' + editedRow,
      entryStatus, notes, now, now
    ];

    activityLog.appendRow(logRow);

    var statusText = entryStatus === 'active' ? 'logged' : entryStatus;
    sheet.getRange(editedRow, 5).setValue(statusText);
    sheet.getRange(editedRow, 5).setBackground('#F5F5F5');
    ss.toast('Work ' + statusText + ' → Activity Log (' + activityId + ')', '✅', 3);

  } catch (err) {
    Logger.log('Error: ' + err.message);
    sheet.getRange(editedRow, 5).setValue('⚠ sync failed');
    ss.toast('Sync error: ' + err.message, '❌', 5);
  }
}

/**
 * Combined onEdit dispatcher — install as an INSTALLABLE trigger.
 * Admin creates this trigger so it runs under admin's account.
 *
 * To set up: In the vendor spreadsheet's script editor →
 *   Triggers (clock icon) → Add Trigger →
 *   Function: onEditInstallable | Event: On edit
 */
function onEditInstallable(e) {
  if (!e || !e.range) return;
  var sheetName = e.range.getSheet().getName();
  if (sheetName === 'Sessions Log') onEditSessionsLog(e);
  else if (sheetName === 'Work Log') onEditWorkLog(e);
}

function _getVendorConfigWL(ss) {
  var s = ss.getSheetByName('Settings');
  if (!s) return { masterSpreadsheetId: '', vendorId: '', vendorName: '' };
  var data = s.getDataRange().getValues();
  var cfg = {};
  for (var i = 0; i < data.length; i++) {
    var k = String(data[i][0]).trim(), v = String(data[i][1]).trim();
    if (k === 'master_spreadsheet_id') cfg.masterSpreadsheetId = v;
    if (k === 'vendor_id') cfg.vendorId = v;
    if (k === 'vendor_name') cfg.vendorName = v;
  }
  return cfg;
}

function _getNextActivityIdWL(sheet) {
  var last = sheet.getLastRow();
  if (last <= 1) return 'A001';
  var lastId = sheet.getRange(last, 1).getValue();
  if (!lastId || typeof lastId !== 'string') return 'A001';
  var num = parseInt(lastId.replace(/^A/, ''), 10);
  if (isNaN(num)) return 'A001';
  return 'A' + ('000' + (num + 1)).slice(-3);
}
