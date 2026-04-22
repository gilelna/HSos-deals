# HSos — Missing UI Elements Report

> Generated: 2026-04-10
> Based on: docs/SCHEMA-AUDIT.md

---

## HIGH PRIORITY — Fields users need to see but currently can't

### deals.stripe_payment_link
- **Where:** Deal edit modal, deal slide panel
- **How:** Clickable link button — "Pay via Stripe →" (opens in new tab)
- **Why critical:** Finance needs to copy/send this to clients. Currently stored in DB but invisible.

### deals.owner_vendor_id
- **Where:** Deal edit modal (second vendor field), kanban card tooltip
- **How:** Second `<select>` labeled "Deal owner" below the primary vendor field
- **Why critical:** Deals can have a delivery vendor (primary) and an account manager (owner) — this is a meaningful business distinction that's entirely hidden.

### deals.discount
- **Where:** Deal edit modal, kanban card
- **How:** Text input field next to price. Display as badge on kanban card if non-null.
- **Why critical:** Discounts affect revenue figures. Currently stored but never shown or editable.

### deals.gi_client_id / deals.gi_invoice_series
- **Where:** Deal edit modal (collapsible "Invoicing" section)
- **How:** Two text inputs. Show a small "GI" badge on the deal card if populated.
- **Why critical:** Green Invoice integration — finance team needs to see and set these to issue invoices.

### deals.stripe_customer_id / deals.wise_iban / deals.wise_bank_ref / deals.thrive_ref
- **Where:** Deal edit modal (collapsible "Payment Gateway IDs" section)
- **How:** Small text inputs, labeled clearly. Show a small processor badge if any are populated.
- **Why critical:** These are the actual payment tracking IDs. Without them visible, reconciliation is manual.

### paychecks.actual_amount_paid
- **Where:** Vendor payments tab table (new column), paycheck detail
- **How:** Additional column next to `amount`. Highlight difference if it differs from `amount`.
- **Why critical:** Tracks what was actually transferred vs. what was calculated. Reconciliation data.

### paychecks.payout_amount + paychecks.payout_currency
- **Where:** Vendor payments tab table
- **How:** Show as "Payout" column in format `1,200 ILS` alongside the base `amount` in EUR.
- **Why critical:** Multi-currency payouts — vendor gets paid in ILS but deal is in EUR. Critical for finance.

### paychecks.payment_date
- **Where:** Vendor payments tab table
- **How:** Date column. Style in green when populated (paid), grey/italic when null (pending).
- **Why critical:** Shows when the transfer was made. Important for reconciliation.

### deal_reminders
- **Where:** Deal edit modal, deal slide panel
- **How:** Checklist at the bottom of the deal. Each reminder: checkbox + text + optional due date.
- **Why critical:** The table is fully built and queried (`deal_reminders(*)` in getDeals) but never rendered.

### vendors.contract_url
- **Where:** Vendor detail profile tab
- **How:** URL field with "Open contract ↗" link button. Show a paperclip icon if set.
- **Why critical:** Admin needs access to vendor contracts. Currently no way to see or set this.

### vendors.payout_currency
- **Where:** Vendor detail profile tab, vendor table
- **How:** Dropdown (USD/ILS/EUR) in the payment section. Show in vendor table alongside preferred_currency.
- **Why critical:** Distinct from `preferred_currency`. This is the actual currency vendor gets paid in.

### bills.vendor_notes
- **Where:** Draft bill review panel
- **How:** Read-only collapsible block above the sessions table. Label: "Vendor notes"
- **Why critical:** Vendors write these when submitting. Admins currently can't see them during review.

### bills.payment_method + bills.payment_reference
- **Where:** Vendor bill history rows
- **How:** Show as tooltip or expanded row. Format: "Paid via IBAN · ref: TX123"
- **Why critical:** Needed for accounting and dispute resolution.

---

## MEDIUM PRIORITY — Useful for context but not critical

### clients.created_at
- **Where:** Client profile overview, sidebar item tooltip
- **How:** "Client since: Apr 2024" in the overview contact grid or hero area
- **Display:** Formatted as `MMM YYYY`

### clients.active (in list)
- **Where:** Client list sidebar in deals.html
- **How:** Small grey dot if active, strikethrough name if inactive
- **Currently:** The active pill shows on client-profile.html hero but not in the sidebar list

### vendors.nickname
- **Where:** Vendor table, vendor chip in client overview
- **How:** Show in parentheses after full name `"John Smith (Johnny)"` or use as avatar fallback
- **Display:** Only show if different from full_name

### vendors.service_types
- **Where:** Vendor detail profile tab
- **How:** Tag-style chips for each service type in the JSONB array
- **Display:** Editable multi-select or comma-separated tags

### products.units
- **Where:** Product modal, product table
- **How:** Small text input. Display as suffix to price: `€150 / session`
- **Display:** Show after price if set

### products.payment_links (rendered)
- **Where:** Product detail modal, deal creation flow
- **How:** Instead of raw JSON textarea, render as list of labeled buttons: `[Pay — Stripe] [Pay — Green Invoice]`
- **Display:** Currently editable but not shown as clickable links anywhere

### sessions.start_time
- **Where:** Sessions table
- **How:** Additional column after Date: `10:00`
- **Display:** 24h format

### packages.updated_at
- **Where:** Package card footer
- **How:** `Updated: 3 days ago` in addition to the created_at date
- **Display:** Relative time

### deals.updated_at
- **Where:** Deal edit modal footer, deal slide
- **How:** `Updated: 2 days ago` below the created_at line
- **Display:** Relative time format

### bills.submitted_at / bills.approved_at
- **Where:** Bill detail view / history row
- **How:** Timeline of status changes: `Submitted Apr 8 → Approved Apr 9 → Paid Apr 10`
- **Display:** Status timeline chips

### paychecks.notes
- **Where:** Vendor payments tab — individual paycheck row
- **How:** Expand row to show notes, or show in tooltip
- **Display:** Small italic text below the row

### rates table (management UI)
- **Where:** Vendor detail — new "Rates" tab
- **How:** Table of session_type → rate → currency with add/edit/delete
- **Currently:** 36 rows in DB, no management UI. Rates are used for paycheck calculation but can't be viewed.

---

## LOW PRIORITY — Backend-only / can stay hidden

### All `id` (uuid) fields
All primary keys — display in URL and debug contexts only.

### `clients.customer_id`
External sync reference. Not useful in admin UI — show only in a developer/debug panel if needed.

### `vendors.paying_company_id`
Links vendor to which company pays them. No companies UI built yet.

### `deals.updated_at`
Tracked automatically — low priority to surface.

### `sessions.billed`, `sessions.bill_id`
Internal billing workflow flags. Don't surface to admin.

### `sessions.package_id`
Affects package counter silently — correct behavior, no need to expose.

### `vendor_hours.synced`
Internal paycheck sync flag.

### `paychecks.base_amount_usd`, `paychecks.exchange_rate_id`
Internal multi-currency calculation fields. Only relevant in an exchange rate management UI.

### `paychecks.company_id`
Backend only until a multi-company UI is built.

### `bills.paid_from_account_id`
Backend only until accounts UI is built.

### `deal_documents.storage_path`, `deal_documents.size_kb`
Technical metadata — already shown via the documents tab indirectly.

### `documents.uploaded_by`
Could be shown in tooltip but low value right now.

---

## Summary Counts

| Priority | Count |
|---|---|
| HIGH — missing, operationally important | 11 areas |
| MEDIUM — useful context | 14 areas |
| LOW — backend-only | 12 areas |

### Quickest wins (low effort, high value):
1. `deals.stripe_payment_link` — one link field in deal modal
2. `deal_reminders` — already queried, just needs render function
3. `deals.discount` — one text input in deal modal
4. `paychecks.payment_date` — one date column in vendor payments table
5. `vendors.contract_url` — one URL input in vendor profile
