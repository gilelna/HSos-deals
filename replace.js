const fs = require('fs');

const files = [
  'api.gs', 'app.js', 'index.html', 'monthly_summary.gs', 
  'onEdit_sessions.gs', 'onEdit_worklog.gs', 'setup_vendor.gs', 
  'sync_roster.gs', 'README.md', 'setup_master.gs'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace variable/column names
  content = content.replace(/person_id/g, 'vendor_id');
  content = content.replace(/personId/g, 'vendorId');
  content = content.replace(/person_name/g, 'vendor_name');
  content = content.replace(/personName/g, 'vendorName');
  
  // Sheet name changes
  content = content.replace(/getSheetByName\('People'\)/g, "getSheetByName('Vendors')");
  content = content.replace(/Master People sheet/g, "Master Vendors sheet");
  content = content.replace(/\| People \|/g, "| Vendors |");
  content = content.replace(/'People'/g, "'Vendors'");
  
  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
