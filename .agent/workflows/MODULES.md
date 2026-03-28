# Lessons OS — Module Specs

Detailed spec for each module. Use this when building or extending a module.

---

## 1. Deals & Payments (`deals.html`) ✅ Built

### Purpose
Central operations view for admin. Manage the full deal lifecycle from prospect to closed.

### Views
- **Kanban** — columns by fulfillment_status, cards show client/product/price/manager/billing
- **List** — table with all columns, sortable
- **Side panel** — opens on card click, 5 tabs: Info / Billing / Workflow / Documents / Notes

### Key interactions
- Create deal — modal with client, vendor, product, VAT, processor fields
- Change fulfillment status — click stage pill in side panel Workflow tab
- Change billing status — click billing pill in side panel Billing tab
- VAT calculator — live calculation as user types, excl/incl toggle
- Client profile — slide-in panel showing client deals + integrations
- Overdue banner — red chips at top for all overdue deals

### Data loaded
deals (with client, vendor, product, manager joins), clients, vendors, products, managers

---

## 2. Workload (`workload.html`) ✅ Built

### Purpose
Admin view of teacher workload and student packages.

### Views
- **Students tab** — grid or table of students with credit bars and status badges
- **Work Log tab** — monthly hours log with summary stats
- **Right panel** — student card with tabs: Overview / Lessons / Payments / Rates

### Key interactions
- Select student → card loads in right panel
- Mark lesson done → updates lesson status, deducts from package
- Log hour → inline form adds to vendor_hours
- Open client profile → slide-in panel (same as Deals)

### Data loaded
deals (filtered by vendor_id for teacher view), clients, lessons, vendor_hours, rates

---

## 3. Invoicing (`invoicing.html`) 🔲 To build

### Purpose
Create, preview, send, and track invoices linked to deals.

### Views
- **Invoice list** — table: invoice number, client, deal, amount, status, due date
- **Side panel** — invoice detail with PDF preview area
- **Create modal** — linked to deal, auto-fills fields from deal

### Key interactions
- Create invoice from deal — pulls client, product, price, VAT automatically
- Auto-generate invoice number — INV-YYYY-NNN (sequential)
- PDF preview — generate in browser with jsPDF
- Mark as sent — updates status, records sent_at
- Mark as paid — updates status, creates payment record
- Download PDF — triggers browser download

### Data loaded
invoices (with deal, client joins), deals, clients

### Invoice PDF content
- Business name and logo (top left)
- Invoice number and date (top right)
- Client name and company
- Line items: product name, quantity, unit price
- VAT breakdown: base price, VAT %, VAT amount, total
- Payment instructions (bank details or Stripe link)
- Footer: terms, due date

---

## 4. Reporting (`reporting.html`) 🔲 To build

### Purpose
Monthly financial overview — revenue, payroll, and profit.

### Views
- **P&L Summary** — revenue vs payroll for selected month
- **Vendor Payroll** — per-vendor hours and amounts
- **Deal Pipeline** — deals by stage with total values
- **Payment Status** — paid vs pending vs overdue

### Key interactions
- Month/year picker — changes all report data
- Export CSV — downloads current view as CSV file
- Click vendor → shows breakdown by work type and deal

### Data loaded
payments (monthly), vendor_hours (monthly), deals (pipeline), vendors

### P&L calculation
```
Revenue = SUM(payments.amount WHERE status='paid' AND month=selected)
Payroll = SUM(vendor_hours.hours * vendor_hours.rate WHERE month=selected)
Gross profit = Revenue - Payroll
Margin % = (Gross profit / Revenue) * 100
```

---

## 5. Vendor Portal (`vendor-portal.html`) 🔲 To build

### Purpose
Teacher-facing view. Only shows the logged-in teacher's own data.

### Views
- **My Students** — list of students assigned to this teacher, with package credits
- **My Lessons** — upcoming and past lessons, filterable by status
- **My Hours** — work log with monthly summary
- **My Rates** — read-only rate card
- **My Payments** — payment history from admin

### Key interactions
- Mark lesson done — updates lesson status
- Log hour — inline form, rate auto-filled from rates table
- View student card — slide-in with package info and lesson history

### Auth
- Google login required
- RLS: vendor_id = auth.uid() — teacher only sees their own rows
- Redirect to login if not authenticated

### Data loaded (filtered by auth.uid())
deals, lessons, vendor_hours, rates — all filtered to current vendor

---

## 6. Login (`login.html`) 🔲 To build

### Purpose
Single entry point for all users. Redirects to correct module based on role.

### Flow
1. User visits any page → requireAuth() → redirects to login.html
2. User clicks "Sign in with Google"
3. Supabase handles OAuth
4. On success → check profiles.role
5. If admin → redirect to deals.html
6. If vendor → redirect to vendor-portal.html

### Design
- Centered on dark background
- App logo/name
- Single "Sign in with Google" button
- No email/password fields

---

## Module switcher (topbar)

Every HTML file has this dropdown. Keep it updated as new modules are added.

```js
const MODULES = [
  { key: 'deals',          label: 'Deals',          color: '#a07de0', file: 'deals.html' },
  { key: 'workload',       label: 'Workload',        color: '#3dbfb0', file: 'workload.html' },
  { key: 'invoicing',      label: 'Invoicing',       color: '#4caf82', file: 'invoicing.html' },
  { key: 'reporting',      label: 'Reporting',       color: '#e0a040', file: 'reporting.html' },
  { key: 'vendor-portal',  label: 'Vendor Portal',   color: '#5a9de0', file: 'vendor-portal.html' },
]
```
