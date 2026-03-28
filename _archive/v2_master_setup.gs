/**
 * V2 MASTER SETUP - Architecture & Sheet Generation
 * Run createMasterSpreadsheetV2() ONE TIME in the Apps Script editor 
 * to build out the entire V2 schema inside your active spreadsheet.
 */

function createMasterSpreadsheetV2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Define Sheets and Headers
  const tables = {
    'Vendors': ['vendor_id', 'name', 'email', 'role', 'status'],
    'Clients': [
      'client_id', 'name', 'type', 'contact_email', 'phone', 
      'active_campaign_id', 'thrivecart_link', 'green_invoice_link', 
      'notes', 'created_at'
    ],
    'Orders': ['order_id', 'client_id', 'description', 'total_value', 'status', 'created_at'],
    'Deals': [
      'deal_id', 'order_id', 'client_id', 'amount', 'deal_status', 'billing_status',
      'assigned_to', 'owner', 'due_date', 'priority_flag', 'followup_needed', 
      'followup_note', 'last_action_date', 'next_action_date',
      'overdue_flag', 'receipt_missing_flag', 'followup_flag', 'stale_flag',
      'created_at', 'updated_at'
    ],
    'Session Types': ['session_type_id', 'name', 'unit_type', 'default_rate'],
    'Activity Log': ['activity_id', 'date', 'vendor_id', 'client_id', 'deal_id', 'session_type_id', 'units', 'notes'],
    'Monthly Payments': ['payment_id', 'vendor_id', 'month_year', 'amount', 'status', 'notes'],
    'Settings': ['setting_name', 'setting_value', 'description'],
    // Views / Read-Only
    'Client_Profile': [],
    'Deals_Dashboard': [],
    'Deals_Kanban': ['Draft', 'Sent', 'Pending', 'Paid', 'Completed'],
    'Team_Followups': ['assigned_to', 'deal_id', 'client_name', 'deal_status', 'next_action_date', 'followup_note', 'priority_flag']
  };

  // 2. Build Sheets & Apply Formatting
  for (const [sheetName, headers] of Object.entries(tables)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    sheet.clear(); // Reset if running again
    
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Formatting: Dark header
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#2E353B'); // Dark Gray/Black
      headerRange.setFontColor('#FFFFFF'); 
      headerRange.setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }

  // 3. Setup Logic & Formulas for specific sheets
  setupDealsSheet(ss.getSheetByName('Deals'));
  setupKanbanSheet(ss.getSheetByName('Deals_Kanban'));
  setupFollowupsSheet(ss.getSheetByName('Team_Followups'));
  setupClientProfile(ss.getSheetByName('Client_Profile'));
  setupDashboard(ss.getSheetByName('Deals_Dashboard'));
  setupSettings(ss.getSheetByName('Settings'));

  // Clean up default sheet
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet) ss.deleteSheet(defaultSheet);
  
  SpreadsheetApp.getUi().alert("V2 Master System Created successfully!");
}

function setupDealsSheet(sheet) {
  // Add 100 rows of automated flag formulas to start
  const formulas = [];
  for(let i=2; i<=100; i++) {
    formulas.push([
      `=IF($A${i}="", "", AND($I${i}<TODAY(), $E${i}<>"paid", $E${i}<>"completed", $I${i}<>""))`, // O: overdue
      `=IF($A${i}="", "", AND(OR($E${i}="paid", $F${i}="paid"), $F${i}<>"receipt_sent"))`,      // P: receipt missing 
      `=IF($A${i}="", "", AND($N${i}<=TODAY(), $N${i}<>""))`,                                    // Q: followup flag
      `=IF($A${i}="", "", AND((TODAY()-$M${i})>=Settings!$B$1, $M${i}<>""))`                 // R: stale flag
    ]);
  }
  
  sheet.getRange(2, 15, 99, 4).setFormulas(formulas);
  
  // Format formula columns as read-only (light gray)
  sheet.getRange("O:R").setBackground('#F3F4F6');
  
  // Subtle yellow background for primarily editable columns (optional visual aid)
  sheet.getRange("J:L").setBackground('#FFFDE7');
  
  // Date Normalization (standardize to yyyy-MM-dd to avoid mixed US/EU confusion)
  sheet.getRange("I:I").setNumberFormat("yyyy-MM-dd"); // due_date
  sheet.getRange("M:N").setNumberFormat("yyyy-MM-dd"); // last & next_action
  sheet.getRange("S:T").setNumberFormat("yyyy-MM-dd"); // created_at, updated_at
}

function setupKanbanSheet(sheet) {
  // Combine fields into a single text "card" string
  const cardFormula = `Deals!A2:A & CHAR(10) & Deals!C2:C & "  -  €" & Deals!D2:D & CHAR(10) & "Next: " & TEXT(Deals!N2:N, "yyyy-mm-dd") & CHAR(10) & "Owner: " & Deals!G2:G`;
  
  sheet.getRange(2,1).setFormula(`=IFERROR(FILTER(${cardFormula}, Deals!E2:E="draft"), "No deals")`);
  sheet.getRange(2,2).setFormula(`=IFERROR(FILTER(${cardFormula}, Deals!E2:E="sent"), "No deals")`);
  sheet.getRange(2,3).setFormula(`=IFERROR(FILTER(${cardFormula}, Deals!E2:E="pending"), "No deals")`);
  sheet.getRange(2,4).setFormula(`=IFERROR(FILTER(${cardFormula}, Deals!E2:E="paid"), "No deals")`);
  sheet.getRange(2,5).setFormula(`=IFERROR(FILTER(${cardFormula}, Deals!E2:E="completed"), "No deals")`);
  
  // Stretch columns out and wrap text so they look like vertical cards
  sheet.setColumnWidths(1, 5, 230);
  sheet.getRange("A2:E").setWrap(true).setVerticalAlignment("top");
}

function setupFollowupsSheet(sheet) {
  // Filter for next_action_date <= today OR followup_needed = TRUE
  const formula = `=IFERROR(FILTER({Deals!G2:G, Deals!A2:A, Deals!C2:C, Deals!E2:E, Deals!N2:N, Deals!L2:L, Deals!J2:J}, (Deals!N2:N<=TODAY()) + (Deals!K2:K=TRUE)), "Everything up to date")`;
  sheet.getRange(2, 1).setFormula(formula);
}

function setupSettings(sheet) {
  const values = [
    ['stale_days', 7, 'Number of days without action before a deal is flagged as stale.'],
    ['slack_webhook', 'https://hooks.slack.com/services/...', 'Webhook URL for notifications.']
  ];
  sheet.getRange(2, 1, values.length, 3).setValues(values);
}

function setupClientProfile(sheet) {
  sheet.getRange("A1").setValue("Select Client Name:");
  sheet.getRange("A1").setFontWeight("bold");
  sheet.getRange("B1").setBackground("#FFFDE7"); // Editable yellow
  
  // Data Validation for B1 (Look at Name column B)
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clients').getRange('B2:B'), true)
    .build();
  sheet.getRange("B1").setDataValidation(rule);
  
  // Formulas
  sheet.getRange("A3").setValue("Client Details").setFontWeight("bold");
  sheet.getRange("A4").setValue("System ID:");
  // XLOOKUP Name in Col B to return ID in Col A
  sheet.getRange("B4").setFormula(`=IF(B1="","", XLOOKUP(B1, Clients!B:B, Clients!A:A))`);
  
  sheet.getRange("A6").setValue("Links").setFontWeight("bold");
  sheet.getRange("A7").setValue("Thrivecart:");
  sheet.getRange("B7").setFormula(`=IF(B1="","", XLOOKUP(B1, Clients!B:B, Clients!G:G))`);
  sheet.getRange("A8").setValue("Green Invoice:");
  sheet.getRange("B8").setFormula(`=IF(B1="","", XLOOKUP(B1, Clients!B:B, Clients!H:H))`);
  
  sheet.getRange("A10").setValue("Active Deals").setFontWeight("bold");
  sheet.getRange("A11:E11").setValues([["Deal ID", "Amount", "Status", "Assigned", "Next Action"]]);
  sheet.getRange("A11:E11").setBackground("#F3F4F6").setFontWeight("bold"); // Light Gray
  
  // We match Deal's Client ID against the dynamically Looked-Up ID from Name
  sheet.getRange("A12").setFormula(`=IF(B1="","", IFERROR(FILTER({Deals!A:A, Deals!D:D, Deals!E:E, Deals!G:G, Deals!N:N}, Deals!C:C=XLOOKUP(B1, Clients!B:B, Clients!A:A), Deals!E:E<>"completed", Deals!E:E<>"canceled"), "No active deals"))`);
  
  // Date Normalization
  sheet.getRange("E12:E").setNumberFormat("yyyy-MM-dd");
}

function setupDashboard(sheet) {
  sheet.getRange("A1").setValue("DEALS DASHBOARD").setFontWeight("bold").setFontSize(14);
  
  const metrics = [
    ["Total Open Deals", `=COUNTIFS(Deals!E:E, "<>completed", Deals!E:E, "<>canceled", Deals!A:A, "<>")`],
    ["Total Pending", `=COUNTIF(Deals!E:E, "pending")`],
    ["Overdue Deals", `=COUNTIF(Deals!O:O, TRUE)`],
    ["Paid Not Completed", `=COUNTIFS(Deals!E:E, "paid")`],
    ["Follow-ups Needed", `=COUNTIF(Deals!Q:Q, TRUE)`],
    ["Missing Receipts", `=COUNTIF(Deals!P:P, TRUE)`]
  ];
  
  sheet.getRange("A3:B8").setValues(metrics);
  sheet.getRange("A3:A8").setFontWeight("bold").setBackground("#F3F4F6");
  
  sheet.getRange("A11").setValue("Pipeline Value by Status").setFontWeight("bold");
  sheet.getRange("A12:B12").setValues([["Status", "Total Amount"]]).setBackground("#F3F4F6");
  sheet.getRange("A13").setFormula(`=IFERROR(QUERY(Deals!A2:E, "SELECT E, SUM(D) WHERE E IS NOT NULL GROUP BY E LABEL SUM(D) ''", 0))`); // Sum total amounts
}

// Vendor App Creation (optional usage per request)
function createVendorSpreadsheetV2() {
  const master = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt("Create Vendor Sheet", "Enter Vendor ID (e.g. V0001):", ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() == ui.Button.OK) {
    const vendorId = response.getResponseText();
    const vendorName = master.getSheetByName("Vendors").getRange("A2:B").getValues().find(r => r[0] == vendorId)?.[1] || "Unknown";
    
    const newSs = SpreadsheetApp.create(`Vendor Dashboard: ${vendorName} (${vendorId})`);
    
    const sheets = {
      'Sessions Log': ['date', 'client_id', 'session_type', 'units', 'notes'],
      'Work Log': ['date', 'deal_id', 'task', 'hours', 'notes'],
      'Monthly Summary': ['month_year', 'total_hours', 'total_earnings']
    };
    
    for(const [name, headers] of Object.entries(sheets)) {
      const sheet = newSs.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#2E353B').setFontColor('#FFFFFF').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    const defaultSheet = newSs.getSheetByName("Sheet1");
    if (defaultSheet) newSs.deleteSheet(defaultSheet);
    
    ui.alert(`Created Vendor Spreadsheet successfully: ${newSs.getUrl()}`);
  }
}
