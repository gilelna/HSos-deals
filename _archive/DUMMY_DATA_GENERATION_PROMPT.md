# HSos Dummy Data Generation Prompt

Generate a complete SQL script that populates a Supabase Postgres database with realistic dummy data for the HSos internal operations system.

## Prerequisites

**IMPORTANT:** Before generating this dummy data, you MUST first run the `hsos-schema.sql` script to create all tables, enums, indexes, and RLS policies. The schema must exist before inserting data.

## Database Schema Reference

The complete schema is defined in `hsos-schema.sql`. All tables use:
- `uuid` primary keys (use `gen_random_uuid()` in INSERT statements)
- `created_at timestamptz default now()`
- RLS enabled (but policies allow all for now)
- Proper enums for constrained fields (sales_status, billing_status, session_type, etc.)

## Data Requirements

### 1. Clients (30 records)
- Mix of:
  - 20 private clients (client_kind = 'private')
  - 10 corporate clients (client_kind = 'corporate')
- Fields:
  - `full_name`: realistic Hebrew/English names
  - `email`: realistic format (firstname.lastname@domain.com)
  - `phone`: Israeli format (+972-XX-XXX-XXXX)
  - `client_kind`: 'private' | 'corporate'
  - `company`: only for corporate clients (10 unique companies)
  - `source`: varied sources ('referral', 'website', 'linkedin', 'partner', 'event')
  - `notes`: some clients have notes, most null
  - `active`: 90% true, 10% false
  - `customer_id`: random format like 'AC-12345' or 'TC-67890' (simulate external system IDs)

### 2. Vendors (17 records total)

#### 5 Coach Vendors (vendor_type = 'coach')
- Each has:
  - `full_name`, `nickname`, `email`, `phone`
  - `vendor_type`: 'coach'
  - `payment_method`: mix of 'iban', 'paypal', 'wise'
  - `payment_id`: appropriate to method (email for paypal, identifier for wise)
  - `iban`: for those with iban method (Israeli format IL00-0000-0000-0000-0000-000)
  - `preferred_currency`: mostly 'EUR', some 'USD', one 'ILS'
  - `contract_url`: Google Drive link format
  - `active`: all true
  - Associated data:
    - 2-4 rates each (different session_types: 'coaching', 'consulting', 'editing', 'design')
    - 3-5 active students assigned (via vendor_clients junction table)

#### 4 Contractor Vendors (vendor_type = 'contractor')
- Similar fields as coaches
- `vendor_type`: 'contractor'
- 1-2 rates each (session_types: 'design', 'editing', 'admin')
- 0-2 clients assigned

#### 8 Team Member Vendors (vendor_type = 'team_member')
- Similar fields
- `vendor_type`: 'team_member'
- 1-2 rates each (session_types: 'admin', 'coaching', 'consulting')
- 1-3 clients assigned

### 3. Products (8 records)
- Types: mix of 'session', 'package', 'workshop', 'custom'
- Example products:
  1. "Executive Coaching Package" - 12 sessions, €3,600
  2. "1:1 Consulting Session" - 1 session, €250
  3. "Group Workshop" - 1 event, €1,200
  4. "Career Transition Package" - 8 sessions, €2,400
  5. "Leadership Development Program" - 20 sessions, €6,000
  6. "Team Coaching Session" - 1 session, €400
  7. "Assessment & Strategy Session" - 2 sessions, €600
  8. "Custom Consulting Project" - custom, €5,000
- Fields:
  - `base_price`: varied realistic prices
  - `currency`: mostly 'EUR', some 'USD'
  - `units`: 'sessions', 'hours', 'project'
  - `payment_links`: JSON with stripe/other links (realistic format)

### 4. Rates (varied per vendor)
- For each vendor, create 1-4 rates
- `session_type`: 'coaching', 'consulting', 'editing', 'design', 'admin', 'other'
- `rate`: realistic hourly rates (€50-€200 range)
- `currency`: match vendor's preferred_currency
- `effective_date`: dates in last 6 months

### 5. Deals (20 records)
Distribute across sales pipeline:
- 3 deals: `sales_status` = 'lead'
- 4 deals: `sales_status` = 'qualified'
- 7 deals: `sales_status` = 'active' ★ most important stage
- 4 deals: `sales_status` = 'delivered'
- 2 deals: `sales_status` = 'closed'

Billing status distribution:
- For 'lead'/'qualified': `billing_status` = 'pending'
- For 'active': mix of 'invoiced', 'partial', 'paid', 'overdue' (1-2 overdue)
- For 'delivered': mostly 'paid', one 'partial'
- For 'closed': all 'paid'

Fields:
- Link each deal to:
  - `client_id`: one of the 30 clients
  - `primary_vendor_id`: one of the coach/contractor vendors
  - `owner_vendor_id`: nullable, about 60% of deals have an owner
  - `product_id`: nullable, 80% linked to a product, 20% custom deals
- `price`: if linked to product use base_price (±10% variation), custom deals vary widely
- `currency`: mostly 'EUR'
- `vat_pct`: realistic mix (0, 17, 23)
- `vat_mode`: mix of 'excl', 'incl'
- `discount`: some deals have discounts ('10%', '€200', '2 sessions free'), most null
- `payment_processor`: mix of 'stripe', 'wise', 'thrive', 'other'
- External IDs (where relevant):
  - `gi_client_id`, `gi_invoice_series`: for some deals
  - `stripe_customer_id`, `stripe_payment_link`: for stripe deals
  - `wise_iban`, `wise_bank_ref`: for wire transfer deals
  - `thrive_ref`: for thrive deals
- `notes`: varied realistic notes on some deals
- `created_at`: spread over last 6 months
- `updated_at`: recent updates on active deals

### 6. Sessions (40-60 records)
Create sessions for deals in 'active' and 'delivered' stages:
- Link to:
  - `deal_id`: from relevant deals
  - `vendor_id`: must match deal's primary_vendor_id
  - `client_id`: must match deal's client_id
- `session_date`: dates spread over last 3 months
- `start_time`: business hours (09:00-18:00)
- `duration_min`: mostly 60, some 90, some 120
- `session_type`: 'coaching', 'consulting', 'editing', 'design', 'admin', 'other'
- `status`: 
  - Past dates: mostly 'done', some 'cancelled', few 'no_show'
  - Future dates: 'planned'
- `notes`: some have notes

### 7. Vendor Hours (80-100 records)
For each vendor, create work logs for last 2 months:
- `vendor_id`: one of the vendors
- `deal_id`: nullable, about 70% linked to a deal
- `session_id`: nullable, about 50% linked to a session
- `date`: spread over last 2 months
- `hours`: realistic values (0.5, 1, 1.5, 2, 2.5, 3)
- `session_type`: match the session/deal type
- `rate`: use vendor's rate for that session_type
- `notes`: some have notes
- `synced`: 90% true, 10% false

### 8. Payments (25-35 records)
Three types:

#### Incoming payments (15-20 records)
- `type`: 'incoming'
- `direction`: 'in'
- Link to deals (client_id from deal)
- `amount`: matches or is partial of deal price
- `currency`: match deal currency
- `payment_date`: recent dates, some past, some upcoming
- `method`: 'stripe', 'bank_transfer', 'wise', 'other'
- `reference`: realistic reference numbers
- `status`: 'pending', 'completed', 'failed'
- `tax_kind`: 'vat' for many

#### Vendor payouts (8-12 records)
- `type`: 'payout'
- `direction`: 'out'
- Link to vendor
- `amount`: sum of vendor hours for a period
- `currency`: vendor's preferred_currency
- `payment_date`: month-end dates
- `method`: match vendor's payment_method
- `status`: mix of 'pending', 'completed'
- `tax_kind`: some have 'withholding'

#### Expenses (2-3 records)
- `type`: 'expense'
- `direction`: 'out'
- `vendor_id`: nullable
- `amount`: varied amounts
- `currency`: 'EUR' mostly
- `payment_date`: recent
- `method`: 'card', 'bank_transfer'
- `status`: 'completed'
- `notes`: description of expense

### 9. Invoices (12-15 records)
For deals with billing_status 'invoiced', 'partial', 'paid':
- Link to `deal_id`
- `external_ref`: format like 'INV-2025-001', 'GI-2025-123'
- `issue_date`: realistic dates
- `amount`: match or partial of deal price
- `currency`: match deal
- `status`: 'draft', 'sent', 'paid', 'overdue'

### 10. Deal Documents (15-20 records)
Attach to various deals:
- `deal_id`: from deals
- `name`: realistic document names
- `type`: 'invoice', 'agreement', 'receipt', 'other'
- `url`: Google Drive link format
- `storage_path`: null for now
- `size_kb`: realistic sizes (50-500)

### 11. Deal Reminders (10-15 records)
For active deals:
- `deal_id`: from deals
- `text`: realistic reminder text ("Follow up on contract", "Send invoice", "Schedule next session")
- `done`: 70% false, 30% true
- `due_date`: mix of past, today, upcoming

### 12. Vendor-Client Assignments (vendor_clients junction)
Already handled in vendor generation, but ensure:
- Each coach vendor has 3-5 clients
- Each contractor has 0-2 clients
- Each team member has 1-3 clients
- No duplicate pairs
- Use clients from the 30 generated

## Output Format

Generate a single SQL file with:

1. **Header comment** with generation timestamp and summary
2. **BEGIN transaction**
3. **INSERT statements** in dependency order:
   - clients
   - vendors
   - products
   - rates (after vendors)
   - deals (after clients, vendors, products)
   - vendor_clients junction (after vendors, clients)
   - sessions (after deals)
   - vendor_hours (after vendors, deals, sessions)
   - payments
   - invoices (after deals)
   - deal_documents (after deals)
   - deal_reminders (after deals)
4. **COMMIT transaction**

## Style Guidelines

- Use realistic, varied data (no "Test Client 1", "Test Client 2")
- Hebrew names: use authentic Israeli first/last names
- English names: use common international names
- Dates: spread realistically (not all on same day)
- Amounts: varied, realistic for consulting/coaching business
- Notes/descriptions: realistic business language, some Hebrew mixed in
- Email format: firstname.lastname@domain.com (use realistic domains)
- Phone: Israeli format with proper area codes

## Example Output Structure

```sql
-- HSos Dummy Data
-- Generated: 2025-03-26
-- Contains: 30 clients, 17 vendors, 8 products, 20 deals, ~50 sessions, ~90 vendor hours, ~30 payments

BEGIN;

-- Clients
INSERT INTO clients (id, customer_id, full_name, email, phone, client_kind, company, source, notes, active, created_at) VALUES
('gen_random_uuid()', 'AC-12001', 'Sarah Cohen', 'sarah.cohen@gmail.com', '+972-50-123-4567', 'private', NULL, 'referral', NULL, true, '2024-10-15 09:30:00+00'),
-- ... 29 more

-- Vendors
INSERT INTO vendors (id, full_name, nickname, email, phone, vendor_type, payment_method, payment_id, iban, preferred_currency, contract_url, active, created_at) VALUES
-- ... coaches, contractors, team members

-- Products
INSERT INTO products (id, name, type, base_price, currency, units, notes, active, payment_links, created_at) VALUES
-- ... 8 products

-- etc...

COMMIT;
```

## Validation Rules

- All foreign keys must reference existing records
- Dates must be logical (created_at before updated_at, session dates before vendor_hours dates)
- Amounts must be positive
- Enums must use exact values from schema
- UUIDs can use gen_random_uuid() or hardcoded valid UUIDs
- No orphaned records

## Usage

This script will be run on a separate Supabase database (dummy environment) that mirrors the production schema. The frontend will have a toggle to switch between production and dummy data sources.
