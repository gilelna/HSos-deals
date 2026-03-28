# Lessons OS — Claude Prompts Library

Ready-made prompts to paste into Claude Code or Claude.ai chat.
Each prompt assumes CLAUDE.md has been read.

---

## 🔧 Setup & Connection

### Connect HTML to Supabase
```
Read all .html files and supabase-client.js in this project.
Then:
1. Replace all static data arrays (DEALS, CLIENTS, etc.) with async calls
   to the helper functions in supabase-client.js
2. Add loadAll() that loads everything in parallel with Promise.all
3. Add DOMContentLoaded handler that calls requireAuth() then loadAll()
4. Wrap every data write (create, update, delete) with the supabase-client helpers
5. Keep all UI/render logic exactly as-is — only touch the data layer
6. Add try/catch to every async call with showToast() for errors
Follow the patterns in CONVENTIONS.md exactly.
```

### Generate schema.sql from mockups
```
Read all .html files in this project.
Extract every data structure (const/let arrays with objects).
Then generate schema.sql following the rules in SCHEMA.md:
- uuid PKs, created_at on every table
- Proper FK relationships with ON DELETE behavior
- Enum types for all status fields
- RLS enabled on all tables with authenticated-user policy
- Indexes on all FK columns and status columns
Also generate schema-seed.sql with INSERT statements for the dummy data.
```

---

## 📦 New module

### Build a new module mockup
```
Build [MODULE_NAME].html as a new module in Lessons OS.
Read CLAUDE.md, CONVENTIONS.md and deals.html first to understand the design system.
Requirements: [DESCRIBE WHAT IT SHOULD DO]
Rules:
- Use the exact same design system (CSS variables, fonts, class names)
- Include the module switcher in the topbar with all existing modules
- Use static dummy data — no Supabase connection yet
- No alerts — all interactions show visual feedback
- Follow CONVENTIONS.md patterns
```

### Connect existing module to Supabase
```
Connect [FILENAME].html to Supabase.
Read CLAUDE.md, CONVENTIONS.md, supabase-client.js and [FILENAME].html.
Replace static data with live DB calls following CONVENTIONS.md patterns.
Add any missing helper functions to supabase-client.js.
Do not touch the UI layer.
```

---

## 🧾 Invoicing

### Build invoice from deal
```
Read CLAUDE.md and SCHEMA.md.
In invoicing.html, add a function createInvoiceFromDeal(dealId) that:
1. Loads the deal with client, product, and payment processor
2. Auto-generates invoice number (format: INV-YYYY-NNN)
3. Pre-fills all fields from the deal (price, VAT, client info)
4. Saves to the invoices table via supabase-client.js
5. Shows the invoice in a side panel for review before sending
```

### Generate PDF invoice
```
Read CLAUDE.md and invoicing.html.
Add generateInvoicePDF(invoiceId) that:
1. Loads invoice data with client and deal info
2. Uses jsPDF (CDN) to generate a clean PDF
3. PDF includes: invoice number, date, client info, line items, VAT breakdown, total
4. Uploads PDF to Supabase Storage at /invoices/{invoice_id}.pdf
5. Updates invoice.pdf_url in DB
6. Opens the PDF in a new tab for preview
Use the design system colors (dark theme) for the PDF.
```

---

## 📊 Reporting

### Monthly P&L report
```
Read CLAUDE.md and SCHEMA.md.
In reporting.html, build a monthly P&L view:
- Revenue: SUM of payments.amount WHERE status = 'paid' for selected month
- Payroll: SUM of vendor_hours.hours * vendor_hours.rate for selected month
- Gross profit: Revenue - Payroll
- Show per-vendor payroll breakdown
- Show per-deal revenue breakdown
- Add export to CSV button
Use a month/year picker at the top.
```

---

## 🔔 Notifications

### Add Slack notification on status change
```
Read CLAUDE.md.
When a deal's fulfillment_status changes:
1. Look up the deal's assigned manager
2. If manager has a slack_webhook_url, call it via fetch POST
3. Message format: "Deal [client name] moved to [status] — [product name] [amount]"
4. This should happen inside the setDealStatus() function in supabase-client.js
5. Wrap in try/catch — if Slack fails, don't break the status update
Note: This is a Phase 2 feature — add a TODO comment if webhook URL is not set.
```

---

## 🔐 Auth & RLS

### Add vendor RLS policies
```
Read SCHEMA.md — the Phase 2 RLS section.
Generate SQL to add vendor-level RLS policies:
- lessons: vendor can only see rows where vendor_id matches their auth.uid()
- vendor_hours: same pattern
- deals: vendor can see deals where they are the vendor_id
Keep the existing admin policy (authenticated users see all).
Use a profiles.role check to distinguish admin vs vendor.
```

---

## 🐛 Debug

### Debug Supabase connection
```
The app is not loading data from Supabase.
Check:
1. Are SUPABASE_URL and SUPABASE_ANON_KEY correct in supabase-client.js?
2. Is the user authenticated? Check requireAuth() return value.
3. Are there any RLS policy errors in the Supabase dashboard logs?
4. Run a simple test query: sb.from('deals').select('count').then(console.log)
5. Check browser console for CORS errors or 401/403 responses.
Report what you find.
```

---

## 📥 Data import

### Import from Google Sheets CSV
```
Read SCHEMA.md for the correct column names.
Write a one-time import script (import-[entity].js) that:
1. Reads a CSV file (path as command line argument)
2. Maps CSV columns to DB columns (show me the mapping first)
3. Inserts rows into Supabase using the service role key
4. Skips duplicates based on email field
5. Reports: X inserted, Y skipped, Z errors
The script runs with: node import-clients.js clients.csv
```
