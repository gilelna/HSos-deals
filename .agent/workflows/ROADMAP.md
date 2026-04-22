# HSos — Roadmap

## Phase 1 — Core operational system ✅ Complete
Goal: replace spreadsheets. Admin can manage deals, vendors, and billing.

### ✅ Done
- [x] deals.html + deals.js — Kanban, side panel, VAT, processors, client profile, product plan routing
- [x] workload.html + workload.js — session logging, client picker (optional), bills workflow
- [x] payments.html + payments.js — bill approval, companies, accounts
- [x] clients-portal.html, client-profile.html + client-profile.js
- [x] db.js — all Supabase queries
- [x] app.js, shared.css — shared UI layer
- [x] hsos-schema.sql — full DB schema
- [x] migrations/add-product-plans.sql + seed-sample-plans.sql

## Phase 2 — Invoicing + Reporting (NEXT)
- [ ] invoicing.html — create invoices from deals, PDF preview, status tracking
- [ ] reporting.html — monthly P&L, vendor payroll, deal pipeline, CSV export
- [ ] login.html — Google OAuth (Supabase Auth)

---

## Phase 2 — Vendor portal (2-3 weeks)
Goal: teachers can log in and manage their own work without admin help.

- [ ] vendor-portal.html — teacher view of workload.html
- [ ] Google login for vendors
- [ ] RLS policy: vendor_id = auth.uid()
- [ ] Mark lessons as Done from portal
- [ ] Log hours from portal
- [ ] View own rates (read only)
- [ ] View own payment history
- [ ] Slack notifications when deal status changes (Supabase Edge Function)

---

## Phase 3 — Client portal (1 month)
Goal: students can log in and see their own package status.

- [ ] Migrate to Next.js (needed for proper client auth)
- [ ] client-portal/ — student view
- [ ] RLS policy: client_id = auth.uid()
- [ ] Student sees: package credits, lesson history, upcoming lessons
- [ ] ActiveCampaign integration — sync contact on deal creation
- [ ] Mighty Network integration — show membership status

---

## Phase 4 — CRM & automation (future)
- [ ] Leads pipeline — prospect → qualified → client
- [ ] Follow-up reminders → email/WhatsApp
- [ ] Upsell triggers — when package runs out
- [ ] Stripe integration — payment links generated automatically
- [ ] Green Invoice API — invoices created automatically on deal close

---

## Deferred / won't do now
- Mobile app — browser is fine for internal tools
- Multi-language UI — English only for now
- Custom domain email — use existing Gmail
