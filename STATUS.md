# HSos — Status
Last updated: 2026-04-11

## Architecture
- db.js — clean Supabase query layer, no dummy mode, no legacy
- app.js — shared: vendor picker, role selector, toast, avatar helpers, formatters
- shared.css — single CSS file for all pages
- workload.html + workload.js — Operations space (vendor portal) ← active
- deals.html + deals.js — Sales space (manager)
- payments.html + payments.js — Payments space (finance) ← active

## Data model: Restaurant Bill
Sessions → Bills (not vendor_hours → paychecks)
1. Vendor logs sessions (billed = false)
2. Vendor selects unpaid sessions → creates a draft bill
3. Manager reviews: approve → approved, or return → returned
4. Finance marks paid → status: paid, sessions permanently billed

## DB tables
- sessions: has billed (bool) + bill_id (FK → bills) + task_type_id (FK → task_types)
- bills: draft | submitted | returned | approved | paid
- packages, clients, vendors, rates, deals, products, companies, accounts
- product_plans, customers — payment routing system (added Apr 2026)
- task_types — 14 rows, used in session logging

## Auth
- Bypassed entirely (demo mode)
- DEMO.vendor in sessionStorage = current vendor identity
- Vendor picker: click avatar in topbar to switch
- Role: 4-role pill selector in topbar (Admin / Manager / Finance / Vendor), stored in sessionStorage `hsos_role`, sets `data-role` on `<body>`

## UI Shell (as of 2026-04-11)
- Left sidebar (220px): space selector + sub-nav, replaces horizontal nav tabs
- Top header: logo left, role selector center, avatar right — 56px slim
- Space cover: 140px gradient banner per space (DM Serif Display title)
- Alert bar: 4 contextual cards below cover — hidden for Vendor/Finance roles
- Fonts: DM Serif Display (titles) + DM Sans (body) + DM Mono (mono)

## Deep linking (as of 2026-04-11)
- deals.html: `?page=deals|clients|vendors|products` + `?view=kanban|list`
- workload.html: `?tab=log|work|clients|profile`
- payments.html: `?tab=vendor-bills|history|registry`
- Browser back/forward restores state via popstate listener

## What works
- [x] db.js — all queries including bills model
- [x] app.js — vendor picker, role selector, toast, helpers
- [x] shared.css — all components + sidebar + cover + alert bar
- [x] workload.html + workload.js — session logging with optional client (internal tasks), client view, bills (vendor side)
- [x] deals.html + deals.js — deals kanban, clients, vendors, products, payment plan routing
- [x] payments.html + payments.js — bill approval workflow, companies, accounts

## What's next
- [ ] Real auth (Google OAuth via Supabase)
- [ ] Role-based visibility rules per page
- [ ] Wire alert bar cards to real counts
- [ ] Invoicing module

## How to run
Open workload.html in browser (or via local server).
Pick a vendor from the picker. All data loads from Supabase demo DB.
