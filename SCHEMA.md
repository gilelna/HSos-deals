# HSos — SCHEMA.md
_Single source of truth for database schema, enums, and data model._
_Reflects actual Demo DB state as of 2026-04-27. Production DB is frozen — schema synced at Phase 1 completion._

Last updated: 2026-04-27 (full re-sync against demo DB — backup tables dropped, enums corrected, vendor_type corrected to real enum)

---

## Environments

| Env | Supabase Project | URL | Status |
|-----|-----------------|-----|--------|
| Demo | pqkzffgpkpovternesmt | https://pqkzffgpkpovternesmt.supabase.co | ✅ Active — source of truth |
| Production | wmqmonjnmgtoilxfqqkv | https://wmqmonjnmgtoilxfqqkv.supabase.co | 🧊 Frozen — synced at Phase 1 close |

**Rule:** All Phase 1 development happens on Demo only. Production is updated once at Phase 1 completion.
**Rule:** After every schema change, run `NOTIFY pgrst, 'reload schema';`
**Rule:** After every migration, update this file + STATUS.md + add entry to CHANGELOG.md.

---

## Enums (authoritative — verified against DB 2026-04-27)

```sql
vendor_type:          coach | contractor | team_member | subscription | software_saas | merchant
billing_status:       pending | invoiced | partial | paid | overdue
sales_status:         lead | qualified | active | delivered | closed
session_status:       planned | done | cancelled | no_show
session_type:         coaching | consulting | editing | design | admin | other
package_status:       active | completed | cancelled
product_type:         session | package | workshop | custom
system_role:          admin | manager | finance | vendor
payment_processor:    stripe | wise | thrive | other
payout_currency:      usd | ils | eur
vat_mode:             excl | incl
deal_origin:          manual | thrivecart | stripe | other
document_entity_type: deal | client | vendor
document_type:        upload | url
exchange_rate_source: manual | wise
account_status:       active | inactive | closed
account_type:         bank | card | paypal | stripe | wise | other
currency_code:        USD | EUR | ILS | GBP
```

⚠️ `billing_status` does NOT include `link_sent` — was referenced in CHANGELOG but never applied to DB enum.
⚠️ `vendor_type` IS a real DB enum (not text). Includes `subscription` and `software_saas` in addition to the 4 core types.
⚠️ `origin` enum on deals is named `deal_origin` in DB (not `origin`).

---

## Vendor Model

All "parties we pay or track" live in the `vendors` table. `vendor_type` controls behavior and visibility.

| vendor_type | Workload | Bills | Clients | Finance visibility | Transactions |
|---|---|---|---|---|---|
| `coach` | ✅ | ✅ | ✅ students | All roles | via bills |
| `contractor` | ✅ | ✅ | ❌ | All roles | via bills |
| `team_member` | ✅ | ✅ | ❌ | Finance + Admin only | via bills |
| `merchant` | ❌ | ❌ | ❌ | All roles | directly in transactions |
| `subscription` | ❌ | ❌ | ❌ | All roles | directly in transactions |
| `software_saas` | ❌ | ❌ | ❌ | All roles | directly in transactions |

### payment_cadence
Set on vendor; inherited by transactions on merchant/subscription match.

| value | meaning |
|---|---|
| `recurring` | Fixed every month (Notion, AWS, salary) |
| `project_based` | Variable, workload-driven (coaches, contractors) |
| `one_time` | Not expected to repeat |

---

## Table Inventory (Demo DB — 2026-04-27)

| Table | PK type | Rows | RLS | Notes |
|-------|---------|------|-----|-------|
| `clients` | uuid | 32 | ❌ | |
| `vendors` | uuid | 33 | ✅ | generated cols: full_name, active |
| `deals` | uuid | 35 | ✅ | |
| `sessions` | uuid | 153 | ✅ | |
| `bills` | uuid | 35 | ✅ | |
| `packages` | uuid | 16 | ❌ | |
| `task_types` | uuid | 14 | ❌ | |
| `rates` | uuid | 40 | ✅ | |
| `paychecks` | uuid | 4 | ✅ | |
| `payments` | uuid | 0 | ✅ | legacy table, mostly unused |
| `invoices` | uuid | 0 | ✅ | legacy table, mostly unused |
| `deal_documents` | uuid | 0 | ✅ | |
| `deal_reminders` | uuid | 7 | ✅ | |
| `documents` | uuid | 1 | ✅ | unified doc table |
| `vendor_clients` | uuid | 33 | ❌ | junction: vendor ↔ client |
| `vendor_client_assignments` | uuid | 0 | ✅ | audit trail for reassignments |
| `vendor_hours` | uuid | 0 | ✅ | legacy work log (V1) |
| `customers` | uuid | 3 | ❌ | external buyer layer |
| `exchange_rates` | uuid | 1 | ✅ | |
| `programs` | uuid | 7 | ❌ | |
| `products` | uuid | 18 | ❌ | |
| `plans` | uuid | 66 | ❌ | |
| `account_balances` | uuid | 1 | ❌ | |
| `import_logs` | uuid | 4 | ❌ | legacy import log |
| `profiles` | uuid | 0 | ✅ | → auth.users |
| `activities` | uuid | 2 | ✅ | |
| `audit_log` | uuid | 18 | ✅ | |
| `companies` | text | 3 | ✅ | |
| `accounts` | text | 17 | ✅ | |
| `transaction_categories` | text | 28 | ✅ | |
| `transaction_tags` | text | 44 | ❌ | |
| `transactions` | uuid | 2060 | ❌ | |
| `transaction_imports` | text | 45 | ✅ | |
| `classification_rules` | text | 15 | ✅ | |
| `fee_rules` | text | 4 | ✅ | |
| `system_settings` | text (key) | 4 | ❌ | |

**Note on PK types:** Most original tables use `uuid`. Newer financial tables (companies, accounts, transaction_categories, etc.) use `text`. Do NOT add FK constraints between these without explicit type cast.

---

## Key columns per table

### vendors
```
id                 uuid PK (gen_random_uuid())
name               text NOT NULL
full_name          text GENERATED ALWAYS AS (name)   ← alias, use in queries
active             boolean GENERATED ALWAYS AS (is_active)  ← alias
is_active          boolean NOT NULL DEFAULT true
vendor_type        vendor_type enum  ← coach | contractor | team_member | subscription | software_saas | merchant
email              text
payout_currency    text              ← preferred payout currency
company_id         text → companies(id)
category_id        text → transaction_categories(id)
tax_treatment      text
entity             text              ← business | private
cadence            text              ← DEPRECATED: use payment_cadence
payment_cadence    text CHECK (recurring | project_based | one_time)
match_patterns     text[]            ← counterparty_name strings for auto-classify
merge_name         text              ← display name override for matched transactions
tags               text[]
notes              text
created_at         timestamptz DEFAULT now()
```

### clients
```
id                 uuid PK
full_name          text NOT NULL
email              text
phone              text
client_kind        text              ← private | corporate
company            text
source             text
notes              text
active             boolean DEFAULT true
customer_id        text              ← external ref (AC, ThriveCart, etc.)
customer_id_fk     uuid → customers(id)
created_at         timestamptz
```

### deals
```
id                 uuid PK
client_id          uuid → clients(id)
primary_vendor_id  uuid → vendors(id)
product_id         uuid → products(id)
plan_id            uuid → plans(id)
agreed_price       numeric
agreed_currency    text
vat_pct            numeric DEFAULT 0
vat_mode           vat_mode enum DEFAULT 'excl'
sales_status       sales_status enum DEFAULT 'lead'
billing_status     billing_status enum DEFAULT 'pending'
payment_processor  payment_processor enum
origin             deal_origin enum DEFAULT 'manual'
external_id        text              ← dedup key for webhook-created deals
payment_method     text
payment_link       text
gi_client_id       text
gi_invoice_series  text
wise_iban          text
wise_bank_ref      text
thrive_ref         text
notes              text
created_at         timestamptz
updated_at         timestamptz
```

### sessions
```
id                 uuid PK
vendor_id          uuid → vendors(id)
client_id          uuid → clients(id)
deal_id            uuid → deals(id)
package_id         uuid → packages(id)
session_date       date
start_time         time
duration_min       integer DEFAULT 60
session_type       session_type enum
status             session_status enum DEFAULT 'planned'
task_type_id       uuid → task_types(id)  ← used in V2 billing flow
rate_usd           numeric              ← locked at session creation
hours              numeric
billed             boolean DEFAULT false
bill_id            uuid → bills(id)
notes              text
created_at         timestamptz
```

### bills
```
id                 uuid PK (gen_random_uuid())
vendor_id          uuid → vendors(id)
status             text CHECK (draft | submitted | returned | approved | paid)
total_amount       numeric NOT NULL CHECK > 0
currency           text DEFAULT 'EUR'
vendor_notes       text
finance_notes      text
payment_method     text
payment_reference  text
paid_from_account_id uuid
created_at         timestamptz DEFAULT now()
submitted_at       timestamptz
returned_at        timestamptz
approved_at        timestamptz
paid_at            timestamptz
```

### task_types
```
id         uuid PK
name       text NOT NULL
rate_usd   numeric NOT NULL
vendor_id  uuid → vendors(id)  ← null = global rate, set = vendor-specific
active     boolean DEFAULT true
created_at timestamptz
```

### packages
```
id             uuid PK (gen_random_uuid())
deal_id        uuid → deals(id)
client_id      uuid → clients(id)
vendor_id      uuid → vendors(id)
product_id     uuid → products(id)
sessions_total integer
sessions_used  integer DEFAULT 0
status         package_status enum DEFAULT 'active'
created_at     timestamptz
updated_at     timestamptz
```

### paychecks
```
id                 uuid PK
vendor_id          uuid → vendors(id)
month              text              ← YYYY-MM format
total_hours        numeric
amount             numeric
currency           text DEFAULT 'EUR'
status             text              ← draft | ready | pending | paid
payment_date       date
base_amount_usd    numeric
payout_amount      numeric
payout_currency    payout_currency enum  ← usd | ils | eur
exchange_rate_id   uuid → exchange_rates(id)
company_id         uuid
actual_amount_paid numeric           ← manual override for rounding
notes              text
created_at         timestamptz
```

### programs
```
id               uuid PK
name             text NOT NULL
slug             text UNIQUE
description      text
logo_url         text
audience_segment text
active           boolean DEFAULT true
created_at       timestamptz
```

### products
```
id               uuid PK
program_id       uuid → programs(id)
name             text NOT NULL
description      text
category         text    ← Coaching program | Online course | Group coaching | Workshop | Custom
status           text DEFAULT 'active'  ← active | draft | archived
type             text
logo_url         text
currency         text
price_min        numeric
price_max        numeric
base_price       numeric
base_currency    text DEFAULT 'USD'
sessions_included integer
vendor_type      text
links            jsonb DEFAULT '[]'  ← [{ label, url }]
prd_uid          text UNIQUE         ← PRD-0001, auto-assigned on insert
active           boolean DEFAULT true  ← legacy alias for status='active'
created_at       timestamptz
```

### plans
```
id                      uuid PK
product_id              uuid → products(id)
name                    text NOT NULL
plan_type               text    ← One payment | 3 payments | 4 payments | 5 payments | Subscription
plan_uid                text UNIQUE  ← PLN-0001, auto-assigned on insert
status                  text    ← active | draft | archived
amount                  numeric
currency                text DEFAULT 'USD'
installments_count      integer
description             text
link_source             text    ← ThriveCart | Green Invoice | Wise | bank_transfer | manual
link_id                 text
link_url                text
external_id             text    ← legacy alias for link_id
payment_rail            text CHECK (thrivecart | green_invoice | wise | bank_transfer | manual)
target_customer_country text
target_currency         text
vendor_payout_currency  text
vendor_id               uuid → vendors(id)
gateway_product_id      text
is_default              boolean DEFAULT false
priority                integer
created_at              timestamptz
```

### transactions
```
id                  uuid PK
source              text CHECK (thrivecart | green_invoice | wise | bank | manual)
direction           text CHECK (in | out)
status              text DEFAULT 'unmatched' CHECK (unmatched | matched | reconciled)
amount              numeric
currency            text
exchange_rate       numeric
amount_ils          numeric
counterparty_name   text
counterparty_account text
reference           text
event_type          text
transaction_date    date
settled_date        date
installment_index   integer
linked_entity_type  text CHECK (deal | paycheck | expense)
linked_entity_id    uuid
plan_id             uuid → plans(id)
account_id          text → accounts(id)
import_id           text → transaction_imports(id)
vendor_id           uuid → vendors(id)   ← set after merchant matching
category_id         text → transaction_categories(id)
category            text                 ← LEGACY raw text, use category_id instead
tax_category        text                 ← LEGACY, use tax_treatment instead
tax_treatment       text
entity              text                 ← business | private
tags                text[]
payment_cadence     text CHECK (recurring | project_based | one_time)
raw_data            jsonb
deleted_at          timestamptz          ← soft delete
duplicate_of        uuid → transactions(id)
external_id         text
created_at          timestamptz
```

### companies
```
id          text PK
name        text NOT NULL
currency    text NOT NULL
entity_type text NOT NULL
status      text DEFAULT 'active'
notes       text
created_at  timestamptz DEFAULT now()
```

### accounts
```
id           text PK
company_id   text → companies(id)
name         text NOT NULL
provider     text NOT NULL
currency     text NOT NULL
account_type text NOT NULL
is_active    boolean DEFAULT true
notes        text
created_at   timestamptz DEFAULT now()
```

### transaction_categories
```
id             text PK
name           text NOT NULL
hebrew         text
tax_category   text
match_patterns text[]
status         text DEFAULT 'active'
notes          text
```

### transaction_tags
```
id         text PK
name       text NOT NULL
status     text DEFAULT 'active' CHECK (active | inactive)
notes      text
created_at timestamptz DEFAULT now()
```

### transaction_imports
```
id            text PK (gen_random_uuid()::text)
account_id    text → accounts(id)
provider      text NOT NULL
source_type   text NOT NULL
raw_rows      integer
imported_rows integer
skipped_rows  integer
failed_rows   integer
imported_at   timestamptz DEFAULT now()
notes         text
```

### classification_rules
```
id          text PK
provider    text NOT NULL
priority    integer NOT NULL
when_field  text NOT NULL
when_op     text NOT NULL
when_value  text
set_field   text NOT NULL
set_value   text
stop        boolean DEFAULT false
notes       text
```

### fee_rules
```
id              text PK
provider        text NOT NULL
match_type      text NOT NULL
match_value     text
fee_account_id  text → accounts(id)
fee_category_id text → transaction_categories(id)
notes           text
```

### exchange_rates
```
id            uuid PK
month         date NOT NULL
from_currency text NOT NULL
to_currency   text NOT NULL
rate          numeric NOT NULL
source        exchange_rate_source enum DEFAULT 'manual'
notes         text
created_at    timestamptz
```

### account_balances
```
id           uuid PK
account_id   uuid → accounts(id)
date         date NOT NULL
balance      numeric NOT NULL
balance_type text DEFAULT 'opening'
notes        text
created_at   timestamptz
```

### profiles
```
id             uuid PK  ← will match auth.users.id after Google OAuth
system_role    system_role enum DEFAULT 'vendor'
vendor_id      uuid → vendors(id) ON DELETE SET NULL
full_name      text
nickname       text
email          text UNIQUE
slack_user_id  text
created_at     timestamptz DEFAULT now()
updated_at     timestamptz DEFAULT now()
```

### activities
```
id           uuid PK DEFAULT gen_random_uuid()
entity_type  text NOT NULL  ← client | deal | vendor | session | paycheck | invoice | global
entity_id    uuid           ← null only when entity_type = 'global'
type         text NOT NULL  ← note | reminder | system_log | integration_event
subtype      text           ← status_change | stage_move | payment_sent | slack_sent | ac_tag_added
body         text           ← plain Markdown only
created_by   uuid → profiles(id) ON DELETE SET NULL
origin       text NOT NULL DEFAULT 'user'  ← user | system | integration
due_at       timestamptz    ← reminders only
status       text           ← pending | done | dismissed (reminders only)
meta         jsonb NOT NULL DEFAULT '{}'
created_at   timestamptz NOT NULL DEFAULT now()
```

### audit_log
```
id           uuid PK
entity_type  text NOT NULL
entity_id    text NOT NULL
action       text NOT NULL
changed_by   text DEFAULT 'admin'
old_data     jsonb
new_data     jsonb
meta         jsonb
created_at   timestamptz DEFAULT now()
```

### documents
```
id           uuid PK
entity_type  document_entity_type enum  ← deal | client | vendor
entity_id    uuid NOT NULL
name         text NOT NULL
type         document_type enum DEFAULT 'url'  ← upload | url
url          text
uploaded_by  text
created_at   timestamptz
```

### deal_documents (legacy — prefer documents table)
```
id           uuid PK
deal_id      uuid → deals(id)
name         text
type         text  ← invoice | agreement | receipt | other
url          text
storage_path text
size_kb      integer
created_at   timestamptz
```

### deal_reminders (legacy — prefer activities table with type='reminder')
```
id         uuid PK
deal_id    uuid → deals(id)
text       text NOT NULL
done       boolean DEFAULT false
due_date   date
created_at timestamptz
```

### vendor_clients (junction)
```
id         uuid PK
vendor_id  uuid → vendors(id)
client_id  uuid → clients(id)
created_at timestamptz
```

### vendor_client_assignments (audit trail)
```
id         uuid PK
vendor_id  uuid → vendors(id)
client_id  uuid → clients(id)
valid_from timestamptz DEFAULT now()
valid_to   timestamptz
changed_by text NOT NULL
reason     text
created_at timestamptz
```

### rates (legacy rate table — V1 billing)
```
id             uuid PK
vendor_id      uuid → vendors(id)
session_type   session_type enum
rate           numeric NOT NULL
currency       text DEFAULT 'EUR'
name           text
effective_date date
notes          text
created_at     timestamptz
```

### vendor_hours (legacy work log — V1 billing, 0 rows)
```
id           uuid PK
vendor_id    uuid NOT NULL
deal_id      uuid → deals(id)
session_id   uuid → sessions(id)
date         date NOT NULL
hours        numeric NOT NULL
session_type session_type enum
rate         numeric
synced       boolean DEFAULT false
notes        text
created_at   timestamptz
```

### customers (external buyer layer)
```
id                     uuid PK
email                  text UNIQUE NOT NULL
full_name              text NOT NULL
phone                  text
country                text
thrivecart_customer_id text
green_invoice_client_id text
lifetime_value         numeric DEFAULT 0
first_purchase_date    timestamptz
last_purchase_date     timestamptz
created_at             timestamptz
updated_at             timestamptz
```

### import_logs (legacy import log — use transaction_imports for new imports)
```
id              uuid PK
entity_type     text NOT NULL
table_name      text NOT NULL
batch_id        uuid NOT NULL
rows_total      integer
rows_imported   integer
rows_skipped    integer
rows_failed     integer
column_mapping  jsonb
imported_by     text DEFAULT 'demo'
created_at      timestamptz
```

### payments (legacy — 0 rows, superseded by transactions)
### invoices (legacy — 0 rows, superseded by external invoice refs on deals)
### system_settings
```
key         text PK
value       text
label       text
description text
updated_at  timestamptz DEFAULT now()
```

---

## Triggers

| Trigger | Table | Event | Action |
|---------|-------|-------|--------|
| `trg_assign_prd_uid` | products | BEFORE INSERT | Auto-assign PRD-XXXX to prd_uid |
| `trg_assign_plan_uid` | plans | BEFORE INSERT | Auto-assign PLN-XXXX to plan_uid |
| `update_deals_updated_at` | deals | BEFORE UPDATE | Set updated_at = now() |
| `trg_customers_updated_at` | customers | BEFORE UPDATE | Set updated_at = now() |

---

## Classification layers (transactions)

| Layer | Field | Source |
|---|---|---|
| 1 | `category_id` → transaction_categories | Vendor default or manual |
| 2 | `tax_treatment` | Auto from category, overrideable |
| 3 | `entity` (business/private) | Vendor default or manual |
| 4 | `tags` text[] | Free text, autocomplete from transaction_tags |
| 5 | `payment_cadence` | Inherited from vendor on match |

### tax_treatment values (fixed)
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
| Merchant/subscription transactions | ✅ | ✅ | ✅ | ❌ |
| Classification fields | ✅ | ✅ | ✅ | ❌ |

---

## db.js function index

| Function | Table(s) | Notes |
|---|---|---|
| `getVendors()` | vendors + rates + vendor_clients | Active only, hydrated |
| `getVendorsInactive()` | vendors | Inactive only |
| `getVendor(id)` | vendors | Single, hydrated |
| `getVendorById(id)` | vendors | Alias for getVendor |
| `updateVendor(id, fields)` | vendors | Patch |
| `getRates()` | rates | All |
| `upsertRate(fields)` | rates | Insert or update |
| `deleteRate(id)` | rates | |
| `getClients()` | clients | Active only |
| `getClient(id)` | clients | Single |
| `createClient(fields)` | clients | |
| `updateClient(id, fields)` | clients | |
| `deleteClient(id)` | clients | |
| `getDeals()` | deals + clients + vendors + products | Full join |
| `getDeal(id)` | deals | Single, hydrated |
| `createDeal(fields)` | deals | |
| `updateDeal(id, fields)` | deals | |
| `deleteDeal(id)` | deals | |
| `getAllBills()` | bills | All statuses |
| `getBillsForVendor(vendorId)` | bills + sessions | Vendor's bills with sessions |
| `createDraftBillV2(vendorId, sessionIds)` | bills + sessions | Creates draft, locks sessions |
| `submitBillV2(billId)` | bills | draft → submitted |
| `withdrawBillV2(billId)` | bills | submitted → draft |
| `approveBillV2(billId)` | bills + sessions | approved → paid path |
| `rejectBillV2(billId, notes)` | bills | submitted → returned |
| `markBillPaidV2(billId, fields)` | bills | approved → paid |
| `getSessions()` | sessions | All |
| `getSessionsForVendor(vendorId)` | sessions | Vendor's sessions |
| `createSession(fields)` | sessions | |
| `updateSession(id, fields)` | sessions | |
| `logSessionV2(fields)` | sessions | V2 task-based logging |
| `getTaskTypes(vendorId)` | task_types | Global + vendor-specific |
| `getPackages()` | packages | All |
| `getPackagesForClient(clientId)` | packages | |
| `getAllProductsWithPlans()` | products + plans | Flat list, plans nested |
| `createProductFull(fields)` | products | prd_uid auto by trigger |
| `updateProductFull(id, fields)` | products | |
| `deleteProductFull(id)` | products + plans | Cascades plans |
| `createPlanFull(fields)` | plans | plan_uid auto by trigger |
| `updatePlanFull(id, fields)` | plans | |
| `deletePlanFull(id)` | plans | |
| `getTransactions({ includeDeleted })` | transactions + accounts | Full select |
| `createTransaction(fields)` | transactions | |
| `updateTransaction(id, fields)` | transactions | |
| `getAccounts()` | accounts | Active only |
| `getCompanies()` | companies | All |
| `getTransactionCategories()` | transaction_categories | Active only |
| `getTransactionTags()` | transaction_tags | Active only |
| `getExchangeRates()` | exchange_rates | All |
| `createExchangeRate(fields)` | exchange_rates | |
| `updateExchangeRate(id, fields)` | exchange_rates | |
| `deleteExchangeRate(id)` | exchange_rates | |
| `logActivity(fields)` | activities | Insert one row |
| `getActivities({ type, status, search })` | activities | All with optional filters |
| `getClientReminders(clientId)` | activities | Reminders ordered by due_at |
| `getNotifications()` | activities | Pending reminders + integration events, limit 20 |
| `updateActivity(id, fields)` | activities | Patch any field |
| `getNeedsAttentionItems()` | bills + deals + packages | Returns up to 8 actionable items |
| `getProfile(userId)` | profiles | Single by id |
| `upsertProfile(fields)` | profiles | Create or update |
| `getAllProfiles()` | profiles + auth.users + vendors | Admin-only — RPC `get_user_management_rows`. Backs `admin/users.html`. |
| `updateProfileRole(userId, newRole)` | profiles | Admin-only — RPC `update_profile_role`. Refuses self-demotion. |

**Rule:** Every new DB query goes into db.js as a named function. Never write `.from(...)` directly in page JS files.

---

## Known gaps / deferred

| Item | Status |
|------|--------|
| `eiMatchTx()` — reconcile UI | Stub — not built |
| Client name links in workload + payments | TODO |
| `billing_status` missing `link_sent` | Enum not updated in DB — defer or add in next migration |
| `vendors.cadence` duplicate of `payment_cadence` | Legacy column — do not write to it; read from `payment_cadence` |
| `transactions.category` (raw text) | Legacy — do not write to it; use `category_id` |
| `payments` table (0 rows) | Legacy — superseded by transactions |
| `invoices` table (0 rows) | Legacy — superseded by external refs on deals |
| `vendor_hours` table (0 rows) | Legacy V1 billing — superseded by sessions.bill_id flow |
| `import_logs` table | Legacy — use `transaction_imports` for new imports |

---

## Migration log (Demo DB)

| Migration | Description | Demo | Notes |
|-----------|-------------|------|-------|
| 004 | products, plans, transactions tables | ✅ | |
| 005 | transaction_tags | ✅ | |
| 006 | account_balances | ✅ | |
| 007 | transactions.account_id FK | ✅ | |
| 008 | deleted_at, duplicate_of, import_id, audit_log | ✅ | |
| 009 | category_id, tax_treatment, entity, tags on tx + vendors | ✅ | |
| 010 | merchant/subscription/software_saas to vendor_type enum, payment_cadence | ✅ | |
| 011 | products/plans new columns + prd_uid/plan_uid triggers | ✅ | |
| 015 | profiles table + system_role | ✅ | |
| 016 | activities table + profiles patches | ✅ | |
| 017 | drop backup tables | ✅ 2026-04-27 | plans_backup, packages_backup, deals_backup, product_plans_backup |
