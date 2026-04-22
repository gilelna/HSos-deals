# Testing Plan: Product Plan Selection

Use test customers: anna@example.com (IL), john@example.com (US), marie@example.com (FR/EU)

---

## Test 1: Customer Search

- [ ] Open New Deal modal → Step 1 shows
- [ ] Type partial email (e.g. "anna") → autocomplete dropdown appears within 300ms
- [ ] Autocomplete shows matching customer name + email + country flag
- [ ] Select existing customer → dropdown hides, customer card appears
- [ ] Customer card shows name, email, country
- [ ] "Change" button on card → clears selection, shows search input again
- [ ] Click "+ New Customer" → new customer form appears
- [ ] Fill email + name + country → "Next" button enables
- [ ] Leave required field blank → "Next" button stays disabled

## Test 2: Product Selection & Plan Routing

- [ ] Step 2: Product dropdown lists all products
- [ ] Select "Trial Lesson" (has_plans=true) → plan selection area appears
- [ ] With IL customer: IL — Green Invoice plan shown first (priority 10 < 20)
- [ ] With US customer: US — ThriveCart plan shown, EU plan shown below
- [ ] With FR customer (EU): EU — ThriveCart (single, default) shown first
- [ ] Plan options rendered as radio cards (not a plain select)
- [ ] Select a plan → summary box appears showing amount, currency, gateway, installments
- [ ] "Next" button enables only after a plan is selected

## Test 3: 10-Lesson Package — Installment Plans

- [ ] Select "10-Lesson Package" with US customer
- [ ] Two US plans shown: 500 USD × 1 and 520 USD × 3
- [ ] Summary for 3-installment plan shows "3 installments of ~$173"
- [ ] Select "10-Lesson Package" with EU customer
- [ ] Two EU plans shown: 480 EUR × 1 and 500 EUR × 3

## Test 4: Green Invoice Plan (IL)

- [ ] Select any product with IL plan, pick anna@example.com
- [ ] IL plan auto-suggested first
- [ ] Select plan → summary shows gateway = "Green Invoice"
- [ ] Create deal → payment_link shows GI placeholder URL
- [ ] Deal record in DB has payment_method = 'green_invoice'

## Test 5: ThriveCart Plan (US/EU)

- [ ] Select "Trial Lesson" with john@example.com (US)
- [ ] US plan auto-suggested
- [ ] Select plan → summary shows ThriveCart link
- [ ] Create deal → payment_link = 'https://tc.thrivecart.com/trial-lesson-usd/'
- [ ] Copy button copies link to clipboard
- [ ] Deal record in DB has payment_method = 'thrivecart', payment_link set

## Test 6: Step 3 Review

- [ ] Step 3 shows customer summary (name, email, country)
- [ ] Step 3 shows product + plan summary (name, price, gateway)
- [ ] Notes field is optional — deal can be created without notes
- [ ] "← Back" goes to Step 2 with selections preserved
- [ ] "Create Deal" button triggers deal creation

## Test 7: Deal Creation & Success State

- [ ] New customer email → customer row created in customers table
- [ ] Existing customer email → no duplicate created (check by email)
- [ ] Client created if no existing client linked to customer
- [ ] Existing client (customer_id_fk set) → reused, not duplicated
- [ ] Deal row created with product_plan_id, payment_method, payment_link
- [ ] Success state shown with payment link in copyable input
- [ ] "Create Another Deal" → resets flow to Step 1
- [ ] "View Deal" → navigates to deal detail

## Test 8: Products Without Plans (Fallback)

- [ ] Select a product with has_plans=false (e.g. "1:1 Consulting Session")
- [ ] Plan selection area does NOT appear
- [ ] Step 2 shows standard price/vendor fields instead
- [ ] Existing deal creation flow works as before — no regression

## Edge Cases

- [ ] Type email that doesn't exist → no autocomplete results shown (not an error)
- [ ] Create deal with same email twice → second deal reuses existing customer
- [ ] Switch product after selecting a plan → plan selection resets
- [ ] Switch customer country after selecting a plan → plan re-sorted
- [ ] No plans match customer country → default plan (is_default=true) shown
- [ ] Product has plans but all are inactive → falls back to standard flow
