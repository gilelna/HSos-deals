/**
 * monthly_summary.gs
 * Recalculates the Monthly Summary sheet from the
 * Master Activity Log, filtered by vendor_id + month + status=active.
 *
 * Called via custom menu: 🔧 CRM Tools → Recalculate Monthly Summary
 */

function recalculateMonthlySummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var vendorConfig = _getSummaryConfig(ss);

  if (!vendorConfig.masterSpreadsheetId ||
       vendorConfig.masterSpreadsheetId === '<PASTE_MASTER_SPREADSHEET_ID_HERE>') {
    SpreadsheetApp.getUi().alert(
      '⚠️ Configuration Error',
      'Set the Master Spreadsheet ID in Settings first.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  var summarySheet = ss.getSheetByName('Monthly Summary');
  if (!summarySheet) {
    SpreadsheetApp.getUi().alert('Error', 'Monthly Summary sheet not found.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  // Determine current month (YYYY-MM)
  var now = new Date();
  var currentMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');

  // Ask user which month to calculate (default: current)
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    '📅 Select Month',
    'Enter month to calculate (YYYY-MM format).\nDefault: ' + currentMonth,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.CANCEL) return;

  var targetMonth = response.getResponseText().trim() || currentMonth;
  // Validate format
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    ui.alert('Invalid format. Use YYYY-MM (e.g. 2026-01).');
    return;
  }

  try {
    var masterSs = SpreadsheetApp.openById(vendorConfig.masterSpreadsheetId);
    var activityLog = masterSs.getSheetByName('Activity Log');
    if (!activityLog) {
      ui.alert('Error', 'Activity Log not found in Master.', ui.ButtonSet.OK);
      return;
    }

    var logData = activityLog.getDataRange().getValues();
    // Activity Log headers (row 0):
    // 0:activity_id 1:entry_type 2:vendor_id 3:vendor_name
    // 4:client_id 5:client_name 6:linked_company_id 7:session_type
    // 8:activity_date 9:quantity 10:unit_type 11:source_file_id
    // 12:source_sheet 13:source_cell 14:status 15:notes 16:created_at 17:updated_at

    // Filter: vendor_id matches AND month matches AND status = 'active'
    var sessions = {};  // key: session_type + '|' + client_name → { count, hours, unit }
    var workEntries = {}; // key: work_type → { count, hours }

    for (var i = 1; i < logData.length; i++) {
      var row = logData[i];
      var vendorId   = String(row[2]).trim();
      var entryType  = String(row[1]).trim();
      var dateStr    = '';
      var status     = String(row[14]).trim();

      // Only include 'active' entries for this vendor
      if (vendorId !== vendorConfig.vendorId) continue;
      if (status !== 'active') continue;

      // Parse date to check month
      if (row[8] instanceof Date) {
        dateStr = Utilities.formatDate(row[8], Session.getScriptTimeZone(), 'yyyy-MM');
      } else {
        dateStr = String(row[8]).substring(0, 7); // 'YYYY-MM'
      }
      if (dateStr !== targetMonth) continue;

      var sessionType = String(row[7]).trim();
      var quantity    = Number(row[9]) || 0;
      var unitType    = String(row[10]).trim();
      var clientName  = String(row[5]).trim();

      if (entryType === 'session') {
        var key = sessionType + '|' + clientName;
        if (!sessions[key]) {
          sessions[key] = { sessionType: sessionType, clientName: clientName, count: 0, hours: 0, unitType: unitType };
        }
        sessions[key].count += quantity;
        sessions[key].hours += quantity;
      } else if (entryType === 'work') {
        if (!workEntries[sessionType]) {
          workEntries[sessionType] = { count: 0, hours: 0 };
        }
        workEntries[sessionType].count += 1;
        workEntries[sessionType].hours += quantity;
      }
    }

    // Build output rows: month | session_type | client_name | total_sessions | total_hours | unit_type
    var outputRows = [];

    // Sessions grouped by type + client
    var sessionKeys = Object.keys(sessions).sort();
    for (var s = 0; s < sessionKeys.length; s++) {
      var entry = sessions[sessionKeys[s]];
      outputRows.push([
        targetMonth, entry.sessionType, entry.clientName,
        entry.count, entry.hours, entry.unitType
      ]);
    }

    // Work entries
    var workKeys = Object.keys(workEntries).sort();
    for (var w = 0; w < workKeys.length; w++) {
      var we = workEntries[workKeys[w]];
      outputRows.push([
        targetMonth, '— ' + workKeys[w] + ' —', '(work)',
        we.count, we.hours, 'hour'
      ]);
    }

    // Clear existing data (keep header)
    var lastRow = summarySheet.getLastRow();
    if (lastRow > 1) {
      summarySheet.getRange(2, 1, lastRow - 1, 6).clearContent();
      summarySheet.getRange(2, 1, lastRow - 1, 6).clearFormat();
    }

    // Write new data
    if (outputRows.length > 0) {
      summarySheet.getRange(2, 1, outputRows.length, 6).setValues(outputRows);
      summarySheet.getRange(2, 1, outputRows.length, 6).setBackground('#F5F5F5');

      // Add totals row
      var totalRow = outputRows.length + 3;
      summarySheet.getRange(totalRow, 1).setValue('TOTALS');
      summarySheet.getRange(totalRow, 1).setFontWeight('bold');
      var lastDataRow = outputRows.length + 1;
      summarySheet.getRange(totalRow, 4).setFormula('=SUM(D2:D' + lastDataRow + ')');
      summarySheet.getRange(totalRow, 5).setFormula('=SUM(E2:E' + lastDataRow + ')');
    } else {
      summarySheet.getRange(2, 1).setValue('No activity found for ' + targetMonth);
    }

    ss.toast('Summary calculated for ' + targetMonth + ' (' + outputRows.length + ' rows).', '✅', 3);

  } catch (err) {
    Logger.log('Summary error: ' + err.message);
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      'Could not read Activity Log.\n\n' + err.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function _getSummaryConfig(ss) {
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
