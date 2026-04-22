# HSos — Payment Routing System

> Version: 1.0 · Date: 2026-04-10

---

## Overview

The payment routing system allows a single **product** to have multiple **pricing plans** — each targeting different customer countries, currencies, and payment gateways. When a deal is created, the admin selects the appropriate plan and gets the correct payment link automatically.

**Before this system:** Every deal required manual price entry and the payment link was stored in a JSONB blob on the product, not on the deal.

**After this system:** Plan selection is guided by the customer's country. The payment link flows from plan → deal, making it easy to copy and send.

---

## Key Concepts

### Product
A reusable service offering (e.g. "Leadership Development Program"). Products no longer need to store pricing directly — when `has_plans = true`, all pricing lives in product_plans.

### Product Plan
A specific variant of a product for a particular market/gateway combination. Example:
- "Israel — Green Invoice": ₪21,000 in 3 installments via Green Invoice
- "US — ThriveCart": $6,000 one-time via ThriveCart  
- "Europe — Stripe (default)": €6,000 via Stripe

A plan knows:
1. How much to charge and in what currency
2. Which gateway collects the payment
3. The checkout link (ready to send to customer)
4. Which vendor delivers the service and in what payout currency

### Customer
The *paying person* — attached to an email address and a country. The system looks up the customer by email when creating a deal to pre-fill the country and show matching plans.

**Note:** `customers` is different from `clients`. A client is the person receiving the service. Usually the same person, but can differ in corporate setups.

---

## Plan Selection Logic

When creating a new deal:

1. **Admin selects a product**
2. **Admin enters customer country** (or system detects from customer record)
3. Plans are fetched and sorted by:
   - `target_customer_country` match (exact country first)
   - `is_default = true` plans come before non-default
   - `priority` integer (lower = higher priority)
4. The first plan is auto-selected, but admin can choose any
5. The plan's `collection_gateway_link` is copied to `deals.payment_link`

### Priority Sort Order
```
1. Plans matching target_customer_country exactly (e.g. 'IL' when customer is from Israel)
2. Plans with is_default = true (fallback for all countries)
3. Plans for other specific countries
4. Within each tier: sorted by priority (ascending)
```

### Country Codes
| Code | Meaning |
|---|---|
| `IL` | Israel |
| `US` | United States |
| `EU` | Europe (any EU country) |
| `GB` | United Kingdom |
| `null` | Default — applies to all countries not otherwise matched |

---

## Database Schema

### product_plans

```sql
product_id                  uuid REFERENCES products
plan_name                   text              -- "Israel — Green Invoice"
plan_code                   text              -- "IL-GI-LDP" (optional)
target_customer_country     text              -- 'IL' | 'US' | null (default)
target_currency             text              -- 'ILS' | 'USD' | 'EUR'
price                       numeric
currency                    text
installments                int DEFAULT 1
collection_gateway          text              -- see gateways below
collection_gateway_product_id text            -- gateway's internal product ID
collection_gateway_link     text              -- checkout URL to send to client
vendor_id                   uuid REFERENCES vendors
vendor_payout_currency      text              -- 'ILS' | 'USD' | 'EUR'
is_default                  boolean DEFAULT false
active                      boolean DEFAULT true
priority                    int DEFAULT 0
```

### customers

```sql
email                       text UNIQUE NOT NULL
full_name                   text NOT NULL
phone                       text
country                     text              -- ISO code: IL, US, EU...
thrivecart_customer_id      text
green_invoice_client_id     text
lifetime_value              numeric DEFAULT 0
first_purchase_date         timestamptz
last_purchase_date          timestamptz
```

### New deal columns

```sql
product_plan_id             uuid REFERENCES product_plans  -- selected plan
payment_link                text    -- checkout URL (copied from plan or overridden)
payment_method              text    -- card | bank_transfer | paypal | etc.
payment_gateway_id          text    -- order/transaction ID in the gateway
payment_status              text    -- pending | initiated | partial | paid | refunded | failed
paid_at                     timestamptz
paid_amount                 numeric
paid_currency               text
```

---

## Supported Gateways

| Gateway | Code | Use Case |
|---|---|---|
| Green Invoice | `green_invoice` | Israeli clients, ILS billing, VAT invoices |
| ThriveCart | `thrivecart` | US/global clients, USD, upsells |
| Wise | `wise` | Bank transfer, international, no card |
| Stripe | `stripe` | Global, EUR/USD, card payments |

---

## Deal Creation Flow (New)

```
Admin opens "New Deal"
    │
    ▼ Step 1
Select Client + Product + Customer country/email
    │
    ▼ Step 2  (skipped if no product selected)
Plan Selection
  ├── Plans fetched from product_plans filtered by product_id
  ├── Sorted by country match → is_default → priority
  ├── First plan auto-selected
  └── Admin can override
    │
    ▼ Step 3
Deal Details
  ├── Price/currency pre-filled from selected plan
  ├── Vendor pre-filled from plan.vendor_id
  ├── Payment link shown (read-only, copyable)
  └── Admin adjusts status, notes, VAT
    │
    ▼ Submit
Deal created with:
  - product_plan_id = selected plan
  - payment_link = plan.collection_gateway_link
  - price, currency from plan
  - vendor from plan
```

---

## JavaScript API (db.js)

### Customer functions
```js
// Search existing customers by email (partial match)
searchCustomers(emailQuery) → Customer[]

// Get exact customer by email (returns null if not found)
getCustomerByEmail(email) → Customer | null

// Create a new customer record
createCustomer({ email, full_name, phone, country, ... }) → Customer

// Update a customer
updateCustomer(id, fields) → Customer
```

### Plan functions
```js
// Get all active plans for a product, sorted by country match
getProductPlans(productId, customerCountry?) → Plan[]

// Get a single plan with product + vendor data
getPlanById(planId) → Plan

// CRUD for plans (admin use)
createProductPlan(fields) → Plan
updateProductPlan(id, fields) → Plan
deleteProductPlan(id) → void
```

### Deal with plan
```js
// Create a deal pre-filled from a plan
createDealWithPlan({ planId, clientId, overrides? }) → Deal
// - Copies price, currency, vendor_id, payment_link from plan
// - Sets product_plan_id
// - overrides = any fields to override (sales_status, notes, etc.)
```

---

## Example: Adding Plans for a New Product

```sql
-- 1. Mark product as having plans
UPDATE products SET has_plans = true WHERE id = 'your-product-id';

-- 2. Add plans
INSERT INTO product_plans (product_id, plan_name, target_customer_country, price, currency, 
  installments, collection_gateway, collection_gateway_link, is_default, priority)
VALUES
  ('your-product-id', 'Israel — Green Invoice', 'IL', 7500, 'ILS', 3, 'green_invoice', NULL, false, 10),
  ('your-product-id', 'Global — Stripe',        NULL, 2000, 'EUR', 1, 'stripe', 'https://buy.stripe.com/xxx', true, 0);
```

---

## Lifecycle of a Payment

```
Deal created (payment_status = 'pending')
    │
    ├── Admin copies payment_link and sends to client
    │
    ▼
Client pays
    │
    ├── [ThriveCart webhook] or [manual update]
    │
    ▼
Deal updated:
    payment_status = 'paid'
    paid_at        = timestamp
    paid_amount    = actual amount received
    paid_currency  = currency received
    billing_status = 'paid' (manual or automated)
```

---

## Migration Order

1. Apply `migrations/add-product-plans.sql` (DDL — creates tables and columns)
2. Apply `migrations/seed-sample-plans.sql` (DML — inserts sample plans for testing)

Both are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
