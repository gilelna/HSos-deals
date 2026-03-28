# HSos — Tech Stack

## Product framing

HSos is a modular internal operations system for a service business.

It is organized into four spaces:
- Sales
- Operations
- Payments
- Clients Portal

Current build focus:
- Sales
- Operations
- Payments

Clients Portal is future scope.

---

## Frontend

**Plain HTML + Vanilla JS**

No framework. No bundler. No npm.

Why:
- Zero build complexity — edit file, refresh browser, done
- Claude Code can work directly on the files
- Deploy = upload files to Cloudways
- Works perfectly at this scale (< 10 concurrent internal users)

When to upgrade to Next.js:
- When building the Clients Portal
- When you need server-side rendering for SEO
- When the codebase gets too large to manage in flat files

**CDN dependencies (loaded in every HTML file)**
```html
<!-- Fonts -->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">

<!-- Supabase JS client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

---

## Database

**Supabase (hosted Postgres)**

Why Supabase:
- Relational model fits deals, clients, vendors, sessions, and payments
- SQL is easier for operational queries and reporting
- Works cleanly with plain HTML + JS
- Good fit for small internal operational datasets

Why not Firebase for this layer:
- This system manages hundreds of operational records, not hundreds of thousands
- The model is relational, not document-based
- Firebase is more relevant later for Clients Portal and large-scale customer data

**Supabase features in use now:**
- Database (Postgres)

**Supabase features intentionally NOT in use yet:**
- Auth
- Storage
- Realtime

---

## Auth

**Auth is intentionally disabled in the current phase**

Why:
- Focus is on stabilizing structure, schema, and flows
- Login slows down iteration during UI and DB development

Current behavior:
- `requireAuth()` returns `true`
- No login required

Future plan:
- Add Google OAuth via Supabase
- Introduce system roles after flows are stable

Planned system roles:
- `admin`
- `manager`
- `finance`
- `vendor`

---

## File Storage

**Phase 1:** external links only

Examples:
- Google Drive links
- invoice links
- agreements
- receipts

**Phase 2:** optional Supabase Storage

Do not implement storage yet.

---

## Invoicing

**Phase 1:** external systems (e.g. Green Invoice)

**Phase 2 (optional):** browser PDF generation
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

Not part of current build scope.

---

## Hosting

**Cloudways — static hosting**

Why:
- Already available
- No build step required
- Good enough for internal tool

Deploy process:
1. Edit files locally
2. Test in browser
3. Upload via SFTP / File Manager
4. Done

Add CI/CD only when:
- multiple developers
- framework introduced

---

## Notifications

**Phase 1:** UI toast notifications

**Phase 2 (optional):** Slack / webhook integration via Supabase Edge Functions

Do not build notification infrastructure yet, but keep it in mind for later phases.

---

## Data Import

Current approach:
- manual entry
- optional CSV import later
- simple scripts via supabase-client.js

Do not overdesign imports.

---

## Stack Summary

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Plain HTML + Vanilla JS | Now |
| Fonts | Google Fonts CDN | Now |
| DB client | Supabase JS CDN | Now |
| Database | Supabase Postgres | Now |
| Auth | Disabled intentionally | Now |
| Hosting | Cloudways static | Now |
| File storage | External links | Now |
| PDF generation | jsPDF CDN | Later |
| Supabase Storage | Optional | Later |
| Notifications | Optional | Later |
| Clients Portal | Future layer | Later |