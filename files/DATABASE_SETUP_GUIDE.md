# HSos Database Setup Guide
## From Empty Supabase Project to Full Dummy Data

This guide walks you through creating a complete dummy database with schema and realistic data.

---

## Part 1: Create the Dummy Supabase Project

### Step 1.1: Create New Project

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in details:
   - **Name:** `hsos-dummy` (or `hsos-demo`)
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Choose same as production (for consistency)
   - **Pricing:** Free tier is fine
4. Click **"Create new project"**
5. Wait ~2 minutes for project initialization

### Step 1.2: Get API Credentials

Once project is ready:

1. Go to **Settings → API**
2. Copy and save:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public key:** `eyJhbG...` (long key)
3. Keep these for later (you'll add them to `env-config.js`)
https://pqkzffgpkpovternesmt.supabase.co
sb_publishable_aYfTv_dPUhz76X8wp1u0_Q_By9ab8Si
---

## Part 2: Create the Database Schema

### Step 2.1: Run Schema SQL

1. In your dummy Supabase project, go to **SQL Editor**
2. Click **"New query"**
3. Copy the **entire contents** of `hsos-schema.sql`
4. Paste into the SQL Editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. Wait for execution (should take ~5-10 seconds)

### Step 2.2: Verify Schema Creation

**Check Tables:**
1. Go to **Database → Tables** in left sidebar
2. You should see 14 tables:
   - ✅ clients
   - ✅ vendors
   - ✅ products
   - ✅ rates
   - ✅ vendor_clients
   - ✅ deals
   - ✅ sessions
   - ✅ vendor_hours
   - ✅ paychecks
   - ✅ payments
   - ✅ invoices
   - ✅ deal_documents
   - ✅ deal_reminders
   - ✅ profiles

**Check Enums:**
1. Go to **Database → Enums**
2. You should see 9 enums:
   - ✅ sales_status (5 values)
   - ✅ billing_status (5 values)
   - ✅ session_status (4 values)
   - ✅ session_type (6 values)
   - ✅ product_type (4 values)
   - ✅ vendor_type (3 values)
   - ✅ system_role (4 values)
   - ✅ payment_processor (4 values)
   - ✅ vat_mode (2 values)

**Verify RLS:**
1. Click on any table (e.g., `clients`)
2. Look for "RLS enabled" badge at top
3. Click **"View Policies"** → should see "Allow all for authenticated users"

**Quick SQL Check:**
Run this in SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Should return 14 rows (all your tables).

### Step 2.3: Troubleshooting

**If you see errors:**

**"relation already exists"**
→ You ran the script twice. Either drop tables or use a fresh project.

**"type already exists"**
→ Enums already created. Safe to ignore if continuing.

**"permission denied"**
→ Make sure you're in SQL Editor, not Authentication or other section.

**To start fresh if needed:**
```sql
-- WARNING: This deletes everything!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;
```

Then re-run `hsos-schema.sql`.

---

## Part 3: Generate Dummy Data

### Step 3.1: Use the Generation Prompt

1. Open `DUMMY_DATA_GENERATION_PROMPT.md`
2. Copy the **entire file**
3. Go to Claude (or another AI assistant)
4. Paste the prompt and say:

> "Please generate the complete SQL INSERT script based on this specification. Include all 30 clients, 17 vendors with their rates and client assignments, 8 products, 20 deals with varied statuses, sessions, vendor hours, payments, invoices, documents, and reminders. Make the data realistic with Hebrew and English names, proper dates, and logical relationships."

5. Claude will generate a large SQL script with hundreds of INSERT statements

### Step 3.2: Review Generated Data

Before running, **quickly scan** the SQL to verify:

- ✅ Uses `gen_random_uuid()` for IDs (not hardcoded UUIDs)
- ✅ Has proper single quotes around text values
- ✅ Dates are in format `'YYYY-MM-DD'`
- ✅ Foreign keys reference proper tables
- ✅ Enums use exact values from schema (e.g., `'active'` not `'Active'`)
- ✅ Wrapped in `BEGIN;` and `COMMIT;`

**Example of good INSERT:**
```sql
INSERT INTO clients (id, full_name, email, client_kind, active, created_at) VALUES
(gen_random_uuid(), 'Sarah Cohen', 'sarah.cohen@gmail.com', 'private', true, '2024-10-15 09:30:00+00'),
```

**Example of bad INSERT (fix before running):**
```sql
-- ❌ Hardcoded UUID - use gen_random_uuid() instead
('a1b2c3d4-...', 'Sarah Cohen', ...),

-- ❌ Wrong enum value - should be lowercase 'active'
('Active', ...),

-- ❌ Missing transaction wrapper
INSERT INTO clients ...
-- (should be wrapped in BEGIN; ... COMMIT;)
```

### Step 3.3: Load Dummy Data

1. Copy the **entire generated SQL script**
2. Go to your dummy Supabase project → **SQL Editor**
3. Click **"New query"**
4. Paste the script
5. Click **"Run"**
6. Wait for execution (may take 10-30 seconds depending on data volume)
7. Check for success message at bottom

### Step 3.4: Verify Data Loaded

**Quick count check:**
```sql
SELECT 
  'clients' as table, COUNT(*) as count FROM clients
UNION ALL
SELECT 'vendors', COUNT(*) FROM vendors
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'deals', COUNT(*) FROM deals
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'vendor_hours', COUNT(*) FROM vendor_hours
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices;
```

**Expected results:**
- clients: ~30
- vendors: ~17
- products: ~8
- deals: ~20
- sessions: ~40-60
- vendor_hours: ~80-100
- payments: ~25-35
- invoices: ~12-15

**Check data quality:**
```sql
-- Sample clients
SELECT full_name, email, client_kind, company 
FROM clients 
LIMIT 5;

-- Sample deals with relationships
SELECT 
  d.id,
  c.full_name as client,
  v.full_name as vendor,
  p.name as product,
  d.sales_status,
  d.billing_status
FROM deals d
LEFT JOIN clients c ON d.client_id = c.id
LEFT JOIN vendors v ON d.primary_vendor_id = v.id
LEFT JOIN products p ON d.product_id = p.id
LIMIT 10;

-- Check foreign key integrity
SELECT COUNT(*) as orphaned_sessions
FROM sessions s
LEFT JOIN deals d ON s.deal_id = d.id
WHERE d.id IS NULL;
-- Should return 0
```

**Browse data visually:**
1. Go to **Database → Tables**
2. Click on `clients` → Click **"Insert row"** button area (don't actually insert)
3. Browse existing data in the table view

### Step 3.5: Troubleshooting Data Load

**"foreign key violation"**
→ Data references a record that doesn't exist. Check that parent tables loaded first.
→ Fix: ensure INSERTs are in correct order (clients before deals, vendors before rates, etc.)

**"duplicate key value"**
→ You ran the script twice or have hardcoded IDs that clash.
→ Fix: truncate tables and reload, or use fresh database.

**"invalid input syntax for type"**
→ Enum value doesn't match schema exactly.
→ Fix: check enum values are lowercase and match schema.

**"column does not exist"**
→ Schema wasn't created properly.
→ Fix: re-run `hsos-schema.sql` first.

**To clear data and reload:**
```sql
-- Delete all data (keeps schema)
TRUNCATE TABLE 
  deal_reminders,
  deal_documents,
  invoices,
  payments,
  paychecks,
  vendor_hours,
  sessions,
  deals,
  vendor_clients,
  rates,
  products,
  vendors,
  clients
CASCADE;
```

Then re-run the INSERT script.

---

## Part 4: Connect Frontend to Dummy Database

### Step 4.1: Update env-config.js

Open `env-config.js` and update the dummy section:

```javascript
dummy: {
  url: 'https://YOUR_PROJECT_ID.supabase.co',  // From Step 1.2
  anonKey: 'eyJhbG...',  // From Step 1.2
  label: 'Demo / Dummy Data',
  color: '#e0a040'
}
```

### Step 4.2: Add Files to Project

Copy these files to your project root:

1. `hsos-schema.sql` (for reference/re-creation)
2. `env-config.js` (with updated credentials)
3. `env-toggle.html` (toggle UI component)
4. `supabase-client-updated.js` → rename to `supabase-client.js` (replace existing)

### Step 4.3: Update HTML Files

In **every HTML file**, update script loading:

**Old:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
```

**New:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="env-config.js"></script>  <!-- ADD THIS -->
<script src="supabase-client.js"></script>
```

**Critical:** `env-config.js` MUST load before `supabase-client.js`!

### Step 4.4: Add Toggle to Topbar

Find the `.topbar-r` section in each HTML file and add:

```html
<div class="topbar-r">
  <!-- ADD THIS -->
  <div id="env-toggle-container"></div>
  
  <!-- Existing content -->
  <span style="font-size:12px;color:var(--mu)">Hadar Shemesh</span>
  <button class="icon-btn" onclick="openVendorProfile()">⚙</button>
  <div class="av-sm">HS</div>
</div>
```

Then before closing `</body>` tag:

```html
<script>
  // Load environment toggle
  fetch('env-toggle.html')
    .then(r => r.text())
    .then(html => {
      document.getElementById('env-toggle-container').innerHTML = html;
    });
</script>
```

### Step 4.5: Test the System

1. Open your HSos app in browser
2. You should see **green dot** with "Production" in topbar
3. Click it → dropdown appears
4. Select "Demo / Dummy Data"
5. Confirm switch
6. Page reloads → **orange dot** appears
7. You should now see dummy data (30 clients, 20 deals, etc.)

**Navigate around:**
- Sales view → see 20 deals in various statuses
- Operations → see vendors, sessions, client assignments
- Payments → see vendor paychecks and payment records

**Switch back:**
- Click toggle → select "Production"
- Page reloads → back to real data

---

## Part 5: Maintenance

### Refresh Dummy Data

To regenerate fresh dummy data (monthly or when schema changes):

1. Truncate tables (see Step 3.5)
2. Re-run the generation prompt with Claude
3. Load new SQL script
4. Test frontend

### Update Schema

If you add/modify schema:

1. Update production schema first
2. Export changes to `hsos-schema.sql`
3. Run updated schema in dummy project
4. Regenerate dummy data to match new schema

### Backup Dummy Data

To save your current dummy data:

```sql
-- Export data
COPY clients TO '/tmp/clients.csv' CSV HEADER;
COPY vendors TO '/tmp/vendors.csv' CSV HEADER;
-- etc.
```

Or use Supabase's built-in backup in **Database → Backups**.

---

## Quick Reference

### Supabase Projects

| Project | Purpose | URL Pattern |
|---------|---------|-------------|
| Production | Real business data | `wmqmonjnmgtoilxfqqkv.supabase.co` |
| Dummy | Testing/demos | `YOUR_PROJECT_ID.supabase.co` |

### File Order

1. **First:** Run `hsos-schema.sql` (creates structure)
2. **Second:** Run generated INSERT script (adds data)
3. **Third:** Update `env-config.js` and deploy frontend

### SQL Scripts Execution Order

```
hsos-schema.sql          →  Creates tables, enums, indexes, RLS
   ↓
generated-dummy-data.sql →  Inserts sample records
   ↓
Frontend connects        →  Toggle between environments
```

### Common SQL Queries

**Check table counts:**
```sql
SELECT schemaname, tablename, 
  (xpath('/row/cnt/text()', 
    query_to_xml('SELECT COUNT(*) as cnt FROM "' || tablename || '"', false, true, '')))[1]::text::int as row_count
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Check RLS policies:**
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

**Find orphaned records:**
```sql
-- Sessions without deals
SELECT s.* FROM sessions s
LEFT JOIN deals d ON s.deal_id = d.id
WHERE d.id IS NULL;

-- Deals without clients
SELECT d.* FROM deals d
LEFT JOIN clients c ON d.client_id = c.id
WHERE c.id IS NULL;
```

---

## Troubleshooting Summary

| Issue | Solution |
|-------|----------|
| Tables don't exist | Run `hsos-schema.sql` first |
| Data load fails | Check foreign key order, verify parent records exist |
| Toggle doesn't show | Verify `env-config.js` loads before `supabase-client.js` |
| Wrong environment | Check `localStorage.getItem('HSOS_ENV')` in console |
| Can't switch | Clear localStorage and refresh |
| Data not updating | Check you're in correct environment (production vs dummy) |

---

## Success Checklist

After completing all steps, you should have:

- [✓] Dummy Supabase project created
- [✓] Schema deployed (`hsos-schema.sql` executed)
- [✓] 14 tables created with proper structure
- [✓] 9 enums defined correctly
- [✓] RLS enabled on all tables
- [✓] Dummy data loaded (~30 clients, ~20 deals, etc.)
- [✓] Data integrity verified (no orphaned records)
- [✓] `env-config.js` updated with dummy credentials
- [✓] Frontend files updated with environment system
- [✓] Toggle visible in topbar
- [✓] Can switch between production and dummy
- [✓] Both environments work correctly

**You're ready to demo and test!** 🎉
