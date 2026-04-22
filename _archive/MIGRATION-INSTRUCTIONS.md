# Product Plans Migration Instructions

## Pre-flight Check
1. Backup your Supabase database (Dashboard → Settings → Backups)
2. Review migration files:
   - `migrations/add-product-plans.sql` — schema changes
   - `migrations/seed-sample-plans.sql` — real products + plans + test customers

---

## Step 1: Run Schema Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy the full contents of `migrations/add-product-plans.sql`
3. Paste and execute
4. Expect output: `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX` — no errors

### Verify tables were created:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('product_plans', 'customers');
```
Expected: 2 rows returned.

### Verify columns added to deals:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'deals'
AND column_name IN ('product_plan_id', 'payment_method', 'payment_link', 'payment_status');
```
Expected: 4 rows returned.

### Verify column added to clients:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clients'
AND column_name = 'customer_id_fk';
```
Expected: 1 row returned.

---

## Step 2: Seed Sample Data

1. Copy the full contents of `migrations/seed-sample-plans.sql`
2. Paste and execute in SQL Editor

### Verify products inserted:
```sql
SELECT id, name, has_plans FROM public.products
WHERE name IN ('Trial Lesson', '10-Lesson Package', '20-Lesson Package');
```
Expected: 3 rows, all with `has_plans = true`.

### Verify plans inserted:
```sql
SELECT p.plan_name, p.price, p.currency, p.installments, p.collection_gateway,
       p.target_customer_country, p.is_default
FROM public.product_plans p
JOIN public.products pr ON pr.id = p.product_id
WHERE pr.name IN ('Trial Lesson', '10-Lesson Package', '20-Lesson Package')
ORDER BY pr.name, p.priority;
```
Expected: 13 rows total (3 for Trial Lesson, 5 for 10-Lesson, 5 for 20-Lesson).

### Verify test customers:
```sql
SELECT email, full_name, country FROM public.customers
WHERE email IN ('anna@example.com', 'john@example.com', 'marie@example.com');
```
Expected: 3 rows.

---

## Rollback (if needed)

Run this in SQL Editor to undo everything:

```sql
-- Remove new columns from deals
ALTER TABLE public.deals DROP COLUMN IF EXISTS product_plan_id;
ALTER TABLE public.deals DROP COLUMN IF EXISTS payment_method;
ALTER TABLE public.deals DROP COLUMN IF EXISTS payment_link;
ALTER TABLE public.deals DROP COLUMN IF EXISTS payment_gateway_id;
ALTER TABLE public.deals DROP COLUMN IF EXISTS payment_status;
ALTER TABLE public.deals DROP COLUMN IF EXISTS paid_at;
ALTER TABLE public.deals DROP COLUMN IF EXISTS paid_amount;
ALTER TABLE public.deals DROP COLUMN IF EXISTS paid_currency;

-- Remove new column from clients
ALTER TABLE public.clients DROP COLUMN IF EXISTS customer_id_fk;

-- Remove new column from products
ALTER TABLE public.products DROP COLUMN IF EXISTS has_plans;

-- Drop new tables (CASCADE removes FKs automatically)
DROP TABLE IF EXISTS public.product_plans CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- Drop helper function (only if not used elsewhere)
-- DROP FUNCTION IF EXISTS public.set_updated_at();
```

> **Note:** The 3 test products (Trial Lesson, 10-Lesson Package, 20-Lesson Package) are not
> removed by the rollback above — delete them manually if needed:
> ```sql
> DELETE FROM public.products WHERE id IN (
>   'b1000001-0000-0000-0000-000000000001',
>   'b1000002-0000-0000-0000-000000000001',
>   'b1000003-0000-0000-0000-000000000001'
> );
> ```
