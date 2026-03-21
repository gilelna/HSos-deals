/**
 * ============================================================
 * setup_vendor.gs
 * Sets up the CURRENT spreadsheet as a Vendor template.
 * Adds all sheets, formatting, protection, and custom menu.
 * ============================================================
 *
 * HOW TO USE:
 *   1. Create a new blank Google Sheet
 *   2. In that sheet: Extensions → Apps Script
 *   3. Paste this file AND all onEdit / sync / summary scripts
 *   4. Run `setupVendor()`
 *   5. The sheet you're IN becomes the Vendor file — scripts stay bound
 *   6. Update Settings sheet with your Master Spreadsheet ID
 */

// ── Colour constants ──────────────────────────────────────────
var V_HEADER_BG   = '#263238';
var V_HEADER_FG   = '#FFFFFF';
var V_EDITABLE_BG = '#FFF9C4';
var V_READONLY_BG = '#F5F5F5';

// ── Main entry point ──────────────────────────────────────────
function setupVendor() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('CRM Vendor — Template');
  Logger.log('✅ Setting up Vendor in: ' + ss.getUrl());

  _createVendorSettings(ss);
  _createVendorRoster(ss);
  _createSessionsLog(ss);
  _createWorkLog(ss);
  _createMonthlySummary(ss);
  _createVendorRates(ss);

  // Remove any leftover default sheets (Sheet1, etc.)
  var allSheets = ss.getSheets();
  var validNames = ['Settings','Roster','Sessions Log','Work Log','Monthly Summary','Rates'];
  for (var i = 0; i < allSheets.length; i++) {
    if (validNames.indexOf(allSheets[i].getName()) === -1) {
      ss.deleteSheet(allSheets[i]);
    }
  }

  Logger.log('🎉 Vendor setup complete!');
  SpreadsheetApp.getUi().alert(
    '✅ Vendor Setup Complete',
    'Your Vendor spreadsheet is ready.\n\nNext steps:\n1. Go to the Settings sheet\n2. Paste your Master Spreadsheet ID\n3. Update vendor_id and vendor_name',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ════════════════════════════════════════════════════════════════
//  SETTINGS  (vendor-level config)
// ════════════════════════════════════════════════════════════════
function _createVendorSettings(ss) {
  var sheet = ss.insertSheet('Settings');
  var data = [
    ['Key',                'Value'],
    ['master_spreadsheet_id', '<PASTE_MASTER_SPREADSHEET_ID_HERE>'],
    ['vendor_id',          'P001'],
    ['vendor_name',        'Alice Martin'],
    ['session_types',      'English 1-on-1, English Group, Math Tutoring'],
    ['work_types',         'Prep, Admin, Meeting, Content Creation, Other'],
  ];

  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  _vFormatHeaders(sheet, 1, 2);
  _vStyleReadOnly(sheet, 2, 1, data.length - 1, 1); // Keys are read-only
  _vStyleEditable(sheet, 2, 2, data.length - 1, 1); // Values are editable (by admin)

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 450);
  sheet.setFrozenRows(1);

  // Protect entire Settings sheet — admin only
  var protection = sheet.protect().setDescription('Vendor Settings — admin only');
  _vRemoveNonOwnerEditors(protection);
}

// ════════════════════════════════════════════════════════════════
//  ROSTER  (snapshot of assigned clients)
// ════════════════════════════════════════════════════════════════
function _createVendorRoster(ss) {
  var sheet = ss.insertSheet('Roster');
  var headers = ['client_id', 'display_name', 'email', 'company', 'session_type', 'status'];
  var sample = [
    ['C001', 'David Kim',   'david@example.com', '',              'English 1-on-1', 'active'],
    ['C003', 'Emma Watson', 'emma@example.com',  'TechCorp Ltd',  'English 1-on-1', 'active'],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _vFormatHeaders(sheet, 1, headers.length);
  _vStyleReadOnly(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _vAutoResizeColumns(sheet, headers.length);

  // Protect Roster — updated via script only
  var protection = sheet.protect().setDescription('Roster — synced from Master via button');
  _vRemoveNonOwnerEditors(protection);

  // Add Sync button via a drawing placeholder (instructions in README)
  // We'll add a note about the button instead
  sheet.getRange('A' + (sample.length + 3)).setValue('⬇ Run "Sync Roster" from the Extensions > Macros menu or a custom menu.');
  sheet.getRange('A' + (sample.length + 3)).setFontColor('#888888').setFontStyle('italic');
}

// ════════════════════════════════════════════════════════════════
//  SESSIONS LOG  (main vendor input)
// ════════════════════════════════════════════════════════════════
function _createSessionsLog(ss) {
  var sheet = ss.insertSheet('Sessions Log');
  var headers = ['client_name', 'session_type', 'date', 'notes', 'status'];
  var sample = [
    ['David Kim',   'English 1-on-1', '2026-01-15', 'Intro lesson',  'logged'],
    ['Emma Watson', 'English 1-on-1', '2026-01-16', 'Chapter 3 review', 'logged'],
    ['David Kim',   'English 1-on-1', '',           '',              ''],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _vFormatHeaders(sheet, 1, headers.length);

  // client_name & session_type are editable; date & notes are editable; status is read-only
  _vStyleEditable(sheet, 2, 1, sample.length, 4);  // cols A-D editable
  _vStyleReadOnly(sheet, 2, 5, sample.length, 1);   // col E read-only

  sheet.setFrozenRows(1);
  _vAutoResizeColumns(sheet, headers.length);

  // Session type dropdown from Settings
  var settings = ss.getSheetByName('Settings');
  var sessionTypes = _vGetSettingValue(settings, 'session_types');
  if (sessionTypes) {
    var types = sessionTypes.split(',').map(function(v) { return v.trim(); });
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(types, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('B2:B').setDataValidation(rule);
  }

  // Date format
  sheet.getRange('C2:C').setNumberFormat('yyyy-mm-dd');

  // Protect status column
  var protection = sheet.protect().setDescription('Sessions Log status column');
  protection.setUnprotectedRanges([
    sheet.getRange('A2:D')  // Only A-D are editable by vendor
  ]);
  _vRemoveNonOwnerEditors(protection);
}

// ════════════════════════════════════════════════════════════════
//  WORK LOG  (non-lesson work)
// ════════════════════════════════════════════════════════════════
function _createWorkLog(ss) {
  var sheet = ss.insertSheet('Work Log');
  var headers = ['date', 'work_type', 'hours', 'notes', 'status'];
  var sample = [
    ['2026-01-17', 'Prep',    1.5, 'Prepared materials for David', 'logged'],
    ['2026-01-18', 'Meeting', 1,   'Team sync call',               'logged'],
    ['',           '',        '',  '',                              ''],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _vFormatHeaders(sheet, 1, headers.length);
  _vStyleEditable(sheet, 2, 1, sample.length, 4);  // A-D editable
  _vStyleReadOnly(sheet, 2, 5, sample.length, 1);   // E read-only

  sheet.setFrozenRows(1);
  _vAutoResizeColumns(sheet, headers.length);

  // Date format
  sheet.getRange('A2:A').setNumberFormat('yyyy-mm-dd');

  // Work type dropdown
  var settings = ss.getSheetByName('Settings');
  var workTypes = _vGetSettingValue(settings, 'work_types');
  if (workTypes) {
    var types = workTypes.split(',').map(function(v) { return v.trim(); });
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(types, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('B2:B').setDataValidation(rule);
  }

  // Hours validation (positive number)
  var numRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThan(0)
    .setAllowInvalid(false)
    .setHelpText('Enter a positive number of hours')
    .build();
  sheet.getRange('C2:C').setDataValidation(numRule);

  // Protect status column
  var protection = sheet.protect().setDescription('Work Log status column');
  protection.setUnprotectedRanges([
    sheet.getRange('A2:D')
  ]);
  _vRemoveNonOwnerEditors(protection);
}

// ════════════════════════════════════════════════════════════════
//  MONTHLY SUMMARY  (calculated, read-only)
// ════════════════════════════════════════════════════════════════
function _createMonthlySummary(ss) {
  var sheet = ss.insertSheet('Monthly Summary');
  var headers = ['month', 'session_type', 'client_name', 'total_sessions', 'total_hours', 'unit_type'];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Sample data (would normally be filled by monthly_summary.gs)
  var sample = [
    ['2026-01', 'English 1-on-1', 'David Kim',   2, 2, 'session'],
    ['2026-01', 'English 1-on-1', 'Emma Watson',  1, 1, 'session'],
    ['2026-01', '— Work —',       '(all)',         0, 4.5, 'hour'],
  ];
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _vFormatHeaders(sheet, 1, headers.length);
  _vStyleReadOnly(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _vAutoResizeColumns(sheet, headers.length);

  // Add summary totals label
  var totalRow = sample.length + 3;
  sheet.getRange(totalRow, 1).setValue('TOTALS');
  sheet.getRange(totalRow, 1).setFontWeight('bold');
  sheet.getRange(totalRow, 4).setValue('=SUM(D2:D' + (sample.length + 1) + ')');
  sheet.getRange(totalRow, 5).setValue('=SUM(E2:E' + (sample.length + 1) + ')');

  // Protect whole sheet
  var protection = sheet.protect().setDescription('Monthly Summary — calculated by script');
  _vRemoveNonOwnerEditors(protection);
}

// ════════════════════════════════════════════════════════════════
//  RATES  (read-only for vendor)
// ════════════════════════════════════════════════════════════════
function _createVendorRates(ss) {
  var sheet = ss.insertSheet('Rates');
  var headers = ['session_type', 'rate', 'currency', 'notes'];
  var sample = [
    ['English 1-on-1',  40,  'EUR', 'Per session (60 min)'],
    ['English Group',   30,  'EUR', 'Per session (60 min)'],
    ['Math Tutoring',   50,  'USD', 'Per hour'],
    ['Prep',            20,  'EUR', 'Per hour — prep work'],
    ['Meeting',         20,  'EUR', 'Per hour — meetings'],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _vFormatHeaders(sheet, 1, headers.length);
  _vStyleReadOnly(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _vAutoResizeColumns(sheet, headers.length);

  // Protect entire Rates sheet — admin only
  var protection = sheet.protect().setDescription('Rates — admin only');
  _vRemoveNonOwnerEditors(protection);
}

// ════════════════════════════════════════════════════════════════
//  CUSTOM MENU (added on open)
// ════════════════════════════════════════════════════════════════

/**
 * Creates a custom menu when the vendor spreadsheet is opened.
 * Requires an onOpen installable trigger or simple trigger.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 CRM Tools')
    .addItem('Sync Roster from Master', 'syncRosterFromMaster')
    .addItem('Recalculate Monthly Summary', 'recalculateMonthlySummary')
    .addToUi();
}

// ════════════════════════════════════════════════════════════════
//  VENDOR HELPERS
// ════════════════════════════════════════════════════════════════

function _vFormatHeaders(sheet, row, numCols) {
  var range = sheet.getRange(row, 1, 1, numCols);
  range.setBackground(V_HEADER_BG)
       .setFontColor(V_HEADER_FG)
       .setFontWeight('bold')
       .setHorizontalAlignment('center');
}

function _vStyleEditable(sheet, startRow, startCol, numRows, numCols) {
  if (numRows <= 0 || numCols <= 0) return;
  sheet.getRange(startRow, startCol, numRows, numCols).setBackground(V_EDITABLE_BG);
}

function _vStyleReadOnly(sheet, startRow, startCol, numRows, numCols) {
  if (numRows <= 0 || numCols <= 0) return;
  sheet.getRange(startRow, startCol, numRows, numCols).setBackground(V_READONLY_BG);
}

function _vAutoResizeColumns(sheet, numCols) {
  for (var c = 1; c <= numCols; c++) {
    sheet.autoResizeColumn(c);
  }
  for (var c = 1; c <= numCols; c++) {
    if (sheet.getColumnWidth(c) < 120) {
      sheet.setColumnWidth(c, 120);
    }
  }
}

function _vGetSettingValue(settingsSheet, key) {
  var data = settingsSheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function _vRemoveNonOwnerEditors(protection) {
  try {
    var me = Session.getEffectiveUser();
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
  } catch (e) {
    Logger.log('⚠️ Could not restrict protection editors: ' + e.message);
  }
}
