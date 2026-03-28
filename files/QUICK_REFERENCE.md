# HSos Environment Toggle - Quick Reference

## File Structure

```
your-project/
├── env-config.js           ← Environment configuration (NEW)
├── supabase-client.js      ← Updated with env support
├── env-toggle.html         ← Toggle UI component (NEW)
├── workload.html           ← Updated script loading
├── deals.html              ← Updated script loading
├── payments.html           ← Updated script loading
└── ...
```

## Script Loading Order (Critical!)

Every HTML file must load scripts in this exact order:

```html
<!-- 1. Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- 2. Environment config (MUST be before supabase-client.js) -->
<script src="env-config.js"></script>

<!-- 3. Supabase client (uses env config) -->
<script src="supabase-client.js"></script>

<!-- 4. Your page JS -->
<script src="workload.js"></script>
```

## Environment Config (`env-config.js`)

```javascript
const ENV_CONFIG = {
  production: {
    url: 'https://wmqmonjnmgtoilxfqqkv.supabase.co',
    anonKey: 'sb_publishable_ujPTzw0beGD6fJ-V2PfNwg_mHgsoify',
    label: 'Production',
    color: '#4caf82'
  },
  dummy: {
    url: 'YOUR_DUMMY_URL',      // ← Replace this
    anonKey: 'YOUR_DUMMY_KEY',   // ← Replace this
    label: 'Demo / Dummy Data',
    color: '#e0a040'
  }
}
```

## Key Functions

### Check Current Environment
```javascript
const env = window.getCurrentEnv();  // 'production' or 'dummy'
```

### Get Current Config
```javascript
const config = window.getEnvConfig();
console.log(config.label);  // "Production" or "Demo / Dummy Data"
console.log(config.color);  // "#4caf82" or "#e0a040"
```

### Switch Environment Programmatically
```javascript
window.switchEnvironment('dummy');    // Switch to dummy (reloads page)
window.switchEnvironment('production'); // Switch to production (reloads page)
```

## Adding Toggle to HTML

In your topbar (`.topbar-r`):

```html
<div class="topbar-r">
  <!-- Environment toggle -->
  <div id="env-toggle-container"></div>
  
  <!-- Rest of topbar -->
  <span>User Name</span>
  <div class="av-sm">UN</div>
</div>
```

At bottom of `<body>`:

```html
<script>
  fetch('env-toggle.html')
    .then(r => r.text())
    .then(html => {
      document.getElementById('env-toggle-container').innerHTML = html;
    });
</script>
```

## Supabase Projects Setup

### Production Project
- **URL:** `https://wmqmonjnmgtoilxfqqkv.supabase.co`
- **Purpose:** Real business data
- **Changes:** Permanent

### Dummy Project
- **URL:** `https://YOUR_DUMMY_PROJECT.supabase.co` (create new project)
- **Purpose:** Testing, demos, training
- **Changes:** Safe to experiment

Both projects must have:
- ✅ Identical schema (same tables, columns, types)
- ✅ RLS enabled
- ✅ Same policies (for testing)

## Dummy Data Generation

Use the prompt in `DUMMY_DATA_GENERATION_PROMPT.md`:

1. Give prompt to Claude
2. Get back SQL INSERT script
3. Run in dummy Supabase SQL Editor
4. Verify: `SELECT COUNT(*) FROM clients;` → Should show ~30

## Console Debugging

```javascript
// Check current environment
console.log('ENV:', window.getCurrentEnv());

// Check config
console.log('Config:', window.getEnvConfig());

// Check localStorage
console.log('Stored:', localStorage.getItem('HSOS_ENV'));

// Force switch (bypass UI)
localStorage.setItem('HSOS_ENV', 'dummy');
location.reload();

// Reset to default (production)
localStorage.removeItem('HSOS_ENV');
location.reload();
```

## Common Operations

### Reset to Production
```javascript
localStorage.removeItem('HSOS_ENV');
location.reload();
```

### Check What Database You're On
```javascript
const config = window.getEnvConfig();
console.log(`Connected to: ${config.label}`);
console.log(`Database URL: ${config.url}`);
```

### Log All Operations (Debug Mode)
```javascript
// Wrap your DB calls to log environment
async function getClients() {
  const env = window.getCurrentEnv();
  console.log(`[${env}] Fetching clients...`);
  return await sb.from('clients').select('*');
}
```

## Visual Indicators

| Environment | Color | Label | Indicator |
|-------------|-------|-------|-----------|
| Production | 🟢 Green (#4caf82) | "Production" | Pulsing green dot |
| Dummy | 🟡 Orange (#e0a040) | "Demo / Dummy Data" | Pulsing orange dot |

## Security Notes

✅ **Safe:**
- Both anon keys can be public (frontend exposed anyway)
- Dummy data should be fake (no real client info)
- Toggle is client-side only (localStorage)

⚠️ **Important:**
- Never commit service_role keys
- Keep dummy data realistic but fake
- Test RLS policies in both environments

## Troubleshooting Quick Fixes

### Toggle not showing
```javascript
// Check if env-config.js loaded
console.log(typeof window.getEnvConfig);  // Should be "function"

// Check if toggle HTML loaded
console.log(document.getElementById('env-toggle-container').innerHTML);
```

### Wrong environment
```javascript
// Check and fix
const stored = localStorage.getItem('HSOS_ENV');
console.log('Stored:', stored);  // Should be 'production' or 'dummy'

// Force to production
localStorage.setItem('HSOS_ENV', 'production');
location.reload();
```

### Data not loading
```javascript
// Check connection
const config = window.getEnvConfig();
console.log('Connecting to:', config.url);

// Test query
const { data, error } = await sb.from('clients').select('*').limit(1);
console.log('Test query:', data, error);
```

## Best Practices

1. **Always start in Production**
   - Default is production (if localStorage empty)
   - Explicitly switch to dummy when needed

2. **Label your work clearly**
   - Console.log current environment at app start
   - Show visual indicator (colored dot)

3. **Keep dummy fresh**
   - Regenerate dummy data monthly
   - Update when schema changes

4. **Use dummy for:**
   - Demos to new team members
   - Testing destructive operations
   - UI/UX experiments
   - Screenshots without real data
   - Training sessions

5. **Use production for:**
   - All real business operations
   - Client-facing work
   - Reports and analytics
   - Any data that needs to persist

## Emergency: Switch Back to Production

If stuck in dummy mode or confused:

```javascript
// Open browser console, paste this:
localStorage.setItem('HSOS_ENV', 'production');
location.reload();
```

This immediately switches back to production and reloads.

## Summary Checklist

When implementing:

- [ ] Created dummy Supabase project
- [ ] Copied schema to dummy project
- [ ] Generated and loaded dummy data
- [ ] Added `env-config.js` with correct credentials
- [ ] Updated script loading order in all HTML files
- [ ] Added toggle to topbar in all pages
- [ ] Tested switching between environments
- [ ] Verified data isolation (changes in dummy don't affect production)
- [ ] Documented for team

When it works:
- ✅ Green dot = Production (real data)
- ✅ Orange dot = Dummy (safe to experiment)
- ✅ Click to switch, page reloads
- ✅ All features work in both modes
