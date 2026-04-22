# HSos Environment Toggle - Implementation Guide

This guide walks you through setting up a parallel dummy database and implementing the production/dummy toggle in your HSos application.

## Overview

You'll create:
1. A second Supabase project with dummy data
2. Environment configuration system
3. UI toggle in the topbar
4. Seamless switching between environments

## Step 1: Create Dummy Supabase Project

### 1.1 Create New Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name it: `hsos-dummy` or `hsos-demo`
4. Choose same region as production (for consistency)
5. Generate a strong database password (save it)
6. Wait for project to be created (~2 minutes)

### 1.2 Copy Database Schema

You need to replicate your production schema in the dummy database.

**Option A: Using Supabase CLI (recommended)**

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your production project
supabase link --project-ref YOUR_PROD_PROJECT_REF

# Generate migration from production schema
supabase db dump --schema public > schema.sql

# Link to dummy project
supabase link --project-ref YOUR_DUMMY_PROJECT_REF

# Apply schema to dummy database
supabase db push
```

**Option B: Manual SQL Export/Import**

1. Go to your **production** Supabase project → SQL Editor
2. Run this query to export schema:
   ```sql
   -- Export table definitions
   SELECT string_agg(
     'CREATE TABLE ' || schemaname || '.' || tablename || ' (...);',
     E'\n'
   )
   FROM pg_tables
   WHERE schemaname = 'public';
   ```
3. Copy all CREATE TABLE statements
4. Go to your **dummy** Supabase project → SQL Editor
5. Paste and run the CREATE TABLE statements

**Option C: Use Supabase Schema Migration**

1. Production project → Database → Schema
2. Click "Export Schema"
3. Download the SQL file
4. Dummy project → SQL Editor
5. Paste and execute the schema SQL

### 1.3 Enable RLS (Row Level Security)

In your **dummy** Supabase project:

1. Go to Authentication → Policies
2. For each table, enable RLS
3. Add policy: "Allow all for authenticated users" (temporary, for testing)
   ```sql
   CREATE POLICY "Allow all for authenticated users"
   ON public.clients
   FOR ALL
   USING (auth.role() = 'authenticated');
   ```
4. Repeat for all tables

### 1.4 Get API Credentials

In your **dummy** Supabase project:

1. Go to Settings → API
2. Copy:
   - Project URL (e.g., `https://abcd1234.supabase.co`)
   - `anon` public key (starts with `eyJ...`)
3. Save these for Step 2

## Step 2: Generate Dummy Data

### 2.1 Use the Generation Prompt

1. Take the file `DUMMY_DATA_GENERATION_PROMPT.md`
2. Give it to Claude (or another AI assistant)
3. Ask: "Please generate the complete SQL script based on this specification"
4. Claude will create a large INSERT script with all dummy data

### 2.2 Load Dummy Data

1. Copy the generated SQL script
2. Go to your **dummy** Supabase project → SQL Editor
3. Paste the entire script
4. Click "Run"
5. Verify: Check tables in Database → Tables (should see ~30 clients, ~20 deals, etc.)

### 2.3 Verify Data Relationships

Run these queries in SQL Editor to verify:

```sql
-- Count records
SELECT 'clients' as table, COUNT(*) as count FROM clients
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
SELECT 'payments', COUNT(*) FROM payments;

-- Check foreign key integrity
SELECT 
  d.id,
  d.client_id,
  c.full_name as client_name,
  v.full_name as vendor_name
FROM deals d
LEFT JOIN clients c ON d.client_id = c.id
LEFT JOIN vendors v ON d.primary_vendor_id = v.id
LIMIT 10;
```

All foreign keys should resolve correctly.

## Step 3: Install Environment Toggle

### 3.1 Add Files to Your Project

Copy these files to your project root:

1. `env-config.js` → Your project root
2. `supabase-client-updated.js` → Replace your existing `supabase-client.js`
3. `env-toggle.html` → Your project root

### 3.2 Update env-config.js

Edit `env-config.js` and replace the dummy credentials:

```javascript
dummy: {
  url: 'https://YOUR_DUMMY_PROJECT_URL.supabase.co',  // From Step 1.4
  anonKey: 'YOUR_DUMMY_ANON_KEY',  // From Step 1.4
  label: 'Demo / Dummy Data',
  color: '#e0a040'
}
```

### 3.3 Update HTML Files

In **every HTML file** (workload.html, deals.html, payments.html, etc.):

**Before** (old script loading):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
```

**After** (new script loading with env support):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="env-config.js"></script>
<script src="supabase-client.js"></script>
```

**IMPORTANT:** `env-config.js` must load BEFORE `supabase-client.js`

### 3.4 Add Toggle to Topbar

In **every HTML file**, add the environment toggle to the topbar.

Find your topbar's right section (`.topbar-r`):

```html
<div class="topbar-r">
  <!-- Add this BEFORE the user name/avatar -->
  <div id="env-toggle-container"></div>
  
  <span style="font-size:12px;color:var(--mu)">Hadar Shemesh</span>
  <button class="icon-btn" onclick="openVendorProfile()" title="My Profile">⚙</button>
  <div class="av-sm" onclick="openVendorProfile()">HS</div>
</div>
```

Then at the bottom of the body, before the closing `</body>` tag:

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

## Step 4: Test the Toggle

### 4.1 Initial Test

1. Open your HSos app (any page)
2. You should see a green indicator "Production" in the topbar
3. Click it → dropdown appears
4. Click "Demo / Dummy"
5. Confirm the switch
6. Page reloads → you should see orange indicator "Demo / Dummy Data"
7. Navigate around → you should see dummy clients, deals, vendors, etc.

### 4.2 Verify Data Isolation

**In Production mode:**
- Should see real business data
- Any changes save to production database

**In Dummy mode:**
- Should see sample data (30 clients, 20 deals, etc.)
- Any changes save to dummy database (safe to experiment)

### 4.3 Test Switching Back

1. Click environment toggle
2. Select "Production"
3. Page reloads → back to real data

## Step 5: Optional Enhancements

### 5.1 Add Environment Badge to All Pages

If you want a more visible indicator, add CSS for a persistent badge:

```css
/* Add to your main CSS file */
body::before {
  content: attr(data-env);
  position: fixed;
  bottom: 10px;
  right: 10px;
  padding: 4px 10px;
  font-size: 9px;
  font-family: 'DM Mono', monospace;
  font-weight: 600;
  background: var(--env-color);
  color: white;
  border-radius: 4px;
  z-index: 9999;
  opacity: 0.7;
  pointer-events: none;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

body[data-env="production"]::before {
  --env-color: #4caf82;
}

body[data-env="dummy"]::before {
  --env-color: #e0a040;
}
```

Then in your JS initialization:

```javascript
document.body.setAttribute('data-env', window.getCurrentEnv());
```

### 5.2 Console Logging

Add environment awareness to your console:

```javascript
// At top of your main JS files
const ENV = window.getCurrentEnv();
const ENV_CONFIG = window.getEnvConfig();
console.log(`%c[HSos ${ENV_CONFIG.label}]`, `color: ${ENV_CONFIG.color}; font-weight: bold;`, 'App initialized');
```

### 5.3 Prevent Accidental Production Changes

Add a confirmation for destructive actions in production:

```javascript
async function deleteClient(id) {
  const env = window.getCurrentEnv();
  
  if (env === 'production') {
    const confirmed = confirm('⚠️ PRODUCTION MODE\n\nAre you sure you want to delete this client? This cannot be undone.');
    if (!confirmed) return;
  }
  
  // Proceed with deletion
  await sb.from('clients').delete().eq('id', id);
}
```

## Troubleshooting

### Issue: Toggle not appearing

**Check:**
1. Is `env-config.js` loaded before `supabase-client.js`?
2. Does browser console show errors?
3. Did you add the `<div id="env-toggle-container"></div>` to HTML?

### Issue: "Dummy database empty"

**Fix:**
1. Go to dummy Supabase project → SQL Editor
2. Re-run the dummy data generation script
3. Verify with: `SELECT COUNT(*) FROM clients;`

### Issue: "Auth errors" in dummy mode

**Fix:**
RLS policies might be too strict. Temporarily allow all:

```sql
-- Run in dummy Supabase SQL Editor
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
-- Repeat for other tables
```

### Issue: Switching doesn't work

**Check localStorage:**
Open browser console and run:
```javascript
console.log('Current env:', localStorage.getItem('HSOS_ENV'));
console.log('Config:', window.getEnvConfig());
```

Should show either 'production' or 'dummy'.

**Reset if needed:**
```javascript
localStorage.removeItem('HSOS_ENV');
location.reload();
```

## Security Notes

1. **Dummy database is NOT for sensitive data**
   - Don't put real client info in dummy
   - Dummy anon key can be public (it's in frontend anyway)
   - Use realistic but fake data

2. **RLS is still important**
   - Even in dummy, enable RLS for testing
   - Test that your RLS policies work correctly

3. **Production credentials**
   - Keep production anon key in `env-config.js` (it's already public in your app)
   - Never commit .env files with service_role keys

## Next Steps

Once working:

1. **Share dummy with team**
   - Anyone can switch to dummy mode
   - Safe for demos, training, testing

2. **Refresh dummy data periodically**
   - Re-run generation script monthly
   - Keep it representative of current schema

3. **Use for development**
   - Test new features in dummy
   - Try destructive operations safely
   - Experiment with UI without fear

## Summary

You now have:
- ✅ Parallel dummy database with sample data
- ✅ Environment toggle in UI
- ✅ Safe testing environment
- ✅ Production data isolated and protected

The toggle makes it easy to:
- Demo the system to new users
- Test new features safely
- Train team members
- Experiment with workflows
- Showcase the system without exposing real data
