# Lessons OS — Code Conventions

Rules that apply to every file in this project.
Claude must follow these without being asked.

---

## HTML files

### Structure
Every HTML module follows this exact structure:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- 1. Meta -->
  <!-- 2. Google Fonts -->
  <!-- 3. Supabase JS CDN -->
  <!-- 4. <style> block with CSS variables -->
</head>
<body>
  <!-- 5. Topbar with module switcher -->
  <!-- 6. Page content -->
  <!-- 7. Side panels -->
  <!-- 8. Modals -->
  <!-- 9. Toast element -->
  <!-- 10. <script> block -->
</body>
</html>
```

### CSS variables
Always define at `:root`. Never hardcode colors.
Use existing variable names from the design system — never invent new ones.

### Class naming
Use short, flat class names. No BEM, no utility frameworks.
```css
.dcard        /* deal card */
.sp-body      /* side panel body */
.btn-new      /* primary action button */
.mono         /* monospace text */
```

### No frameworks
Never add React, Vue, Alpine, Tailwind, or any other framework.
Never add a `<script type="module">` unless loading from CDN.

---

## JavaScript

### Async pattern
All Supabase calls use this pattern:
```js
async function loadData() {
  try {
    const { data, error } = await sb.from('deals').select('*')
    if (error) throw error
    return data
  } catch (err) {
    showToast(err.message, 'warning')
    return []
  }
}
```

### Data loading
Always load all data at page start, store in module-level `let` variables:
```js
let DEALS = [], CLIENTS = [], VENDORS = [], PRODUCTS = [], MANAGERS = []

async function loadAll() {
  [DEALS, CLIENTS, VENDORS, PRODUCTS, MANAGERS] = await Promise.all([
    getDeals(), getClients(), getVendors(), getProducts(), getManagers()
  ])
  render()
}
```

### Render functions
Always re-render from state — never mutate the DOM directly.
```js
// WRONG
document.getElementById('deal-count').textContent = DEALS.length

// RIGHT
function render() {
  renderKanban()
  renderOverdue()
  updateDealCount()
}
```

### Computed values
Never store computed values. Always calculate on read.
```js
// WRONG — storing final price in DB
deal.final_price = deal.price * 1.17

// RIGHT — compute in frontend
function finalPrice(deal) {
  if (!deal.vat_pct) return deal.price
  if (deal.vat_mode === 'excl') return deal.price * (1 + deal.vat_pct / 100)
  return deal.price
}
```

### Status changes
Always call render() and showToast() after any status update:
```js
async function setDealStatus(id, status) {
  await updateDeal(id, { fulfillment_status: status })
  const d = DEALS.find(x => x.id === id)
  d.fulfillment_status = status
  render()
  showToast(`Status → ${status}`, 'success')
}
```

---

## db.js

All DB operations go here. Never call `sb.from()` directly in HTML files.
Each function returns the data array (not the Supabase response object).

```js
// Pattern for every function:
async function getDeals(filters = {}) {
  let q = sb.from('deals').select(`
    *,
    client:clients(*),
    vendor:vendors(*),
    product:products(*),
    manager:managers(*)
  `)
  if (filters.status) q = q.eq('fulfillment_status', filters.status)
  if (filters.billing) q = q.eq('billing_status', filters.billing)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
```

Use Supabase joins (`select('*, client:clients(*)')`) to avoid N+1 queries.

---

## File naming

```
deals.html          — not Deals.html or deals-module.html
workload.html       — active workload file
payments.html       — active payments file
db.js               — Supabase query layer (not supabase-client.js — archived)
hsos-schema.sql     — DB schema
CLAUDE.md           — uppercase, in .agent/workflows/
```

---

## What NOT to do

- Never rewrite the CSS or design system unless asked
- Never add a `console.log` in production code
- Never store sensitive data (passwords, secret keys) in HTML files
- Never use `innerHTML` for user-generated content (XSS risk)
- Never add a loading spinner that blocks the whole page — use skeleton states
- Never break the existing module switcher navigation
- Never change the toast system — it works, leave it
- Never add `!important` to CSS

---

## Adding a new module

1. Copy the topbar + module switcher from `deals.html`
2. Add the new module to the switcher dropdown in ALL existing HTML files
3. Use the same CSS variables and class patterns
4. Add all DB operations to `db.js` — not inline
5. Update CLAUDE.md (modules table) and ROADMAP.md
6. Update the module switcher in every existing HTML file
