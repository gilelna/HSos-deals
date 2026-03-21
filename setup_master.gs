/**
 * ============================================================
 * setup_master.gs
 * Sets up the CURRENT spreadsheet as the Master CRM.
 * Adds all sheets, headers, sample data, formatting,
 * validation, and protection.
 * ============================================================
 *
 * HOW TO USE:
 *   1. Create a new blank Google Sheet
 *   2. In that sheet: Extensions → Apps Script
 *   3. Paste this entire file into the script editor
 *   4. Run `setupMaster()`
 *   5. The sheet you're IN becomes the Master — scripts stay bound
 */

// ── Colour constants ──────────────────────────────────────────
var HEADER_BG     = '#263238';
var HEADER_FG     = '#FFFFFF';
var EDITABLE_BG   = '#FFF9C4';
var READONLY_BG   = '#F5F5F5';

// ── Main entry point ──────────────────────────────────────────
function setupMaster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('CRM Master — Operations');
  Logger.log('✅ Setting up Master in: ' + ss.getUrl());

  // Delete any existing sheets except the first one (we'll rename it)
  var sheets = ss.getSheets();
  // Create Settings first, then delete the default
  _createSettingsSheet(ss);
  _createPeopleSheet(ss);
  _createClientsSheet(ss);
  _createDealsSheet(ss);
  _createSessionTypesSheet(ss);
  _createActivityLogSheet(ss);
  _createMonthlyPaymentsSheet(ss);

  // Now remove any leftover default sheets (Sheet1, etc.)
  var allSheets = ss.getSheets();
  var validNames = ['Settings','Vendors','Clients','Deals','Session Types','Activity Log','Monthly Payments'];
  for (var i = 0; i < allSheets.length; i++) {
    if (validNames.indexOf(allSheets[i].getName()) === -1) {
      ss.deleteSheet(allSheets[i]);
    }
  }

  Logger.log('🎉 Master setup complete! Spreadsheet ID: ' + ss.getId());
  SpreadsheetApp.getUi().alert(
    '✅ Master Setup Complete',
    'Your Master CRM spreadsheet is ready.\n\nSpreadsheet ID (copy this for vendor files):\n' + ss.getId(),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ════════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════════
function _createSettingsSheet(ss) {
  var sheet = ss.insertSheet('Settings');

  var data = [
    ['Key',              'Values'],
    ['statuses',         'active, inactive, paused, archived, deleted'],
    ['currencies',       'EUR, USD, GBP, ILS'],
    ['deal_types',       'package, subscription, one-time, corporate'],
    ['payment_methods',  'bank_transfer, paypal, cash, check, crypto'],
    ['hiring_types',     'freelance, employee, contractor'],
    ['role_types',       'teacher, admin, coordinator, content_creator'],
    ['unit_labels',      'session, hour, unit, word, project'],
    ['deal_statuses',    'draft, sent, paid, overdue, cancelled'],
    ['session_statuses', 'scheduled, completed, cancelled, no-show'],
    ['client_types',     'individual, company'],
    ['client_statuses',  'active, inactive, lead, churned'],
  ];

  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  _formatHeaders(sheet, 1, data[0].length);
  _styleReadOnly(sheet, 2, 1, data.length - 1, data[0].length);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 500);
  sheet.setFrozenRows(1);
}

// ════════════════════════════════════════════════════════════════
//  PEOPLE (vendors)
// ════════════════════════════════════════════════════════════════
function _createPeopleSheet(ss) {
  var sheet = ss.insertSheet('Vendors');
  var headers = [
    'vendor_id', 'name', 'email', 'role_type', 'payment_method',
    'currency', 'hiring_type', 'status', 'notes'
  ];
  var sample = [
    ['P001', 'Alice Martin',   'alice@example.com',  'teacher',    'bank_transfer', 'EUR', 'freelance',  'active', 'English teacher'],
    ['P002', 'Bob Chen',       'bob@example.com',    'teacher',    'paypal',        'USD', 'contractor', 'active', 'Math tutor'],
    ['P003', 'Carol Lopez',    'carol@example.com',  'coordinator','bank_transfer', 'EUR', 'employee',   'active', 'Operations lead'],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _formatHeaders(sheet, 1, headers.length);
  _styleEditable(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);

  // Dropdowns
  var settings = ss.getSheetByName('Settings');
  _applyDropdownFromSettings(sheet, 'D2:D', settings, 'role_types');
  _applyDropdownFromSettings(sheet, 'E2:E', settings, 'payment_methods');
  _applyDropdownFromSettings(sheet, 'F2:F', settings, 'currencies');
  _applyDropdownFromSettings(sheet, 'G2:G', settings, 'hiring_types');
  _applyDropdownFromSettings(sheet, 'H2:H', settings, 'statuses');
}

// ════════════════════════════════════════════════════════════════
//  CLIENTS
// ════════════════════════════════════════════════════════════════
function _createClientsSheet(ss) {
  var sheet = ss.insertSheet('Clients');
  var headers = [
    'client_id', 'client_type', 'display_name', 'first_name', 'last_name',
    'company_name', 'email', 'phone', 'linked_company_id', 'status', 'notes'
  ];
  var sample = [
    ['C001', 'individual', 'David Kim',       'David',  'Kim',    '',              'david@example.com',  '+1-555-0101', '',     'active', 'New student'],
    ['C002', 'company',    'TechCorp',        '',       '',       'TechCorp Ltd',  'hr@techcorp.com',    '+1-555-0200', '',     'active', 'Corporate client'],
    ['C003', 'individual', 'Emma Watson',     'Emma',   'Watson', '',              'emma@example.com',   '+1-555-0102', 'C002', 'active', 'Via TechCorp'],
    ['C004', 'individual', 'Frank Müller',    'Frank',  'Müller', '',              'frank@example.com',  '+49-176-1234','',     'lead',   'Interested in German lessons'],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _formatHeaders(sheet, 1, headers.length);
  _styleEditable(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);

  var settings = ss.getSheetByName('Settings');
  _applyDropdownFromSettings(sheet, 'B2:B', settings, 'client_types');
  _applyDropdownFromSettings(sheet, 'J2:J', settings, 'client_statuses');
}

// ════════════════════════════════════════════════════════════════
//  DEALS
// ════════════════════════════════════════════════════════════════
function _createDealsSheet(ss) {
  var sheet = ss.insertSheet('Deals');
  var headers = [
    'deal_id', 'client_id', 'client_type', 'linked_company_id', 'vendor_id',
    'deal_type', 'description', 'units_sold', 'unit_label', 'amount',
    'currency', 'invoice_sent_date', 'due_date', 'paid_date',
    'receipt_sent_date', 'status', 'document_link', 'document_number',
    'receipt_link', 'receipt_number', 'notes'
  ];
  var sample = [
    ['D001', 'C001', 'individual', '',     'P001', 'package',      '10 English sessions',  10,  'session', 500,  'EUR', '2026-01-05', '2026-02-05', '2026-01-20', '2026-01-21', 'paid',  '', 'INV-001', '', 'REC-001', ''],
    ['D002', 'C002', 'company',    'C002', 'P002', 'corporate',    'Monthly math tutoring', 20,  'hour',    2000, 'USD', '2026-01-10', '2026-02-10', '',           '',            'sent',  '', 'INV-002', '', '',        'Awaiting payment'],
    ['D003', 'C004', 'individual', '',     'P001', 'one-time',     'Trial lesson',          1,   'session', 40,   'EUR', '',           '',           '',           '',            'draft', '', '',        '', '',        'Pending confirmation'],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _formatHeaders(sheet, 1, headers.length);
  _styleEditable(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);

  var settings = ss.getSheetByName('Settings');
  _applyDropdownFromSettings(sheet, 'C2:C', settings, 'client_types');
  _applyDropdownFromSettings(sheet, 'F2:F', settings, 'deal_types');
  _applyDropdownFromSettings(sheet, 'I2:I', settings, 'unit_labels');
  _applyDropdownFromSettings(sheet, 'K2:K', settings, 'currencies');
  _applyDropdownFromSettings(sheet, 'P2:P', settings, 'deal_statuses');
}

// ════════════════════════════════════════════════════════════════
//  SESSION TYPES
// ════════════════════════════════════════════════════════════════
function _createSessionTypesSheet(ss) {
  var sheet = ss.insertSheet('Session Types');
  var headers = ['session_type_id', 'session_type_name', 'category', 'unit_type', 'active'];
  var sample = [
    ['ST001', 'English 1-on-1',     'language', 'session', 'yes'],
    ['ST002', 'English Group',      'language', 'session', 'yes'],
    ['ST003', 'Math Tutoring',      'academic', 'hour',    'yes'],
    ['ST004', 'Content Translation','content',  'word',    'yes'],
    ['ST005', 'Conversation Club',  'language', 'session', 'no'],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _formatHeaders(sheet, 1, headers.length);
  _styleEditable(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['yes', 'no'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('E2:E').setDataValidation(rule);
}

// ════════════════════════════════════════════════════════════════
//  ACTIVITY LOG  (append-only)
// ════════════════════════════════════════════════════════════════
function _createActivityLogSheet(ss) {
  var sheet = ss.insertSheet('Activity Log');
  var headers = [
    'activity_id', 'entry_type', 'vendor_id', 'vendor_name',
    'client_id', 'client_name', 'linked_company_id', 'session_type',
    'activity_date', 'quantity', 'unit_type', 'source_file_id',
    'source_sheet', 'source_cell', 'status', 'notes',
    'created_at', 'updated_at'
  ];
  var now = new Date().toISOString();
  var sample = [
    ['A001', 'session', 'P001', 'Alice Martin', 'C001', 'David Kim',   '',     'English 1-on-1', '2026-01-15', 1, 'session', '', 'Sessions Log', 'C2', 'active',  '', now, now],
    ['A002', 'session', 'P001', 'Alice Martin', 'C003', 'Emma Watson', 'C002', 'English 1-on-1', '2026-01-16', 1, 'session', '', 'Sessions Log', 'C3', 'active',  '', now, now],
    ['A003', 'work',    'P003', 'Carol Lopez',  '',     '',            '',     '',               '2026-01-17', 3, 'hour',    '', 'Work Log',     'A2', 'active',  'Scheduling coordination', now, now],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _formatHeaders(sheet, 1, headers.length);
  _styleReadOnly(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);

  // Protect the entire Activity Log — admin-only editing
  var protection = sheet.protect().setDescription('Activity Log — append-only via script');
  _removeNonOwnerEditors(protection);
}

// ════════════════════════════════════════════════════════════════
//  MONTHLY PAYMENTS  (manual entry)
// ════════════════════════════════════════════════════════════════
function _createMonthlyPaymentsSheet(ss) {
  var sheet = ss.insertSheet('Monthly Payments');
  var headers = [
    'vendor_id', 'name', 'month', 'total_due', 'currency',
    'status', 'payment_date', 'notes'
  ];
  var sample = [
    ['P001', 'Alice Martin', '2026-01', 500, 'EUR', 'paid',    '2026-02-01', ''],
    ['P002', 'Bob Chen',     '2026-01', 800, 'USD', 'pending', '',           'Awaiting invoice'],
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);

  _formatHeaders(sheet, 1, headers.length);
  _styleEditable(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);

  var settings = ss.getSheetByName('Settings');
  _applyDropdownFromSettings(sheet, 'E2:E', settings, 'currencies');
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['pending', 'paid', 'partial', 'cancelled'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('F2:F').setDataValidation(statusRule);
}

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

/** Apply dark header formatting to row 1. */
function _formatHeaders(sheet, row, numCols) {
  var range = sheet.getRange(row, 1, 1, numCols);
  range.setBackground(HEADER_BG)
       .setFontColor(HEADER_FG)
       .setFontWeight('bold')
       .setHorizontalAlignment('center');
}

/** Paint a range with the editable (yellow) background. */
function _styleEditable(sheet, startRow, startCol, numRows, numCols) {
  if (numRows <= 0 || numCols <= 0) return;
  sheet.getRange(startRow, startCol, numRows, numCols).setBackground(EDITABLE_BG);
}

/** Paint a range with the read-only (gray) background. */
function _styleReadOnly(sheet, startRow, startCol, numRows, numCols) {
  if (numRows <= 0 || numCols <= 0) return;
  sheet.getRange(startRow, startCol, numRows, numCols).setBackground(READONLY_BG);
}

/** Build a dropdown rule from a comma-separated Settings row. */
function _applyDropdownFromSettings(sheet, a1Range, settingsSheet, key) {
  var data = settingsSheet.getDataRange().getValues();
  var values = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      values = data[i][1].split(',').map(function(v) { return v.trim(); });
      break;
    }
  }
  if (values.length === 0) return;
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(a1Range).setDataValidation(rule);
}

/** Auto-resize columns to fit content. */
function _autoResizeColumns(sheet, numCols) {
  for (var c = 1; c <= numCols; c++) {
    sheet.autoResizeColumn(c);
  }
  // Set a minimum width so columns are readable
  for (var c = 1; c <= numCols; c++) {
    if (sheet.getColumnWidth(c) < 120) {
      sheet.setColumnWidth(c, 120);
    }
  }
}

/** Remove all editors except the owner from a protection. */
function _removeNonOwnerEditors(protection) {
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
