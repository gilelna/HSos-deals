# HSos — Database Schema Reference

All tables use `uuid` PKs, `created_at` timestamps, and have RLS enabled.
Computed fields (final_price, vat_amount) stay in frontend — not stored in DB.

---

## Key Principles

- Sessions replace lessons
- Clients are operational entities (not full customer records)
- Vendors are shared across Operations and Payments
- Team members and managers are modeled through vendors + roles, not a separate managers table
- Payments table is unified (incoming, payouts, expenses)
- External systems (ActiveCampaign, ThriveCart, etc.) are linked via IDs, not duplicated

---

## Enums

```sql
sales_status        : lead | qualified | active | delivered | closed
billing_status      : pending | invoiced | partial | paid | overdue
session_status      : planned | done | cancelled | no_show
session_type        : coaching | consulting | editing | design | admin | other
product_type        : session | package | workshop | custom
vendor_type         : coach | contractor | team_member
system_role         : admin | manager | finance | vendor
payment_processor   : stripe | wise | thrive | other
vat_mode            : excl | incl
```

---

## Tables

### profiles
System users and access roles (auth reintroduced later).
```
id              uuid PK → auth.users.id
system_role     system_role
nickname        text
full_name       text
created_at      timestamptz
```

### clients
Operational clients managed inside HSos (not full customer records).
```
id              uuid PK
customer_id     text (external reference to customer system)
full_name       text NOT NULL
email           text
phone           text
client_kind     text (private | corporate)
company         text
source          text
notes           text
active          boolean default true
created_at      timestamptz
```
-- customer_id links to external customer systems (ActiveCampaign, ThriveCart, etc.)

### vendors
Service providers and team members managed for operations and/or payments.
```
id                  uuid PK
full_name           text NOT NULL
nickname            text
email               text
phone               text
vendor_type         vendor_type
payment_method      text (iban | paypal | wise | other)
payment_id          text (paypal email / wise id / etc)
iban                text
preferred_currency  text default 'EUR'
contract_url        text
active              boolean default true
notes               text
created_at          timestamptz
```

### products
Reusable commercial items for Sales. VAT does NOT live here.
```
id              uuid PK
name            text NOT NULL
type            product_type
base_price      numeric(10,2)
currency        text default 'EUR'
units           text
notes           text
active          boolean default true
created_at      timestamptz
payment_links   jsonb
```
-- payment_links stores multiple payment options (stripe, israeli cc, etc)

### rates
Per-vendor hourly rates by session type.
```
id              uuid PK
vendor_id       uuid FK → vendors.id ON DELETE CASCADE
session_type    session_type NOT NULL
rate            numeric(10,2) NOT NULL
currency        text default 'EUR'
effective_date  date
notes           text
created_at      timestamptz
```
Index: (vendor_id, session_type)

### deals ★ central table
```
id                  uuid PK
client_id           uuid FK → clients.id
primary_vendor_id   uuid FK → vendors.id
owner_vendor_id     uuid FK → vendors.id (nullable)
product_id          uuid FK → products.id (nullable — custom deals)
price               numeric(10,2)
currency            text default 'EUR'
vat_pct             numeric(5,2) default 0
vat_mode            vat_mode default 'excl'
discount            text
sales_status        sales_status default 'lead'
billing_status      billing_status default 'pending'
payment_processor   payment_processor
gi_client_id        text
gi_invoice_series   text
stripe_customer_id  text
stripe_payment_link text
wise_iban           text
wise_bank_ref       text
thrive_ref          text
notes               text
created_at          timestamptz
updated_at          timestamptz
```
Indexes: client_id, primary_vendor_id, owner_vendor_id, sales_status, billing_status

### sessions
Time-based service events linked to a deal.
```
id              uuid PK
deal_id         uuid FK → deals.id ON DELETE CASCADE
vendor_id       uuid FK → vendors.id
client_id       uuid FK → clients.id
session_date    date
start_time      time
duration_min    integer default 60
session_type    session_type
status          session_status default 'planned'
notes           text
created_at      timestamptz
```
Indexes: deal_id, vendor_id, client_id, session_date, status

### vendor_hours
Time logs for payout calculation and operational tracking.
```
id          uuid PK
vendor_id   uuid FK → vendors.id
deal_id     uuid FK → deals.id (nullable)
session_id  uuid FK → sessions.id (nullable)
date        date NOT NULL
hours       numeric(4,2) NOT NULL
session_type session_type
rate        numeric(10,2)
notes       text
synced      boolean default false
created_at  timestamptz
```
Indexes: vendor_id, date
-- vendor_hours are used for payout calculations and may or may not map 1:1 with sessions

### payments
Unified payment records (incoming, payouts, expenses).
```
id              uuid PK
deal_id         uuid FK → deals.id (nullable)
client_id       uuid FK → clients.id (nullable)
vendor_id       uuid FK → vendors.id (nullable)
type            text (incoming | payout | expense)
direction       text (in | out)
amount          numeric(10,2) NOT NULL
currency        text default 'EUR'
payment_date    date
method          text
reference       text
status          text
tax_kind        text (vat | withholding | fee | other)
notes           text
created_at      timestamptz
```
-- unified table for incoming payments, vendor payouts, and future expenses
-- keep classification intentionally light for now; add category/vendor classification tables later if needed
-- tax_kind is an initial lightweight hook for VAT, withholding, fees, and similar finance cases
Index: deal_id

### invoices
```
id              uuid PK
deal_id         uuid FK → deals.id
external_ref    text
issue_date      date
amount          numeric(10,2)
currency        text default 'EUR'
status          text
notes           text
created_at      timestamptz
```
Index: deal_id, status

### deal_documents
Files and URLs attached to deals.
```
id          uuid PK
deal_id     uuid FK → deals.id ON DELETE CASCADE
name        text
type        text (invoice | agreement | receipt | other)
url         text
storage_path text
size_kb     integer
created_at  timestamptz
```
Index: deal_id

### deal_reminders
Follow-up reminders per deal.
```
id          uuid PK
deal_id     uuid FK → deals.id ON DELETE CASCADE
text        text NOT NULL
done        boolean default false
due_date    date
created_at  timestamptz
```
Index: deal_id

---

## Key queries used in frontend

**Sessions used per deal (for package tracking):**
```sql
SELECT COUNT(*) FROM sessions
WHERE deal_id = $1 AND status = 'done'
```

**Monthly vendor payroll:**
```sql
SELECT vendor_id, SUM(hours * rate) as total
FROM vendor_hours
WHERE date >= '2025-03-01' AND date < '2025-04-01'
GROUP BY vendor_id
```

**Overdue deals:**
```sql
SELECT * FROM deals
WHERE billing_status = 'overdue'
ORDER BY updated_at DESC
```

**Monthly revenue:**
```sql
SELECT SUM(amount) FROM payments
WHERE payment_date >= '2025-03-01'
AND status = 'paid'
```

---

## RLS Policies

### Phase 1 (current)
All users (auth currently bypassed) can read and write all tables:
```sql
USING (auth.role() = 'authenticated')
```

### Phase 2 (vendor portal)
Vendors can only see their own data:
```sql
-- sessions: vendor sees only their sessions
USING (vendor_id = auth.uid())

-- vendor_hours: vendor sees only their hours
USING (vendor_id = auth.uid())
```

### Phase 3 (client portal)
Clients can only see their own data:
```sql
-- deals: client sees only their deals
USING (client_id = auth.uid())

-- sessions: client sees only their sessions
USING (client_id = auth.uid())
```
