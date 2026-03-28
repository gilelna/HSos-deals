/**
 * DUMMY DATA INJECTION
 * Run injectDummyData() ONCE after createMasterSpreadsheetV2() to populate the system.
 */

function injectDummyData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Date helpers
  const today = new Date();
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // 1. Vendors
  const vendors = [
    ['V0001', 'Alice Teacher', 'alice@test.com', 'Instructor', 'Active'],
    ['V0002', 'Bob Consultant', 'bob@test.com', 'Consultant', 'Active'],
    ['V0003', 'Charlie Designer', 'charlie@test.com', 'Creative', 'Inactive']
  ];
  ss.getSheetByName('Vendors').getRange(2, 1, vendors.length, vendors[0].length).setValues(vendors);

  // 2. Clients
  const clients = [
    ['C0001', 'John Doe', 'Student', 'john@test.com', '555-0101', 'AC_101', 'https://thrivecart.com/usr1', 'https://greeninvoice.co.il/c1', 'VIP student from summer cohort.', lastWeek],
    ['C0002', 'Acme Corp', 'Company', 'billing@acme.com', '555-0202', 'AC_102', 'https://thrivecart.com/usr2', 'https://greeninvoice.co.il/c2', 'Enterprise client.', lastWeek],
    ['C0003', 'Jane Smith', 'Student', 'jane@test.com', '555-0303', 'AC_103', 'https://thrivecart.com/usr3', 'https://greeninvoice.co.il/c3', '', yesterday]
  ];
  ss.getSheetByName('Clients').getRange(2, 1, clients.length, clients[0].length).setValues(clients);

  // 3. Orders
  const orders = [
    ['O0001', 'C0002', 'B2B Technical Consulting Package (Q1)', 5000, 'Confirmed', lastWeek],
    ['O0002', 'C0001', '10 Math Classes Pack', 500, 'Confirmed', yesterday],
    ['O0003', 'C0003', 'Single Consultation Session', 100, 'Negotiating', today]
  ];
  ss.getSheetByName('Orders').getRange(2, 1, orders.length, orders[0].length).setValues(orders);

  // 4. Deals (14 columns for editable data, leaving formula flags untouched)
  // cols: deal_id, order_id, client_id, amount, deal_status, billing_status, assigned_to, owner, due_date, priority_flag, followup_needed, followup_note, last_action_date, next_action_date
  const deals = [
    // This deal is Paid, but 'receipt_missing_flag' will trigger because billing != receipt_sent
    ['D0001', 'O0001', 'C0002', 2500, 'paid', 'paid', 'bob@test.com', 'Admin', yesterday, false, false, '', lastWeek, ''],
    
    // Normal pending deal
    ['D0002', 'O0001', 'C0002', 2500, 'pending', 'invoice_sent', 'bob@test.com', 'Admin', nextWeek, true, false, 'Waiting on Accounts Payable approvals.', yesterday, nextWeek],
    
    // This deal is Overdue (due past) AND Followup required (next_action past) AND Stale
    ['D0003', 'O0002', 'C0001', 250, 'draft', 'not_sent', 'alice@test.com', 'Admin', lastWeek, true, true, 'Need to get contract signed ASAP.', lastWeek, yesterday],
    
    // Sent smoothly
    ['D0004', 'O0002', 'C0001', 250, 'sent', 'not_sent', 'alice@test.com', 'Admin', nextWeek, false, false, '', yesterday, nextWeek],
    
    // Completed correctly
    ['D0005', 'O0001', 'C0002', 0, 'completed', 'receipt_sent', 'admin@test.com', 'Admin', lastWeek, false, false, '', lastWeek, '']
  ];
  ss.getSheetByName('Deals').getRange(2, 1, deals.length, deals[0].length).setValues(deals);

  // 5. Session Types
  const sessionTypes = [
    ['ST0001', '1on1 Class', 'Hours', 50],
    ['ST0002', 'Consulting Block', 'Hours', 150],
    ['ST0003', 'Design Review', 'Fixed', 200]
  ];
  ss.getSheetByName('Session Types').getRange(2, 1, sessionTypes.length, sessionTypes[0].length).setValues(sessionTypes);

  // 6. Activity Log
  const activities = [
    ['A0001', yesterday, 'V0001', 'C0001', 'D0003', 'ST0001', 1.5, 'Introductory class went great.'],
    ['A0002', yesterday, 'V0002', 'C0002', 'D0002', 'ST0002', 2.0, 'Technical scoping session with CTO.'],
    ['A0003', today, 'V0001', 'C0001', 'D0004', 'ST0001', 1.0, 'Second class, focused on algebra.']
  ];
  ss.getSheetByName('Activity Log').getRange(2, 1, activities.length, activities[0].length).setValues(activities);

  // 7. Monthly Payments
  const payments = [
    ['P0001', 'V0001', '2026-02', 1200, 'Paid', 'Included winter bonus.'],
    ['P0002', 'V0002', '2026-02', 3000, 'Paid', 'Standard consulting retainer.']
  ];
  ss.getSheetByName('Monthly Payments').getRange(2, 1, payments.length, payments[0].length).setValues(payments);
  
  // Set Client Profile default view to C0002 so they see the formulas work
  ss.getSheetByName('Client_Profile').getRange('B1').setValue('Acme Corp');
  
  SpreadsheetApp.getUi().alert("Dummy data injected! Check out your Kanban, Dashboards, and Client_Profile to see " + 
  "the automatic metrics light up.");
}
