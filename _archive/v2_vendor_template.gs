/**
 * VENDOR APP & LOGGING TOOL
 * Provides Pipeline syncing and logging for external vendors.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ Personal Dashboard')
    .addItem('🔗 Sync My Pipeline / Verify Master Connection', 'syncWithMaster')
    .addToUi();
}

/**
 * SETUP SCRIPT
 * Run setupVendorSpreadsheet() ONCE on a blank sheet
 */
function setupVendorSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const tables = {
    'My Active Pipeline': ['Deal Selector', 'Client Name', 'Deal ID', 'Status', 'Next Action Date', 'Priority Flag'],
    'Sessions Log': ['Date', 'Assigned Selection', 'Session/Work Type', 'Units (Hours)', 'Notes', 'Sync Status'],
    'Work Log': ['Date', 'Assigned Selection', 'Task Description', 'Hours Spent', 'Notes', 'Sync Status'],
    'Monthly Summary': ['Month-Year', 'Total Sessions Hrs', 'Total Work Hrs', 'Expected Cash', 'Payment Status'],
    'Rates': ['Type/Code', 'Rate per Unit (€)'],
    'Sync Configuration': ['Master Sheet ID', 'Your Vendor Email', 'Connection Status']
  };

  for (const [sheetName, headers] of Object.entries(tables)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clear();
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#2E353B').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  setupMonthlySummary(ss.getSheetByName('Monthly Summary'));
  setupRates(ss.getSheetByName('Rates'));
  setupDataValidations(ss);
}

function setupDataValidations(ss) {
  const pipelineSheet = ss.getSheetByName('My Active Pipeline');
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(pipelineSheet.getRange('A2:A'), true)
    .setAllowInvalid(true) // Just a visual dropdown, allow manual just in case
    .build();
    
  ss.getSheetByName('Sessions Log').getRange('B2:B').setDataValidation(rule).setBackground("#FFFDE7");
  ss.getSheetByName('Work Log').getRange('B2:B').setDataValidation(rule).setBackground("#FFFDE7");
}

function setupMonthlySummary(sheet) {
  sheet.getRange("A2").setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM"));
  sheet.getRange("A2").setNumberFormat("yyyy-MM");
  
  sheet.getRange("B2").setFormula(`=SUMIFS('Sessions Log'!D:D, 'Sessions Log'!A:A, ">="&DATEVALUE(A2&"-01"), 'Sessions Log'!A:A, "<="&EOMONTH(DATEVALUE(A2&"-01"),0))`);
  sheet.getRange("C2").setFormula(`=SUMIFS('Work Log'!D:D, 'Work Log'!A:A, ">="&DATEVALUE(A2&"-01"), 'Work Log'!A:A, "<="&EOMONTH(DATEVALUE(A2&"-01"),0))`);
  sheet.getRange("D2").setFormula(`=(B2 * VLOOKUP("Standard Session", Rates!A:B, 2, FALSE)) + (C2 * VLOOKUP("Hourly Work", Rates!A:B, 2, FALSE))`);
  sheet.getRange("B2:D2").setBackground('#F3F4F6'); 
}

function setupRates(sheet) {
  const defaultRates = [
    ['Standard Session', 50],
    ['Hourly Work', 30]
  ];
  sheet.getRange(2, 1, defaultRates.length, 2).setValues(defaultRates);
}

/**
 * SYNC LOGIC
 * Connects to master, identifies vendor by email, pulls down their exclusive pending deals.
 */
function syncWithMaster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = ss.getSheetByName('Sync Configuration');
  const masterId = config.getRange("A2").getValue();
  const myEmail = config.getRange("B2").getValue(); 
  
  if(!masterId || !myEmail) {
    SpreadsheetApp.getUi().alert("Please paste the Master Sheet ID and your Vendor Email into the Sync Configuration tab first.");
    return;
  }
  
  let masterSS;
  try {
    masterSS = SpreadsheetApp.openById(masterId);
  } catch(e) {
    SpreadsheetApp.getUi().alert("⛔ Error connecting: " + e.message);
    config.getRange("C2").setValue("Error").setBackground("#FEE2E2");
    return;
  }
  
  try {
    const dealsData = masterSS.getSheetByName('Deals').getDataRange().getValues();
    const clientsData = masterSS.getSheetByName('Clients').getDataRange().getValues();
    
    // Create map of Client ID -> Client Name
    const clientMap = {};
    clientsData.forEach(row => {
      clientMap[row[0]] = row[1];
    });
    
    const myPipeline = [];
    
    // Build array of matching deals
    dealsData.forEach((row, i) => {
      if (i === 0) return; // skip header
      const dealId = row[0];
      const clientId = row[2];
      const status = row[4];
      const assigned = String(row[6]).trim().toLowerCase();
      const nextAction = row[13];
      const priority = row[9];
      
      if (assigned === String(myEmail).trim().toLowerCase() && status !== 'completed' && status !== 'canceled') {
        const clientName = clientMap[clientId] || clientId;
        const dealSelector = `${clientName} - ${dealId}`; // E.g., John Doe - D0002
        myPipeline.push([dealSelector, clientName, dealId, status, nextAction, priority]);
      }
    });
    
    const pipelineSheet = ss.getSheetByName('My Active Pipeline');
    const lastRow = Math.max(pipelineSheet.getLastRow(), 2);
    pipelineSheet.getRange(2, 1, lastRow, 6).clearContent(); // Clear old pipeline
    
    if (myPipeline.length > 0) {
      pipelineSheet.getRange(2, 1, myPipeline.length, 6).setValues(myPipeline);
      pipelineSheet.getRange(2, 5, myPipeline.length, 1).setNumberFormat("yyyy-MM-dd"); // Format Next Action Date
    }
    
    config.getRange("C2").setValue("Connected").setBackground("#D1FAE5");
    SpreadsheetApp.getUi().alert(`✅ Synced! Found ${myPipeline.length} active deals assigned to ${myEmail}.`);
    
  } catch(e) {
    SpreadsheetApp.getUi().alert("⛔ Sync Error: " + e.message);
  }
}

/**
 * AUTO-DATING
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheetName = e.source.getActiveSheet().getName();
  const row = e.range.getRow();
  const col = e.range.getColumn();
  
  // When assigning a deal from dropdown in Col 2, insert today's date in Col 1
  if ((sheetName === 'Sessions Log' || sheetName === 'Work Log') && col === 2 && row >= 2) {
    const dateCell = e.source.getActiveSheet().getRange(row, 1);
    if (!dateCell.getValue()) {
      dateCell.setValue(new Date());
    }
  }
}
