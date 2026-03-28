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

### ✅ Built (mockups complete, Supabase connection in progress)
- `deals.html` — Deals module: Kanban + list view, VAT calculator, payment processors,
  deal side panel (info / billing / workflow / documents / notes), client profile panel
- `workload.html` — Workload module: teacher view, student list, lesson history,
  payment history, rates, work log

### 🔲 Next to build
- `invoicing.html` — Create and send invoices linked to deals
- `reporting.html` — Monthly P&L, payroll summary, vendor hours report
- `vendor-portal.html` — Teacher-facing: log hours, mark lessons done, view students
- `login.html` — Google OAuth login page

### 🔲 Future
- Client portal (students see their own data)
- CRM (leads, prospects, follow-ups)

---

## Modules overview

| Module | File | Status | Users |
|--------|------|--------|-------|
| Deals & Payments | deals.html | mockup done | admin |
| Workload | workload.html | mockup done | admin + teacher |
| Invoicing | invoicing.html | not started | admin |
| Reporting | reporting.html | not started | admin |
| Vendor Portal | vendor-portal.html | not started | teacher |
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
├── deals.html              # Deals & payments module
├── workload.html           # Workload module (admin view)
├── vendor-portal.html      # Vendor/teacher portal
├── invoicing.html          # Invoicing module
├── reporting.html          # Reports module
├── login.html              # Auth page
├── supabase-client.js      # Shared DB client + all data helpers
├── schema.sql              # Run once in Supabase SQL Editor
├── schema-seed.sql         # Dummy data for testing
└── docs/
    ├── CLAUDE.md           # This file — project context for Claude
    ├── STACK.md            # Tech stack decisions
    ├── SCHEMA.md           # Full schema reference
    ├── ROADMAP.md          # Phased build plan
    └── CONVENTIONS.md      # Code conventions
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
5. supabase-client.js is the single source of truth for all DB operations
6. When adding a new feature — update CLAUDE.md and SCHEMA.md

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
