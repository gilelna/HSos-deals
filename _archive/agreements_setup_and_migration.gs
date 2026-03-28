/**
 * ============================================================
 * agreements_setup_and_migration.gs
 * Sets up and migrates the CRM to support the new Agreements layer
 * and renames People to Vendors.
 * ============================================================
 *
 * HOW TO USE:
 *   1. Paste entire file into Apps Script editor.
 *   2. To setup a fresh DB: run `createUpdatedMasterSpreadsheet()`
 *   3. To migrate an existing DB: run `migrateExistingMasterSpreadsheet()`
 */

// ── Colour constants
var HEADER_BG     = '#263238';
var HEADER_FG     = '#FFFFFF';
var EDITABLE_BG   = '#FFF9C4';
var READONLY_BG   = '#F5F5F5';

// ════════════════════════════════════════════════════════════════
//  1. MIGRATION FOR EXISTING MASTER
// ════════════════════════════════════════════════════════════════
function migrateExistingMasterSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // A. Update Settings
  var settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet) {
    _migrateSettings(settingsSheet);
  }
  
  // B. Rename People to Vendors
  var peopleSheet = ss.getSheetByName('People');
  if (peopleSheet) {
    peopleSheet.setName('Vendors');
    var headers = peopleSheet.getRange(1, 1, 1, peopleSheet.getLastColumn()).getValues()[0];
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] === 'person_id') headers[i] = 'vendor_id';
      if (headers[i] === 'name') headers[i] = 'vendor_name';
    }
    peopleSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  // C. Update other sheets referencing "person_id" broadly
  var otherSheets = ['Deals', 'Monthly Payments', 'Activity Log'];
  otherSheets.forEach(function(sName) {
    var s = ss.getSheetByName(sName);
    if (!s) return;
    var hdrs = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    var changed = false;
    for (var j = 0; j < hdrs.length; j++) {
      if (hdrs[j] === 'person_id') {
        if (sName === 'Deals') hdrs[j] = 'responsible_vendor_id';
        else hdrs[j] = 'vendor_id';
        changed = true;
      }
      if (sName === 'Activity Log' && hdrs[j] === 'person_name') {
        hdrs[j] = 'vendor_name';
        changed = true;
      }
    }
    if (changed) s.getRange(1, 1, 1, hdrs.length).setValues([hdrs]);
  });
  
  // D. Create Agreements Sheet
  if (!ss.getSheetByName('Agreements')) {
    _createAgreementsSheet(ss);
  }
  
  // E. Update Deals Sheet
  var dealsSheet = ss.getSheetByName('Deals');
  if (dealsSheet) {
    _updateDealsSheet(dealsSheet);
  }
  
  SpreadsheetApp.getUi().alert('✅ Migration Complete', 'Successfully upgraded to Agreements layer.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function _migrateSettings(sheet) {
  var data = sheet.getDataRange().getValues();
  var foundAgreements = false;
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === 'deal_statuses') {
      sheet.getRange(i+1, 2).setValue('draft, sent, pending, paid, completed, canceled');
    }
    if (data[i][0] === 'agreement_statuses') foundAgreements = true;
  }
  if (!foundAgreements) {
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, 2).setValues([['agreement_statuses', 'draft, sent, signed, approved, canceled']]);
  }
}

function _updateDealsSheet(sheet) {
  var lastCol = sheet.getLastColumn();
  var headersRange = sheet.getRange(1, 1, 1, lastCol);
  var headers = headersRange.getValues()[0];
  
  var newCols = ['agreement_id', 'flow_stage', 'next_action_date', 'last_action_date', 'priority_flag', 'owner'];
  var appendCols = [];
  newCols.forEach(function(c) {
    if (headers.indexOf(c) === -1) appendCols.push(c);
  });
  
  if (appendCols.length > 0) {
    sheet.insertColumnsAfter(lastCol, appendCols.length);
    sheet.getRange(1, lastCol + 1, 1, appendCols.length).setValues([appendCols]);
    _formatHeaders(sheet, 1, lastCol + appendCols.length);
  }
}

// ════════════════════════════════════════════════════════════════
//  2. FRESH SETUP
// ════════════════════════════════════════════════════════════════
function createUpdatedMasterSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('CRM Master — Agreements Version');
  
  _createSettingsSheet(ss);
  _createVendorsSheet(ss);
  _createClientsSheet(ss);
  _createAgreementsSheet(ss);
  _createDealsSheet(ss);
  _createSessionTypesSheet(ss);
  _createActivityLogSheet(ss);
  _createMonthlyPaymentsSheet(ss);
  
  var validNames = ['Settings','Vendors','Clients','Agreements','Deals','Session Types','Activity Log','Monthly Payments'];
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    if (validNames.indexOf(allSheets[i].getName()) === -1) {
      ss.deleteSheet(allSheets[i]);
    }
  }
  SpreadsheetApp.getUi().alert('✅ Fresh Setup Complete', 'Your Master CRM spreadsheet is ready.', SpreadsheetApp.getUi().ButtonSet.OK);
}

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
    ['deal_statuses',    'draft, sent, pending, paid, completed, canceled'],
    ['agreement_statuses','draft, sent, signed, approved, canceled'],
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

function _createVendorsSheet(ss) {
  var sheet = ss.insertSheet('Vendors');
  var headers = ['vendor_id', 'vendor_name', 'email', 'role_type', 'payment_method', 'currency', 'hiring_type', 'status', 'notes'];
  var sample = [
    ['V001', 'Alice Martin',   'alice@example.com',  'teacher',    'bank_transfer', 'EUR', 'freelance',  'active', 'English teacher'],
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);
  _formatHeaders(sheet, 1, headers.length);
  _styleEditable(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);
}

function _createClientsSheet(ss) {
  var sheet = ss.insertSheet('Clients');
  var headers = ['client_id', 'client_type', 'display_name', 'first_name', 'last_name', 'company_name', 'email', 'phone', 'linked_company_id', 'status', 'notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _formatHeaders(sheet, 1, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);
}

function _createAgreementsSheet(ss) {
  var sheet = ss.insertSheet('Agreements');
  var headers = ['agreement_id', 'client_id', 'client_type', 'linked_company_id', 'vendor_id', 'product_name', 'units', 'unit_type', 'price_per_unit', 'total_amount', 'currency', 'agreement_date', 'start_date', 'end_date', 'status', 'document_link', 'notes', 'created_at', 'updated_at'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var sample = [
    ['AGR001', 'C001', 'individual', '', 'V001', '10 Sessions Package', 10, 'session', 50, 500, 'EUR', '2026-03-01', '2026-03-01', '2026-06-01', 'signed', 'link', 'Standard package', new Date(), new Date()]
  ];
  sheet.getRange(2, 1, sample.length, sample[0].length).setValues(sample);
  _formatHeaders(sheet, 1, headers.length);
  _styleEditable(sheet, 2, 1, sample.length, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);
}

function _createDealsSheet(ss) {
  var sheet = ss.insertSheet('Deals');
  var headers = [
    'deal_id', 'agreement_id', 'client_id', 'client_type', 'linked_company_id', 'responsible_vendor_id',
    'deal_type', 'description', 'units_sold', 'unit_label', 'amount',
    'currency', 'invoice_sent_date', 'due_date', 'paid_date',
    'receipt_sent_date', 'status', 'flow_stage', 'next_action_date', 'last_action_date', 'priority_flag', 'owner',
    'document_link', 'document_number', 'receipt_link', 'receipt_number', 'notes'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _formatHeaders(sheet, 1, headers.length);
  sheet.setFrozenRows(1);
  _autoResizeColumns(sheet, headers.length);
}

function _createSessionTypesSheet(ss) {
  var sheet = ss.insertSheet('Session Types');
  var headers = ['session_type_id', 'session_type_name', 'category', 'unit_type', 'active'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _formatHeaders(sheet, 1, headers.length);
  sheet.setFrozenRows(1);
}

function _createActivityLogSheet(ss) {
  var sheet = ss.insertSheet('Activity Log');
  var headers = ['activity_id', 'entry_type', 'vendor_id', 'vendor_name', 'client_id', 'client_name', 'linked_company_id', 'session_type', 'activity_date', 'quantity', 'unit_type', 'source_file_id', 'source_sheet', 'source_cell', 'status', 'notes', 'created_at', 'updated_at'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _formatHeaders(sheet, 1, headers.length);
  sheet.setFrozenRows(1);
}

function _createMonthlyPaymentsSheet(ss) {
  var sheet = ss.insertSheet('Monthly Payments');
  var headers = ['vendor_id', 'vendor_name', 'month', 'total_due', 'currency', 'status', 'payment_date', 'notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  _formatHeaders(sheet, 1, headers.length);
  sheet.setFrozenRows(1);
}

// ════════════════════════════════════════════════════════════════
//  3. HELPER FUNCTIONS FOR FRONTEND API
// ════════════════════════════════════════════════════════════════

/**
 * createAgreement: creates a new Agreement row.
 */
function createAgreement(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Agreements');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) { return data[h] || ''; });
  sheet.appendRow(row);
  return data.agreement_id;
}

/**
 * updateAgreementStatus: updates the status of an Agreement.
 */
function updateAgreementStatus(agreementId, newStatus) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Agreements');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === agreementId) {
      sheet.getRange(i + 1, 15).setValue(newStatus); // 15 is standard col for status
      sheet.getRange(i + 1, 19).setValue(new Date()); // updated_at
      return true;
    }
  }
  return false;
}

/**
 * createDealFromAgreement: creates a Deal and links it to an Agreement.
 */
function createDealFromAgreement(agreementId, dealPayload) {
  dealPayload.agreement_id = agreementId;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Deals');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) { return dealPayload[h] || ''; });
  sheet.appendRow(row);
  return dealPayload.deal_id;
}

/**
 * listDealsByAgreement: fetches all Deals associated with a specific Agreement.
 */
function listDealsByAgreement(agreementId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dealSheet = ss.getSheetByName('Deals');
  var dealData = dealSheet.getDataRange().getValues();
  var headers = dealData[0];
  var agreementIdx = headers.indexOf('agreement_id');
  if (agreementIdx === -1) return [];
  
  var results = [];
  for (var i = 1; i < dealData.length; i++) {
    if (dealData[i][agreementIdx] === agreementId) {
      var rowObj = {};
      headers.forEach(function(h, idx) { rowObj[h] = dealData[i][idx]; });
      results.push(rowObj);
    }
  }
  return results;
}

// ════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ════════════════════════════════════════════════════════════════
function _formatHeaders(sheet, row, numCols) {
  if(numCols===0) return;
  sheet.getRange(row, 1, 1, numCols).setBackground(HEADER_BG).setFontColor(HEADER_FG).setFontWeight('bold').setHorizontalAlignment('center');
}
function _styleEditable(sheet, startRow, startCol, numRows, numCols) {
  if (numRows <= 0 || numCols <= 0) return;
  sheet.getRange(startRow, startCol, numRows, numCols).setBackground(EDITABLE_BG);
}
function _styleReadOnly(sheet, startRow, startCol, numRows, numCols) {
  if (numRows <= 0 || numCols <= 0) return;
  sheet.getRange(startRow, startCol, numRows, numCols).setBackground(READONLY_BG);
}
function _autoResizeColumns(sheet, numCols) {
  for (var c = 1; c <= numCols; c++) {
    sheet.autoResizeColumn(c);
    if (sheet.getColumnWidth(c) < 120) sheet.setColumnWidth(c, 120);
  }
}
