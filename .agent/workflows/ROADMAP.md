# Lessons OS — Roadmap

## Phase 1 — Core operational system (NOW)
Goal: replace spreadsheets. Admin can manage deals, lessons, and vendors.

### Week 1 ✅ Done
- [x] deals.html mockup — Kanban, side panel, VAT, processors, client profile
- [x] workload.html mockup — student list, lesson history, rates, work log
- [x] Design system — dark theme, DM Sans/Mono, CSS variables
- [x] CLAUDE.md, STACK.md, SCHEMA.md, ROADMAP.md

### Week 2 — Connect to Supabase
- [ ] schema.sql — run in Supabase SQL Editor
- [ ] schema-seed.sql — test data
- [ ] supabase-client.js — all data helpers
- [ ] deals.html → live data (replace dummy arrays)
- [ ] workload.html → live data
- [ ] login.html — Google OAuth

### Week 3 — Invoicing module
- [ ] invoicing.html mockup
- [ ] Invoice creation form linked to deal
- [ ] Invoice number auto-generation
- [ ] PDF preview in browser (jsPDF)
- [ ] PDF → Supabase Storage → URL saved to invoices table
- [ ] Invoice status tracking (draft → sent → paid)

### Week 4 — Reporting module
- [ ] reporting.html mockup
- [ ] Monthly P&L: revenue vs payroll
- [ ] Vendor payroll report — hours × rates
- [ ] Deal pipeline summary
- [ ] Export to CSV

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
