/**
 * V2 LOGIC & AUTOMATION
 * Business logic running behind the sheets.
 */

// 1. Universal Sequence Generator
function generateId(prefix, sheetName, idColIndex) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getRange(2, idColIndex, sheet.getLastRow()).getValues().flat().filter(String);
  
  if (data.length === 0) return `${prefix}0001`;
  
  const numericIds = data.map(id => parseInt(id.replace(prefix, ''))).filter(n => !isNaN(n));
  const maxId = Math.max(...numericIds, 0);
  
  return prefix + String(maxId + 1).padStart(4, '0');
}

// 2. Core Conversion Function
function createDealFromOrder(orderId, dealAmount) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ordersSheet = ss.getSheetByName('Orders');
  const dealsSheet = ss.getSheetByName('Deals');
  
  // Find Parent Order
  const ordersData = ordersSheet.getDataRange().getValues();
  const orderRow = ordersData.find(row => row[0] === orderId);
  if (!orderRow) throw new Error("Order not found");
  
  const clientId = orderRow[1];
  
  // Generate Deal
  const newDealId = generateId('D', 'Deals', 1);
  const timestamp = new Date();
  
  // Create row matching schema
  // ['deal_id', 'order_id', 'client_id', 'amount', 'deal_status', 'billing_status', 'assigned_to', 'owner', 'due_date', 'priority_flag', 'followup_needed', 'followup_note', 'last_action_date', 'next_action_date', 'overdue_flag', 'receipt_missing_flag', 'followup_flag', 'stale_flag', 'created_at', 'updated_at']
  const newRow = [
    newDealId, orderId, clientId, dealAmount, 
    'draft', 'not_sent', 
    '', '', '', false, false, '', timestamp, '', 
    '', '', '', '', // Formula columns (handled separately or via array formulas)
    timestamp, timestamp
  ];
  
  dealsSheet.appendRow(newRow);
  
  // Ensure formulas map down to the new row
  const lastRow = dealsSheet.getLastRow();
  const prevRow = lastRow > 2 ? lastRow - 1 : 2;
  
  // Copy formula columns O to R downwards
  dealsSheet.getRange(prevRow, 15, 1, 4).copyTo(dealsSheet.getRange(lastRow, 15, 1, 4));
  
  return newDealId;
}

// 3. Status Helpers (Can be wired to Web App Frontend eventually)
function updateDealStatus(dealId, newStatus) {
  _updateEntityField('Deals', dealId, 1, 5, newStatus);
}

function updateBillingStatus(dealId, newStatus) {
  _updateEntityField('Deals', dealId, 1, 6, newStatus);
}

// Core updater helper
function _updateEntityField(sheetName, entityId, idColIndex, targetColIndex, newValue) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const ids = sheet.getRange(2, idColIndex, sheet.getLastRow()).getValues().flat();
  const rowIndex = ids.indexOf(entityId);
  
  if (rowIndex > -1) {
    sheet.getRange(rowIndex + 2, targetColIndex).setValue(newValue);
    
    // Auto-update 'updated_at' column 20 if it's the deals sheet
    if (sheetName === 'Deals') {
      sheet.getRange(rowIndex + 2, 20).setValue(new Date());
    }
  }
}

// 4. Slack Connectivity
function scanDealsForFollowups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const deals = ss.getSheetByName('Deals').getDataRange().getValues();
  
  // Pop the header
  const headers = deals.shift();
  
  const overdue = [];
  const followups = [];
  const missingReceipts = [];
  
  // Columns (0-indexed): DealId(0), ClientId(2), Amount(3), Overdue(14), MissingReceipt(15), FollowupFlag(16)
  deals.forEach(row => {
    if(!row[0]) return; // empty row skipped
    
    const dealSummary = `${row[0]} | ${row[2]} | €${row[3]}`;
    
    if (row[14] === true) overdue.push(dealSummary);
    if (row[15] === true) missingReceipts.push(dealSummary);
    if (row[16] === true) followups.push(`${dealSummary} -> Next: ${row[13] || 'Today'}`);
  });
  
  let totalCount = overdue.length + followups.length + missingReceipts.length;
  if(totalCount === 0) return; // Nothing to notify
  
  let payloadMessage = `🔔 *Daily CRM Action Report (${totalCount} open tasks)*\n\n`;
  
  if (overdue.length > 0) {
    payloadMessage += `🔴 *Overdue Deals*\n` + overdue.map(d => `• ${d}`).join('\n') + `\n\n`;
  }
  if (followups.length > 0) {
    payloadMessage += `🟠 *Follow-ups Required*\n` + followups.map(d => `• ${d}`).join('\n') + `\n\n`;
  }
  if (missingReceipts.length > 0) {
    payloadMessage += `🧾 *Missing Receipts*\n` + missingReceipts.map(d => `• ${d}`).join('\n') + `\n\n`;
  }
  
  sendSlackSummary(payloadMessage);
}

function sendSlackSummary(message) {
  const webhookUrl = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings').getRange("B2").getValue();
  
  // Guard clause against empty settings
  if(!webhookUrl || !webhookUrl.startsWith("http")) return; 
  
  const payload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message
        }
      }
    ]
  };
  
  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}
