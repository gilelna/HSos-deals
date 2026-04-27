# HSos — SCHEMA.md
_Single source of truth for database schema, enums, and vendor model._
_Every migration MUST update this file. Every AI session MUST read this before touching DB or UI code._

Last updated: 2026-04-22 (activities foundation — migration 016, profiles patch, activities table + 5 db.js functions)

---

## Environments

| Env | Supabase Project | URL |
|-----|-----------------|-----|
| Demo | pqkzffgpkpovternesmt | https://pqkzffgpkpovternesmt.supabase.co |
| Production | wmqmonjnmgtoilxfqqkv | https://wmqmonjnmgtoilxfqqkv.supabase.co |

**Rule:** Every migration runs on BOTH environments. No exceptions.
**Rule:** After every schema change, run `NOTIFY pgrst, 'reload schema';`
**Rule:** After every migration, update this file + STATUS.md + add entry to CHANGELOG.md.

---

## Enums (authoritative list)

```sql
vendor_type:       coach | contractor | team_member | merchant
billing_status:    pending | link_sent | invoiced | partial | paid | overdue
sales_status:      lead | qualified | active | delivered | closed
session_status:    planned | done | cancelled | no_show
session_type:      coaching | consulting | editing | design | admin | other
product_type:      session | package | workshop | custom
system_role:       admin | manager | finance | vendor
payment_processor: stripe | wise | thrive | other
vat_mode:          excl | incl
origin:            manual | thrivecart | green_invoice | other
```

⚠️ `merchant` and `payment_cadence` are PENDING — not yet in DB enum/columns. Migration 010 adds them. UI is ready.


---

## Vendor Model

All "parties we pay" live in the `vendors` table. `vendor_type` controls behavior and visibility.

| vendor_type | Workload | Bills | Clients | Finance visibility | Transactions |
|---|---|---|---|---|---|
| `coach` | ✅ | ✅ | ✅ students | All roles | via bills |
| `contractor` | ✅ hours | ✅ | ❌ | All roles | via bills |
| `team_member` | ✅ hours | ✅ | ❌ | **Finance + Admin only** | via bills |
| `merchant` | ❌ | ❌ | ❌ | All roles | directly in transactions |

### payment_cadence (pending migration 010)

Set on vendor, auto-inherited by transactions on merchant match. Drives budget forecasting.

| value | meaning | example |
|---|---|---|
| `recurring` | Fixed, every month | Notion, AWS, CFO salary |
| `project_based` | Variable, workload-driven | Coaches, contractors |
| `one_time` | Not expected to repeat | IKEA, one-off flight |

---

## Tables

### Old tables — uuid PKs
`clients`, `deals`, `vendors`, `sessions`, `bills`, `packages`, `rates`,
`product_plans`, `customers`, `task_types`, `deal_reminders`, `deal_documents`,
`vendor_client_assignments`, `paychecks`, `exchange_rates`, `documents`

### New tables — text PKs
`companies`, `accounts`, `transaction_categories`, `transaction_tags`,
`transactions`, `products`, `plans`, `programs`, `import_logs`,
`account_balances`, `system_settings`, `audit_log`, `activities`

### profiles
```
id          uuid PK    -- will match auth.users.id after Google OAuth (Phase 2)
role        system_role NOT NULL DEFAULT 'vendor'  ← admin | manager | finance | vendor
vendor_id   text → vendors(id) ON DELETE SET NULL  ← set for vendor-role users only
full_name   text
email         text UNIQUE
slack_user_id text
created_at    timestamptz
updated_at    timestamptz
```

### activities
```
id            uuid PK    DEFAULT gen_random_uuid()
entity_type   text NOT NULL   ← 'client' | 'deal' | 'vendor' | 'session' | 'paycheck' | 'invoice' | 'global'
entity_id     uuid            ← null only when entity_type = 'global'
type          text NOT NULL   ← 'note' | 'reminder' | 'system_log' | 'integration_event'
subtype       text            ← 'status_change' | 'stage_move' | 'payment_sent' | 'slack_sent' | 'ac_tag_added'
body          text            ← plain Markdown only (bold, italic, URLs). No HTML.
created_by    uuid → profiles(id) ON DELETE SET NULL
origin        text NOT NULL DEFAULT 'user'  ← 'user' | 'system' | 'integration'
due_at        timestamptz     ← reminders only
status        text            ← 'pending' | 'done' | 'dismissed' (reminders only, null otherwise)
meta          jsonb NOT NULL DEFAULT '{}'
created_at    timestamptz NOT NULL DEFAULT now()
```


---

## Key columns per table

### vendors
```
id                 text PK
name               text
vendor_type        vendor_type enum  ← coach | contractor | team_member | merchant
is_active          boolean
payment_cadence    text              ← recurring | project_based | one_time  (migration 010)
category_id        text → transaction_categories(id)
tax_treatment      text
entity             text              ← business | private
tags               text[]
match_patterns     text[]            ← alias strings for auto-matching transactions
preferred_currency text
```

### transactions
```
id                 uuid PK
source             text              ← thrivecart | green_invoice | wise | bank | manual
direction          text              ← in | out
status             text              ← unmatched | matched | reconciled
amount             numeric
currency           text
counterparty_name  text
transaction_date   date
account_id         text → accounts(id)
vendor_id          uuid → vendors(id)        ← set after merchant matching
category_id        text → transaction_categories(id)
tax_treatment      text
entity             text              ← business | private
tags               text[]
payment_cadence    text              ← inherited from vendor on match (migration 010)
deleted_at         timestamptz       ← soft delete (migration 008)
duplicate_of       uuid → transactions(id)   (migration 008)
import_id          text → import_logs(id)    (migration 008)
raw_data           jsonb
```

### transaction_categories
```
id             text PK   ← e.g. 'ca_software', 'ca_payroll'
name           text
tax_category   text
match_patterns text       ← comma-separated patterns for auto-classification
status         text       ← active | inactive
```


---

## Classification layers (transactions)

| Layer | Field | Type | Source |
|---|---|---|---|
| 1 | `category_id` | FK → transaction_categories | Vendor default or manual |
| 2 | `tax_treatment` | text (fixed list below) | Auto from category, overrideable |
| 3 | `entity` | business \| private | Vendor default or manual |
| 4 | `tags` | text[] | Free text, autocomplete from tag pool |
| 5 | `payment_cadence` | recurring \| project_based \| one_time | Inherited from vendor |

### Tax treatment values (fixed — do not change without updating UI constants)
```
non_deductible
mixed_review
income
business_payroll_contractors
business_professional_services
business_banking_fees
business_taxes_government
business_insurance
business_software_online
business_travel
business_equipment
business_marketing
business_training
```

---

## Role visibility rules

| Data | Admin | Finance | Manager | Vendor |
|---|---|---|---|---|
| team_member bills & transactions | ✅ | ✅ | ❌ | ❌ |
| All other vendor financials | ✅ | ✅ | ✅ | own only |
| Merchant transactions | ✅ | ✅ | ✅ | ❌ |
| Classification fields | ✅ | ✅ | ✅ | ❌ |

---

## Migration log

| File | Description | Envs |
|------|-------------|------|
| 004_products_plans_transactions.sql | Products, plans, transactions tables | ✅ Both |
| 005_transaction_tags.sql | transaction_tags table | ✅ Both |
| 006_account_balances_monthly_snapshots.sql | account_balances table | ⚠️ Production only — run on Demo |
| 007_transactions_account_id.sql | transactions.account_id → FK to accounts | ✅ Both |
| 008_tx_drawer_dedup_audit.sql | deleted_at, duplicate_of, import_id, audit_log | ⚠️ NOT RUN — run on both |
| 009_classification_columns.sql | category_id, tax_treatment, entity, tags on tx + vendors | ⚠️ NOT RUN — run on both |
| 010_vendor_merchant_cadence.sql | merchant to vendor_type enum, payment_cadence on vendors + transactions, vendor_id on transactions | ⚠️ NOT YET RUN — UI ready, run migration on both envs to activate |
| 011_products_plans_new_columns.sql | logo_url, category, status, price_min/max, currency, links, prd_uid on products; plan_uid, plan_type, status, description, link_source, link_id on plans; PLN/PRD auto-uid triggers | ✅ Demo — run on Production |
| 015_profiles_role_foundation.sql | profiles table with system_role FK, RLS open for demo | ⚠️ NOT YET RUN — run on both |
| 016_activities_foundation.sql | Patch profiles (email, slack_user_id, updated_at); create activities + 6 indexes | ✅ Production — run on Demo |
| 018_performance_indexes.sql | (proposed for perf pass) — NOT NEEDED. Audit on 2026-04-27 confirmed `idx_clients_active`, `idx_deals_sales_status`, `idx_deals_billing_status`, `idx_vendor_hours_vendor` already exist on demo; `vendor_hours.paycheck_id` does not exist (no FK to paychecks on that table). | 🚫 Skipped |


---

### products (uuid PK — old table, new columns added migration 011)
```
id               uuid PK
name             text
program_id       uuid → programs(id)
description      text
category         text       ← Coaching program | Online course | Group coaching | Workshop | Custom
status           text       ← active | draft | archived  (default: active)
logo_url         text
currency         text
price_min        numeric    ← manual override; auto-computed from plans if null
price_max        numeric    ← manual override; auto-computed from plans if null
links            jsonb      ← [{ "label": "Sales page", "url": "https://…" }]
prd_uid          text UNIQUE ← PRD-0001 format, auto-assigned on insert
active           boolean    ← legacy column
created_at       timestamptz
```

### plans (uuid PK — old table, new columns added migration 011)
```
id               uuid PK
product_id       uuid → products(id)
name             text
plan_type        text       ← One payment | 3 payments | 4 payments | 5 payments | Subscription
plan_uid         text UNIQUE ← PLN-0001 format, auto-assigned on insert
status           text       ← active | draft | archived  (default: active)
amount           numeric
currency         text
description      text       ← internal note
link_source      text       ← ThriveCart | Green Invoice | Stripe | PayPal | Manual URL
link_id          text       ← source-specific ID (e.g. ThriveCart product ID)
link_url         text       ← full payment URL
payment_type     text       ← legacy (maps to plan_type)
payment_rail     text       ← legacy (maps to link_source)
payment_link_url text       ← legacy (maps to link_url)
external_id      text       ← legacy (maps to link_id)
active           boolean    ← legacy
created_at       timestamptz
```

---

## db.js function index (key functions)

| Function | Table | Notes |
|---|---|---|
| `getTransactions({ includeDeleted })` | transactions | Full select with account join |
| `getAccounts()` | accounts | All active accounts |
| `getVendors()` | vendors | All vendors |
| `getTransactionCategories()` | transaction_categories | Active only |
| `getTransactionTags()` | transaction_tags | Active only |
| `getCompanies()` | companies | |
| `getAllProductsWithPlans()` | products + plans | Flat list; plans nested per product |
| `createProductFull(fields)` | products | prd_uid auto-assigned by trigger |
| `updateProductFull(id, fields)` | products | |
| `deleteProductFull(id)` | products + plans | Cascades plan deletion |
| `createPlanFull(fields)` | plans | plan_uid auto-assigned by trigger |
| `updatePlanFull(id, fields)` | plans | |
| `deletePlanFull(id)` | plans | |
| `logActivity(fields)` | activities | Insert one activity row |
| `getActivities({ type, status, search })` | activities | All activities with optional filters |
| `getClientReminders(clientId)` | activities | Client reminders ordered by due_at |
| `getNotifications()` | activities | Pending reminders + integration events, limit 20 |
| `updateActivity(id, fields)` | activities | Patch any field (e.g. status) |

**Rule:** Every new DB query goes into db.js as a named function. Never write `.from(...)` directly in page JS files.

---

## Checklist: when adding a column or table

- [ ] Write migration SQL → `/migrations/NNN_description.sql`
- [ ] Run on Demo DB (pqkzffgpkpovternesmt)
- [ ] Run on Production DB (wmqmonjnmgtoilxfqqkv)
- [ ] Update **SCHEMA.md** → table columns + migration log
- [ ] Update **PRODUCTION_SCHEMA.sql** to include the change
- [ ] Add/update function in **db.js**
- [ ] Update **RULES.md** enum list if an enum changed
- [ ] Update **STATUS.md** → DB schema state section
- [ ] Add entry to **CHANGELOG.md**
