# HSos — Schema Audit: DB vs UI

> Generated: 2026-04-10
> Legend: ✅ DISPLAYED · ⚠️ PARTIALLY DISPLAYED · ❌ NOT DISPLAYED

---

## Table: `clients`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `customer_id` | text | ❌ NOT DISPLAYED | External reference (ActiveCampaign etc.) — never shown |
| `full_name` | text | ✅ DISPLAYED | Hero, list, everywhere |
| `email` | text | ✅ DISPLAYED | Hero subtitle, list sidebar |
| `phone` | text | ✅ DISPLAYED | Overview contact grid |
| `client_kind` | text | ✅ DISPLAYED | Overview contact grid ("Kind") |
| `company` | text | ✅ DISPLAYED | Overview contact grid |
| `source` | text | ✅ DISPLAYED | Overview contact grid |
| `notes` | text | ✅ DISPLAYED | Overview tab (Quill editor, auto-save) |
| `active` | boolean | ⚠️ PARTIALLY DISPLAYED | Hero shows "Active/Inactive" pill — not in list sidebar |
| `created_at` | timestamptz | ❌ NOT DISPLAYED | Never shown in any view |

---

## Table: `vendors`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `full_name` | text | ✅ DISPLAYED | Table row, detail panel, chips |
| `nickname` | text | ❌ NOT DISPLAYED | Exists but never rendered |
| `email` | text | ✅ DISPLAYED | Table row sub-text, detail form |
| `phone` | text | ✅ DISPLAYED | Detail profile form |
| `vendor_type` | enum | ✅ DISPLAYED | Table row, detail header |
| `payment_method` | text | ✅ DISPLAYED | Table row, detail profile form |
| `payment_id` | text | ⚠️ PARTIALLY DISPLAYED | Merged into "IBAN / Payment ID" field in edit form — label is confusing |
| `iban` | text | ⚠️ PARTIALLY DISPLAYED | Shown combined with payment_id in edit form |
| `preferred_currency` | text | ✅ DISPLAYED | Table row, detail form |
| `contract_url` | text | ❌ NOT DISPLAYED | Never shown — link to vendor contract |
| `active` | boolean | ❌ NOT DISPLAYED | Filtered out (`eq('active', true)`) but status never shown |
| `notes` | text | ✅ DISPLAYED | Detail profile form (textarea) |
| `created_at` | timestamptz | ❌ NOT DISPLAYED | Never shown |
| `service_types` | jsonb | ❌ NOT DISPLAYED | Never shown or edited |
| `payout_currency` | enum (usd/ils/eur) | ❌ NOT DISPLAYED | Different from preferred_currency — never shown |
| `paying_company_id` | uuid FK→companies | ❌ NOT DISPLAYED | Never shown |

---

## Table: `deals`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `client_id` | uuid FK | ✅ DISPLAYED | As client name everywhere |
| `primary_vendor_id` | uuid FK | ✅ DISPLAYED | Kanban card, list, detail |
| `owner_vendor_id` | uuid FK | ❌ NOT DISPLAYED | "Deal owner" — never shown in any UI |
| `product_id` | uuid FK | ✅ DISPLAYED | As product name |
| `price` | numeric | ✅ DISPLAYED | Kanban card, list, detail |
| `currency` | text | ✅ DISPLAYED | With price everywhere |
| `vat_pct` | numeric | ✅ DISPLAYED | Edit modal VAT field + preview |
| `vat_mode` | enum (excl/incl) | ✅ DISPLAYED | Edit modal |
| `discount` | text | ❌ NOT DISPLAYED | Field exists, never shown or editable |
| `sales_status` | enum | ✅ DISPLAYED | Kanban column, list, badges |
| `billing_status` | enum | ✅ DISPLAYED | Kanban card, list, deal slide |
| `payment_processor` | enum | ⚠️ PARTIALLY DISPLAYED | List column + edit modal (as free text input, not enum select) |
| `gi_client_id` | text | ❌ NOT DISPLAYED | Green Invoice client ID — never shown |
| `gi_invoice_series` | text | ❌ NOT DISPLAYED | Green Invoice series — never shown |
| `stripe_customer_id` | text | ❌ NOT DISPLAYED | Never shown |
| `stripe_payment_link` | text | ❌ NOT DISPLAYED | Never shown — actionable link |
| `wise_iban` | text | ❌ NOT DISPLAYED | Never shown |
| `wise_bank_ref` | text | ❌ NOT DISPLAYED | Never shown |
| `thrive_ref` | text | ❌ NOT DISPLAYED | ThriveCart reference — never shown |
| `notes` | text | ✅ DISPLAYED | Edit modal (Quill), deal slide read-only |
| `created_at` | timestamptz | ⚠️ PARTIALLY DISPLAYED | Edit modal footer, deal slide grid — not in kanban/list |
| `updated_at` | timestamptz | ❌ NOT DISPLAYED | Never shown |
| `origin` | enum | ✅ DISPLAYED | Deal slide badge, client-profile deal list |
| `external_id` | text | ⚠️ PARTIALLY DISPLAYED | Only shown in deal slide if non-null |

---

## Table: `products`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `name` | text | ✅ DISPLAYED | Table, all deal views |
| `type` | enum | ✅ DISPLAYED | Table row badge, product modal |
| `base_price` | numeric | ✅ DISPLAYED | Table, product modal |
| `currency` | text | ✅ DISPLAYED | With base_price |
| `units` | text | ❌ NOT DISPLAYED | Exists, never shown or editable in product modal |
| `notes` | text | ✅ DISPLAYED | Product modal textarea |
| `active` | boolean | ❌ NOT DISPLAYED | Filtered out but status never shown |
| `payment_links` | jsonb | ⚠️ PARTIALLY DISPLAYED | Editable as raw JSON textarea — not rendered as clickable links |
| `created_at` | timestamptz | ❌ NOT DISPLAYED | Never shown |
| `category` | text | ✅ DISPLAYED | Table row, product modal |
| `default_package_sessions` | int | ✅ DISPLAYED | Table row (for packages), product modal |

---

## Table: `packages`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `deal_id` | uuid FK | ✅ DISPLAYED | Package card links to deal (deal name + price shown) |
| `client_id` | uuid FK | ❌ NOT DISPLAYED | Implied from context |
| `vendor_id` | uuid FK | ✅ DISPLAYED | Package grouped by vendor name |
| `total_sessions` | int | ✅ DISPLAYED | Progress nums and bar |
| `sessions_used` | int | ✅ DISPLAYED | Progress nums and bar |
| `status` | enum | ✅ DISPLAYED | Status pill (active/completed/cancelled) |
| `created_at` | timestamptz | ✅ DISPLAYED | Package card footer |
| `updated_at` | timestamptz | ❌ NOT DISPLAYED | Never shown |

---

## Table: `vendor_hours`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `vendor_id` | uuid FK | ❌ NOT DISPLAYED | Not surfaced in admin UI |
| `deal_id` | uuid FK | ❌ NOT DISPLAYED | Not surfaced in admin UI |
| `session_id` | uuid FK | ❌ NOT DISPLAYED | Not surfaced in admin UI |
| `date` | date | ❌ NOT DISPLAYED | Not surfaced in admin UI |
| `hours` | numeric | ❌ NOT DISPLAYED | Not surfaced in admin UI |
| `session_type` | enum | ❌ NOT DISPLAYED | Not surfaced in admin UI |
| `rate` | numeric | ❌ NOT DISPLAYED | Not surfaced in admin UI |
| `notes` | text | ❌ NOT DISPLAYED | Not surfaced in admin UI |
| `synced` | boolean | ❌ NOT DISPLAYED | Backend-only paycheck flag |
| `created_at` | timestamptz | ❌ NOT DISPLAYED | Not surfaced in admin UI |

> Note: vendor_hours table has 0 rows and no admin UI. Only the vendor workload module would surface these (workload.js).

---

## Table: `paychecks`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `vendor_id` | uuid FK | ✅ DISPLAYED | Contextual — shown within vendor detail |
| `month` | text | ✅ DISPLAYED | Vendor payments tab table |
| `total_hours` | numeric | ✅ DISPLAYED | Vendor payments tab table + summary card |
| `amount` | numeric | ✅ DISPLAYED | Vendor payments tab table + summary card |
| `currency` | text | ✅ DISPLAYED | With amount |
| `status` | text | ✅ DISPLAYED | Status pill in table |
| `payment_date` | date | ❌ NOT DISPLAYED | Exists, never shown |
| `notes` | text | ❌ NOT DISPLAYED | Exists, never shown |
| `created_at` | timestamptz | ❌ NOT DISPLAYED | Never shown |
| `base_amount_usd` | numeric | ❌ NOT DISPLAYED | Multi-currency internal — never shown |
| `payout_amount` | numeric | ❌ NOT DISPLAYED | Never shown (separate from `amount`) |
| `payout_currency` | enum | ❌ NOT DISPLAYED | Never shown |
| `exchange_rate_id` | uuid FK | ❌ NOT DISPLAYED | Backend only |
| `company_id` | uuid FK | ❌ NOT DISPLAYED | Backend only |
| `actual_amount_paid` | numeric | ❌ NOT DISPLAYED | What was actually transferred — never shown |

---

## Table: `payments`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `deal_id` | uuid FK | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `client_id` | uuid FK | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `vendor_id` | uuid FK | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `type` | text | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `direction` | text | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `amount` | numeric | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `currency` | text | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `payment_date` | date | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `method` | text | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `reference` | text | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `status` | text | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `tax_kind` | text | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `notes` | text | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |
| `created_at` | timestamptz | ❌ NOT DISPLAYED | Table has 0 rows, no UI built |

> Note: The `payments` table is entirely unused — no rows and no UI. The `payments.html` page uses the `bills` table instead.

---

## Table: `bills`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `vendor_id` | uuid FK | ✅ DISPLAYED | Contextual within vendor detail view |
| `status` | text | ✅ DISPLAYED | Section grouping (draft/approved/paid) |
| `created_at` | timestamptz | ⚠️ PARTIALLY DISPLAYED | Shown in "draft meta" text block |
| `submitted_at` | timestamptz | ❌ NOT DISPLAYED | Never shown |
| `returned_at` | timestamptz | ❌ NOT DISPLAYED | Never shown |
| `approved_at` | timestamptz | ❌ NOT DISPLAYED | Never shown |
| `paid_at` | timestamptz | ✅ DISPLAYED | Payment history section |
| `total_amount` | numeric | ✅ DISPLAYED | Draft bill header + history |
| `currency` | text | ✅ DISPLAYED | With amount |
| `vendor_notes` | text | ❌ NOT DISPLAYED | Submitted by vendor, never shown to admin |
| `finance_notes` | text | ❌ NOT DISPLAYED | Never shown |
| `payment_method` | text | ❌ NOT DISPLAYED | How vendor was paid — never shown |
| `payment_reference` | text | ❌ NOT DISPLAYED | Transfer reference — never shown |
| `paid_from_account_id` | uuid FK | ❌ NOT DISPLAYED | Backend only |

---

## Table: `sessions`

| Field | Type | Display Status | Where Shown |
|---|---|---|---|
| `id` | uuid | ❌ NOT DISPLAYED | Backend only |
| `deal_id` | uuid FK | ❌ NOT DISPLAYED | Not shown in session rows |
| `vendor_id` | uuid FK | ✅ DISPLAYED | As vendor name in session table |
| `client_id` | uuid FK | ✅ DISPLAYED | As client name in bill sessions table |
| `session_date` | date | ✅ DISPLAYED | Sessions table, bill sessions |
| `start_time` | time | ❌ NOT DISPLAYED | Never shown in any view |
| `duration_min` | int | ✅ DISPLAYED | Sessions table ("Duration" column) |
| `session_type` | enum | ✅ DISPLAYED | Sessions table, bill sessions |
| `status` | enum | ✅ DISPLAYED | Sessions table pill |
| `notes` | text | ✅ DISPLAYED | Sessions table last column |
| `created_at` | timestamptz | ❌ NOT DISPLAYED | Never shown |
| `package_id` | uuid FK | ❌ NOT DISPLAYED | Affects package counter but not shown |
| `billed` | boolean | ❌ NOT DISPLAYED | Backend flag only |
| `bill_id` | uuid FK | ❌ NOT DISPLAYED | Backend only |
| `task_type_id` | uuid FK | ✅ DISPLAYED | Shown as "Task type" in bill sessions |
| `rate_usd` | numeric | ❌ NOT DISPLAYED | Per-session rate — never shown |
| `hours` | numeric | ✅ DISPLAYED | Shown in sessions when duration_min is null |

---

## Other Tables (admin-only / no UI)

| Table | Rows | UI Status |
|---|---|---|
| `profiles` | 0 | ❌ No UI — auth metadata |
| `rates` | 36 | ⚠️ Exists in DB, no admin rates management UI |
| `vendor_clients` | 22 | ✅ Used via vendor detail → Clients tab |
| `vendor_client_assignments` | 0 | ⚠️ Shown as timeline markers in sessions tab only |
| `deal_documents` | 0 | ✅ UI exists in deals modal (referenced but not rendered in detail panel) |
| `deal_reminders` | 0 | ❌ Loaded in query but no UI renders them |
| `documents` | 1 | ✅ Client documents tab fully implemented |
| `invoices` | 0 | ❌ Table exists, no UI |
| `companies` | 2 | ❌ No UI |
| `accounts` | 0 | ❌ No UI |
| `task_types` | 14 | ⚠️ Used in bills/sessions — no management UI |
| `exchange_rates` | 1 | ❌ No UI |
| `rates` | 36 | ❌ No management UI |
