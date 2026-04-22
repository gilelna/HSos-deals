# Lessons OS — Claude Project Context

## What is this project?

Lessons OS is a modular business operations system for an English tutoring business.
It manages the full lifecycle from prospect to completed deal — deals, payments,
teachers, lessons, invoicing, and reporting.

Built with: **Plain HTML + Vanilla JS + Supabase JS (CDN)**
Database: **Supabase (Postgres)**
Hosting: **Cloudways (static files)**
Auth: **Supabase Auth — Google OAuth**

---

## Current state

### ✅ Live (connected to Supabase, fully working)
- `workload.html` + `workload.js` — Operations module: session logging (optional client for internal tasks), client view with package tracker, bills workflow (draft → submit → approve → pay), history
- `deals.html` + `deals.js` — Sales module: Kanban + list view, VAT calculator, payment plan routing (product_plans), deal side panel, client profile panel
- `payments.html` + `payments.js` — Payments module: bill approval workflow, companies, accounts

### 🔲 Next to build
- `invoicing.html` — Create and send invoices linked to deals
- `reporting.html` — Monthly P&L, payroll summary, vendor hours report
- `login.html` — Google OAuth login page

### 🔲 Future
- Client portal (students see their own data)
- CRM (leads, prospects, follow-ups)

---

## Modules overview

| Module | File | Status | Users |
|--------|------|--------|-------|
| Operations (Workload) | workload.html | ✅ live | vendor |
| Sales (Deals) | deals.html | ✅ live | admin |
| Payments | payments.html | ✅ live | finance |
| Invoicing | invoicing.html | not started | admin |
| Reporting | reporting.html | not started | admin |
| Login | login.html | not started | all |

---

## Design system

Dark theme. Font: DM Sans + DM Mono. Loaded via Google Fonts CDN.

### CSS variables (defined in every HTML file)
```css
--bg: #0f0f11          /* page background */
--surface: #18181c     /* card background */
--s2: #212127          /* secondary surface */
--border: #2a2a32      /* default border */
--text: #f0efe8        /* primary text */
--muted: #8a8a96       /* secondary text */
--accent: #c8b87a      /* gold accent */
--green: #4caf82       /* success */
--red: #e05a5a         /* error / overdue */
--amber: #e0a040       /* warning */
--blue: #5a9de0        /* info */
```

### Key UI patterns (use these consistently)
- `.toast` — bottom-center notification (success / info / warning)
- `.side-panel` — right slide-in panel (480px wide)
- `.overlay` — modal with dark backdrop
- `.btn-new` — gold primary button
- `.mono` — DM Mono font for numbers and IDs
- Status badges: `.bb.paid` `.bb.overdue` `.bb.pending` `.bb.invoiced`
- Fulfillment stages: lead → qualified → active → delivered → closed

---

## Data model summary

### Core entities
- **clients** — students and corporate accounts
- **vendors** — teachers and contractors
- **managers** — internal team (admin users)
- **products** — reusable lesson package templates (price lives here)
- **rates** — per-vendor hourly rates by work type

### Transactional entities
- **deals** — central table: client + vendor + product + VAT + status
- **lessons** — individual sessions linked to a deal
- **vendor_hours** — time logs for payroll
- **payments** — payment records linked to deals
- **invoices** — invoices linked to deals
- **deal_documents** — files and URLs attached to deals
- **deal_reminders** — follow-up reminders

### Key relationships
```
clients ──< deals >── vendors
              │
         ┌────┴────┐
      lessons  payments
              │
          invoices
              │
       deal_documents
```

### Status enums
**deal.fulfillment_status**: lead, qualified, active, delivered, closed
**deal.billing_status**: pending, invoiced, partial, paid, overdue
**lesson.status**: scheduled, done, cancelled, no_show
**invoice.status**: draft, sent, paid, overdue, void

### VAT rules
- VAT lives on the **deal**, not the product
- Two modes: `excl` (price + VAT on top) or `incl` (price already includes VAT)
- Final price computed in frontend — NOT stored in DB

---

## File structure

```
/
├── deals.html + deals.js         # Sales module (admin)
├── workload.html + workload.js  # Operations module (vendor) ← active
├── payments.html + payments.js  # Payments module (finance) ← active
├── clients-portal.html           # Clients portal
├── client-profile.html + client-profile.js
├── index.html, login.html, env-toggle.html
├── app.js                        # Shared: vendor picker, toast, avatars, formatters
├── db.js                         # All Supabase queries (replaces supabase-client.js)
├── env-config.js                 # Supabase credentials (private)
├── shared.css                    # Single CSS file for all pages
├── hsos-schema.sql               # Current DB schema
├── migrations/                   # SQL migration files (add-product-plans, seed-sample-plans)
├── mockups/                      # HTML mockups only (not runtime)
├── docs/                         # Reference docs (SCHEMA-AUDIT, PAYMENT-ROUTING, MISSING-UI-ELEMENTS)
├── _archive/                     # Old files (workload v1, payments v1, one-time fixes, etc.)
└── .agent/workflows/             # Claude project context (this file + SCHEMA, MODULES, etc.)
```

---

## How to work on this project

### With Claude Code (terminal)
```bash
cd /path/to/lessons-os
claude
```
Always start a session by saying: "Read CLAUDE.md first, then tell me what you understand about the project."

### With Claude.ai (chat)
Paste the contents of CLAUDE.md at the start of any new conversation.

### Key instructions for Claude
1. Never rewrite working UI — only touch the data layer unless explicitly asked
2. All async calls must be wrapped in try/catch with showToast() for errors
3. Keep the design system consistent — use existing CSS variables and class names
4. No frameworks, no build tools, no npm — plain HTML + CDN only
5. db.js is the single source of truth for all DB operations (not supabase-client.js — archived)
6. DB layer is db.js — never call sb.from() directly in HTML files
8. When adding a new feature — update CLAUDE.md and SCHEMA.md

---

## Supabase setup

```js
// supabase-client.js — top of file
const SUPABASE_URL     = 'https://xxxx.supabase.co'   // Settings > General
const SUPABASE_ANON_KEY = 'sb_publishable_...'         // Settings > API Keys
```

**RLS policy (Phase 1):** authenticated users have full access to all tables.
**RLS policy (Phase 2):** vendors can only see their own rows (vendor_id = auth.uid()).

---

## Payment processors supported

| Processor | Fields stored on deal |
|-----------|----------------------|
| Green Invoice | gi_client_id, gi_invoice_series |
| Stripe | stripe_customer_id, stripe_payment_link |
| Wise | wise_iban, wise_bank_ref |
| Thrive Card | thrive_ref |

---

## Document storage

Phase 1: URLs stored in deal_documents table (Google Drive links etc.)
Phase 2: Supabase Storage bucket — direct file upload from browser

---

## Notification routing

Each deal has an assigned manager. When deal status changes:
1. Frontend shows toast notification (live now)
2. Slack webhook fires to manager's channel (Phase 2)

Manager profiles store: name, role, slack_channel, slack_webhook_url, email
